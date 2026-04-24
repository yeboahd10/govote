import admin from 'firebase-admin';
import { createHash } from 'node:crypto';
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

const normalizeBrowserId = (browserId) => normalizeSpaces(browserId).toLowerCase();
const normalizeDeviceFingerprint = (deviceFingerprint) => normalizeSpaces(deviceFingerprint).toLowerCase();

const buildBrowserLockId = (browserId) =>
  createHash('sha256').update(browserId).digest('hex');

const buildDeviceLockId = (deviceFingerprint) =>
  createHash('sha256').update(deviceFingerprint).digest('hex');

const normalizeIpAddress = (ipAddress) =>
  normalizeSpaces(ipAddress || '')
    .replace(/^::ffff:/i, '')
    .replace(/\s+/g, '');

const buildIpHash = (ipAddress) => {
  const normalizedIp = normalizeIpAddress(ipAddress);
  return normalizedIp ? createHash('sha256').update(normalizedIp).digest('hex') : '';
};

const getRequestIp = (request) => {
  const forwardedFor = request.rawRequest?.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return request.rawRequest?.ip || request.rawRequest?.socket?.remoteAddress || '';
};

const getUserAgent = (request) =>
  normalizeSpaces(request.rawRequest?.headers['user-agent'] || '');

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
  const browserId = normalizeBrowserId(request.data?.browserId);
  const deviceFingerprint = normalizeDeviceFingerprint(request.data?.deviceFingerprint);
  const ipAddress = normalizeIpAddress(getRequestIp(request));

  if (await getVotingStatus() === 'paused') {
    throw new HttpsError('failed-precondition', 'Polls are closed now. Check back later.');
  }

  if (!fullName || !studentId) {
    throw new HttpsError('invalid-argument', 'Please enter both full name and student ID.');
  }

  if (!browserId) {
    throw new HttpsError('invalid-argument', 'This browser could not be verified. Refresh and try again.');
  }

  if (!deviceFingerprint) {
    throw new HttpsError('invalid-argument', 'This device could not be verified. Refresh and try again.');
  }

  const browserLockSnapshot = await db
    .collection('browserVoteLocks')
    .doc(buildBrowserLockId(browserId))
    .get();
  const deviceLockSnapshot = await db
    .collection('deviceVoteLocks')
    .doc(buildDeviceLockId(deviceFingerprint))
    .get();

  if (browserLockSnapshot.exists) {
    throw new HttpsError('already-exists', 'You have voted already');
  }

  if (deviceLockSnapshot.exists) {
    throw new HttpsError('already-exists', 'You have voted already');
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

  await db.collection('securityLogs').add({
    event: 'verifyStudent_passed',
    studentId,
    browserIdNormalized: browserId,
    deviceFingerprint,
    ipAddress,
    ipHash: buildIpHash(ipAddress),
    userAgent: getUserAgent(request),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

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
  const browserId = normalizeBrowserId(request.data?.browserId);
  const deviceFingerprint = normalizeDeviceFingerprint(request.data?.deviceFingerprint);
  const selections = request.data?.selections || {};
  const ipAddress = normalizeIpAddress(getRequestIp(request));
  const ipHash = buildIpHash(ipAddress);
  const userAgent = getUserAgent(request);

  if (!fullName || !studentId || !browserId || !deviceFingerprint || typeof selections !== 'object') {
    throw new HttpsError('invalid-argument', 'A valid student identity and selections are required.');
  }

  if (await getVotingStatus() === 'paused') {
    throw new HttpsError('failed-precondition', 'Polls are closed now. Check back later.');
  }

  const browserLockRef = db.collection('browserVoteLocks').doc(buildBrowserLockId(browserId));
  const deviceLockRef = db.collection('deviceVoteLocks').doc(buildDeviceLockId(deviceFingerprint));

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
    const [freshStudentSnapshot, browserLockSnapshot, deviceLockSnapshot] = await Promise.all([
      transaction.get(studentDoc.ref),
      transaction.get(browserLockRef),
      transaction.get(deviceLockRef),
    ]);
    const freshStudent = freshStudentSnapshot.data();

    if (!freshStudent || freshStudent.hasVoted) {
      throw new HttpsError('already-exists', 'This student has already voted.');
    }

    if (browserLockSnapshot.exists) {
      throw new HttpsError('already-exists', 'You have voted already');
    }

    if (deviceLockSnapshot.exists) {
      throw new HttpsError('already-exists', 'You have voted already');
    }

    transaction.set(db.collection('votes').doc(studentDoc.id), {
      studentId: student.studentId,
      studentName: student.name,
      selections,
      browserIdNormalized: browserId,
      deviceFingerprint,
      ipAddress,
      ipHash,
      userAgent,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(browserLockRef, {
      studentId: student.studentId,
      studentName: student.name,
      voteId: studentDoc.id,
      browserIdNormalized: browserId,
      deviceFingerprint,
      ipAddress,
      ipHash,
      userAgent,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(deviceLockRef, {
      studentId: student.studentId,
      studentName: student.name,
      voteId: studentDoc.id,
      browserIdNormalized: browserId,
      deviceFingerprint,
      ipAddress,
      ipHash,
      userAgent,
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

  const [votesSnapshot, studentsSnapshot, browserLocksSnapshot, deviceLocksSnapshot] = await Promise.all([
    db.collection('votes').get(),
    db.collection('students').get(),
    db.collection('browserVoteLocks').get(),
    db.collection('deviceVoteLocks').get(),
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

  browserLocksSnapshot.docs.forEach((browserLockDoc) => {
    batch.delete(browserLockDoc.ref);
    queueOperation();
  });

  deviceLocksSnapshot.docs.forEach((deviceLockDoc) => {
    batch.delete(deviceLockDoc.ref);
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