import admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

admin.initializeApp();

const db = admin.firestore();

const candidatePositions = [
  'President',
  'Vice President',
  'Secretary',
  'Organizer',
  'Deputy Organizer',
  'Wocom',
  'Deputy Wocom',
  'Communication Officer',
];

const removeInvisibleChars = (value) =>
  String(value || '').replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '');

const normalizeSpaces = (value) => removeInvisibleChars(value).replace(/\s+/g, ' ').trim();

const normalizeName = (name) => normalizeSpaces(name).toLowerCase();

const normalizeStudentId = (studentId) =>
  normalizeSpaces(studentId)
    .toUpperCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\.+$/g, '');

const ensureAdmin = async (uid) => {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Admin authentication is required.');
  }

  const adminSnapshot = await db.collection('admins').doc(uid).get();

  if (!adminSnapshot.exists || adminSnapshot.data().active === false) {
    throw new HttpsError('permission-denied', 'This account is not allowed to perform this action.');
  }
};

export const verifyStudent = onCall(async (request) => {
  const fullName = normalizeSpaces(request.data?.fullName);
  const studentId = normalizeStudentId(request.data?.studentId);

  if (!fullName || !studentId) {
    throw new HttpsError('invalid-argument', 'Please enter both full name and student ID.');
  }

  const snapshot = await db
    .collection('students')
    .where('studentIdNormalized', '==', studentId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new HttpsError('not-found', 'Student ID not found. Please check and try again.');
  }

  const studentDoc = snapshot.docs[0];
  const student = studentDoc.data();

  if (student.nameNormalized !== normalizeName(fullName)) {
    throw new HttpsError('failed-precondition', 'Name does not match this student ID.');
  }

  if (student.hasVoted) {
    throw new HttpsError('already-exists', 'This student has already voted.');
  }

  return {
    student: {
      id: studentDoc.id,
      name: student.name,
      studentId: student.studentId,
    },
  };
});

export const submitVote = onCall(async (request) => {
  const fullName = normalizeSpaces(request.data?.fullName);
  const studentId = normalizeStudentId(request.data?.studentId);
  const selections = request.data?.selections || {};

  if (!fullName || !studentId || typeof selections !== 'object') {
    throw new HttpsError('invalid-argument', 'A valid student identity and selections are required.');
  }

  const studentSnapshot = await db
    .collection('students')
    .where('studentIdNormalized', '==', studentId)
    .limit(1)
    .get();

  if (studentSnapshot.empty) {
    throw new HttpsError('not-found', 'Student ID not found.');
  }

  const studentDoc = studentSnapshot.docs[0];
  const student = studentDoc.data();

  if (student.nameNormalized !== normalizeName(fullName)) {
    throw new HttpsError('failed-precondition', 'Name does not match this student ID.');
  }

  if (student.hasVoted) {
    throw new HttpsError('already-exists', 'This student has already voted.');
  }

  const candidatesSnapshot = await db.collection('candidates').get();
  const candidates = candidatesSnapshot.docs.map((candidateDoc) => ({ id: candidateDoc.id, ...candidateDoc.data() }));
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const positionsWithCandidates = new Set(candidates.map((candidate) => candidate.position).filter(Boolean));

  for (const position of positionsWithCandidates) {
    if (!selections[position]) {
      throw new HttpsError('failed-precondition', 'Select one candidate for every available position before submitting.');
    }
  }

  for (const [position, candidateId] of Object.entries(selections)) {
    if (!candidatePositions.includes(position)) {
      throw new HttpsError('invalid-argument', `Unknown position: ${position}`);
    }

    const candidate = candidatesById.get(candidateId);

    if (!candidate || candidate.position !== position) {
      throw new HttpsError('invalid-argument', `Invalid candidate selected for ${position}.`);
    }
  }

  await db.runTransaction(async (transaction) => {
    const freshStudentSnapshot = await transaction.get(studentDoc.ref);
    const freshStudent = freshStudentSnapshot.data();

    if (!freshStudent || freshStudent.hasVoted) {
      throw new HttpsError('already-exists', 'This student has already voted.');
    }

    transaction.set(db.collection('votes').doc(studentDoc.id), {
      studentId: student.studentId,
      studentName: student.name,
      selections,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.update(studentDoc.ref, {
      hasVoted: true,
      status: 'Voted',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});

export const resetVoting = onCall(async (request) => {
  await ensureAdmin(request.auth?.uid);

  const [votesSnapshot, studentsSnapshot] = await Promise.all([
    db.collection('votes').get(),
    db.collection('students').get(),
  ]);

  let batch = db.batch();
  let operations = 0;
  const commits = [];

  const queueOperation = () => {
    operations += 1;
    if (operations === 450) {
      commits.push(batch.commit());
      batch = db.batch();
      operations = 0;
    }
  };

  votesSnapshot.docs.forEach((voteDoc) => {
    batch.delete(voteDoc.ref);
    queueOperation();
  });

  studentsSnapshot.docs.forEach((studentDoc) => {
    batch.update(studentDoc.ref, {
      hasVoted: false,
      status: 'Not Voted',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    queueOperation();
  });

  if (operations > 0) {
    commits.push(batch.commit());
  }

  await Promise.all(commits);
  return { success: true };
});