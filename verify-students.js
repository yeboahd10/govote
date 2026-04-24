import admin from 'firebase-admin';

admin.initializeApp({
  projectId: 'govote-f644d',
});

const db = admin.firestore();

async function verifyAndFixStudents() {
  console.log('🔍 Verifying students collection...\n');

  const studentsSnapshot = await db.collection('students').get();
  console.log(`Total students: ${studentsSnapshot.size}`);

  const studentsMissingHasVoted = [];
  const studentsWithInconsistentData = [];

  // Check each student
  for (const studentDoc of studentsSnapshot.docs) {
    const data = studentDoc.data();
    const hasVotedField = data.hasVoted;

    if (hasVotedField === undefined || hasVotedField === null) {
      studentsMissingHasVoted.push({
        id: studentDoc.id,
        name: data.name,
        studentId: data.studentId,
      });
    }

    // Check if hasVoted is true but no corresponding vote record exists
    if (data.hasVoted === true) {
      const voteExists = await db.collection('votes').doc(studentDoc.id).get();
      if (!voteExists.exists) {
        studentsWithInconsistentData.push({
          id: studentDoc.id,
          name: data.name,
          studentId: data.studentId,
          issue: 'hasVoted=true but no vote record found',
        });
      }
    }
  }

  console.log(
    `\n⚠️  Students missing 'hasVoted' field: ${studentsMissingHasVoted.length}`
  );
  if (studentsMissingHasVoted.length > 0 && studentsMissingHasVoted.length <= 20) {
    studentsMissingHasVoted.forEach((s) => {
      console.log(
        `  - ${s.name} (ID: ${s.studentId}) [Doc: ${s.id}]`
      );
    });
  }

  console.log(
    `\n⚠️  Students with inconsistent data: ${studentsWithInconsistentData.length}`
  );
  if (studentsWithInconsistentData.length > 0 && studentsWithInconsistentData.length <= 20) {
    studentsWithInconsistentData.forEach((s) => {
      console.log(
        `  - ${s.name} (ID: ${s.studentId}) — ${s.issue}`
      );
    });
  }

  // Option to fix
  if (studentsMissingHasVoted.length > 0 || studentsWithInconsistentData.length > 0) {
    console.log('\n🔧 Attempting to fix...\n');

    let batch = db.batch();
    let operations = 0;
    const commits = [];

    // Fix students missing hasVoted
    for (const student of studentsMissingHasVoted) {
      const studentDoc = db.collection('students').doc(student.id);
      batch.update(studentDoc, {
        hasVoted: false,
        status: 'Not Voted',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      operations++;
      if (operations === 450) {
        commits.push(batch.commit());
        batch = db.batch();
        operations = 0;
      }
    }

    // Fix students with inconsistent data (hasVoted=true but no vote)
    for (const student of studentsWithInconsistentData) {
      const studentDoc = db.collection('students').doc(student.id);
      batch.update(studentDoc, {
        hasVoted: false,
        status: 'Not Voted',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      operations++;
      if (operations === 450) {
        commits.push(batch.commit());
        batch = db.batch();
        operations = 0;
      }
    }

    if (operations > 0) {
      commits.push(batch.commit());
    }

    await Promise.all(commits);
    console.log('✅ Fixed all inconsistent records!');
  } else {
    console.log('\n✅ All students have correct hasVoted field!');
  }

  process.exit(0);
}

verifyAndFixStudents().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
