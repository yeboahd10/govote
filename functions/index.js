import admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

admin.initializeApp();

const db = admin.firestore();

const candidatePositions = [
  'President',
  'Vice President',
  'Secretary',
  'Deputy Secretary',
  'Treasurer',
  'Deputy Treasurer',
  'Organizer',
  "Women's Organizer",
  'Deputy Organizer',
  'Wocom',
  'Deputy Wocom',
  'Communication Officer',
  'Deputy Communications Officer',
];

const removeInvisibleChars = (value) =>
  String(value || '').replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '');

const normalizeSpaces = (value) => removeInvisibleChars(value).replace(/\s+/g, ' ').trim();

const normalizeName = (name) => {
  const normalized = normalizeSpaces(name).toLowerCase();
  // Split name into words, sort them alphabetically, and rejoin
  // This makes "John Doe" equal to "Doe John"
  // Use locale-independent sort to match client-side behaviour exactly
  return normalized
    .split(/\s+/)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join(' ');
};

// Simple normalization without word-sorting — used as a fallback comparison
// and for healing legacy records whose nameNormalized was stored without sorting
const normalizeNameSimple = (name) =>
  normalizeSpaces(name).toLowerCase();

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

const getVotingStatus = async () => {
  const votingSettingsSnapshot = await db.collection('settings').doc('voting').get();
  if (!votingSettingsSnapshot.exists) {
    return 'active';
  }

  return votingSettingsSnapshot.data()?.status === 'paused' ? 'paused' : 'active';
};

export const getPublicVotingStatus = onCall(async () => ({
  status: await getVotingStatus(),
}));

export const getPublicResults = onCall(async () => {
  const [candidatesSnapshot, votesSnapshot] = await Promise.all([
    db.collection('candidates').get(),
    db.collection('votes').get(),
  ]);

  const results = new Map();

  candidatesSnapshot.docs.forEach((candidateDoc) => {
    const candidate = candidateDoc.data();
    const position = candidate.position;

    if (!position) {
      return;
    }

    if (!results.has(position)) {
      results.set(position, []);
    }

    results.get(position).push({
      id: candidateDoc.id,
      name: candidate.name || 'Unnamed Candidate',
      imageUrl: candidate.imageUrl || '',
      votes: 0,
    });
  });

  votesSnapshot.docs.forEach((voteDoc) => {
    const vote = voteDoc.data();

    Object.entries(vote.selections || {}).forEach(([position, candidateId]) => {
      const positionEntries = results.get(position) || [];
      const candidateEntry = positionEntries.find((entry) => entry.id === candidateId);

      if (candidateEntry) {
        candidateEntry.votes += 1;
      }
    });
  });

  const normalizedResults = {};

  results.forEach((entries, position) => {
    normalizedResults[position] = [...entries].sort((first, second) => {
      if (second.votes !== first.votes) {
        return second.votes - first.votes;
      }

      return first.name.localeCompare(second.name);
    });
  });

  return {
    results: normalizedResults,
  };
});

export const searchStudents = onCall(async (request) => {
  const query = normalizeSpaces(request.data?.query || '').toLowerCase();

  if (query.length < 2) {
    return { students: [] };
  }

  const snapshot = await db.collection('students').limit(2000).get();
  const matches = snapshot.docs
    .map((studentDoc) => studentDoc.data())
    .filter((student) => String(student.name || '').toLowerCase().includes(query))
    .slice(0, 8)
    .map((student) => ({
      name: student.name || '',
      studentId: student.studentId || '',
    }));

  return { students: matches };
});

export const verifyStudent = onCall(async (request) => {
  const fullName = normalizeSpaces(request.data?.fullName);
  const studentId = normalizeStudentId(request.data?.studentId);

  if (await getVotingStatus() === 'paused') {
    throw new HttpsError('failed-precondition', 'Polls are closed now. Check back later.');
  }

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

  const submittedSorted   = normalizeName(fullName);
  const submittedSimple   = normalizeNameSimple(fullName);
  const storedNormalized  = student.nameNormalized || '';
  const storedSimple      = normalizeNameSimple(student.name || '');

  const primaryMatch  = submittedSorted  === storedNormalized;
  const fallbackMatch = submittedSimple  === storedSimple;

  if (!primaryMatch && !fallbackMatch) {
    throw new HttpsError('failed-precondition', 'Name does not match this student ID.');
  }

  // Heal stale nameNormalized in Firestore so future verifications use the fast path
  if (!primaryMatch && fallbackMatch) {
    try {
      await studentDoc.ref.update({
        nameNormalized: submittedSorted,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (healError) {
      // Non-fatal — verification still proceeds
      console.warn('Could not heal nameNormalized for student:', healError);
    }
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

  if (await getVotingStatus() === 'paused') {
    throw new HttpsError('failed-precondition', 'Polls are closed now. Check back later.');
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

  const submittedSorted = normalizeName(fullName);
  const submittedSimple = normalizeNameSimple(fullName);
  const storedNormalized = student.nameNormalized || '';
  const storedSimple = normalizeNameSimple(student.name || '');

  if (submittedSorted !== storedNormalized && submittedSimple !== storedSimple) {
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

export const resetStudentVote = onCall(async (request) => {
  await ensureAdmin(request.auth?.uid);

  const studentId = normalizeStudentId(request.data?.studentId);
  if (!studentId) {
    throw new HttpsError('invalid-argument', 'Student ID is required.');
  }

  // Find the student
  const studentSnapshot = await db
    .collection('students')
    .where('studentIdNormalized', '==', studentId)
    .limit(1)
    .get();

  if (studentSnapshot.empty) {
    throw new HttpsError('not-found', 'Student not found.');
  }

  const studentDoc = studentSnapshot.docs[0];
  const student = studentDoc.data();

  if (!student.hasVoted) {
    throw new HttpsError('failed-precondition', 'This student has not voted yet.');
  }

  // Find and delete the vote record
  const voteSnapshot = await db.collection('votes').doc(studentDoc.id).get();
  if (voteSnapshot.exists) {
    // Use transaction to ensure consistency
    await db.runTransaction(async (transaction) => {
      transaction.delete(voteSnapshot.ref);
      transaction.update(studentDoc.ref, {
        hasVoted: false,
        status: 'Not Voted',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  } else {
    // Vote record doesn't exist, just reset student status
    await studentDoc.ref.update({
      hasVoted: false,
      status: 'Not Voted',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return { success: true };
});

export const repairStudentData = onCall(async (request) => {
  await ensureAdmin(request.auth?.uid);

  const studentsSnapshot = await db.collection('students').get();
  let repaired = 0;
  const issues = [];

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

  // Check each student
  for (const studentDoc of studentsSnapshot.docs) {
    const data = studentDoc.data();

    // Fix 1: Missing hasVoted field
    if (data.hasVoted === undefined || data.hasVoted === null) {
      batch.update(studentDoc.ref, {
        hasVoted: false,
        status: data.status || 'Not Voted',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      issues.push(`${data.name} (${data.studentId}): hasVoted was missing, set to false`);
      repaired++;
      queueOperation();
      continue;
    }

    // Fix 2: hasVoted=true but no corresponding vote exists
    if (data.hasVoted === true) {
      const voteExists = await db.collection('votes').doc(studentDoc.id).get();
      if (!voteExists.exists) {
        batch.update(studentDoc.ref, {
          hasVoted: false,
          status: 'Not Voted',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        issues.push(`${data.name} (${data.studentId}): hasVoted was true but no vote found, reset to false`);
        repaired++;
        queueOperation();
        continue;
      }
    }

    // Fix 3: hasVoted=false but vote exists (shouldn't happen, but check anyway)
    if (data.hasVoted === false) {
      const voteExists = await db.collection('votes').doc(studentDoc.id).get();
      if (voteExists.exists) {
        batch.update(studentDoc.ref, {
          hasVoted: true,
          status: 'Voted',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        issues.push(`${data.name} (${data.studentId}): hasVoted was false but vote exists, set to true`);
        repaired++;
        queueOperation();
      }
    }
  }

  if (operations > 0) {
    commits.push(batch.commit());
  }

  await Promise.all(commits);

  return {
    success: true,
    repaired,
    issues: issues.slice(0, 50), // Return first 50 issues for display
    totalIssues: issues.length,
  };
});
