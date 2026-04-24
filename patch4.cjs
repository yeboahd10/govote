const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, 'src/Components/Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf-8');

// 1. Update the handler function - look for the try block and replace it
const oldTryBlock = `    try {
      const resetStudentVote = httpsCallable(functions, 'resetStudentVote')
      await resetStudentVote({ studentId: student.studentId })
      setVoterMessage(\`Vote reset for \${student.name}. They can vote again now.\`)
      await loadStudents()
    } catch (resetError) {
      console.error('Failed to reset vote:', resetError)
      setVoterMessage(\`Failed to reset vote: \${resetError.message}\`)
    } finally {
      setIsResettingStudentVote(false)
    }`;

const newTryBlock = `    try {
      if (student.hasVoted) {
        // Student has voted: call resetStudentVote to clear vote and locks
        const resetStudentVote = httpsCallable(functions, 'resetStudentVote')
        await resetStudentVote({ studentId: student.studentId })
        setVoterMessage(\`Vote reset for \${student.name}. They can vote again now.\`)
      } else {
        // Student hasn't voted: call clearStudentVoteLocks to just clear locks
        const clearStudentVoteLocks = httpsCallable(functions, 'clearStudentVoteLocks')
        const result = await clearStudentVoteLocks({ studentId: student.studentId })
        setVoterMessage(\`Cleared \${result.data.locksCleared} vote lock(s) for \${student.name}. They can now vote.\`)
      }
      await loadStudents()
    } catch (resetError) {
      console.error('Failed to reset:', resetError)
      setVoterMessage(\`Failed to reset: \${resetError.message}\`)
    } finally {
      setIsResettingStudentVote(false)
    }`;

content = content.replace(oldTryBlock, newTryBlock);
console.log('✅ Updated try/catch block');

// 2. Update the confirmation message
const oldConfirm = `const confirmed = window.confirm(\`Reset vote for \${student.name}? They will be able to vote again.\`)`;
const newConfirm = `const statusText = student.hasVoted ? 'reset vote' : 'clear vote locks'
    const confirmed = window.confirm(\`Are you sure you want to \${statusText} for \${student.name}? They will be able to vote again.\`)`;

content = content.replace(oldConfirm, newConfirm);
console.log('✅ Updated confirmation message');

// 3. Remove the condition from the button
content = content.replace(
  `{student.hasVoted && (
                                <button`,
  `<button`
);
console.log('✅ Removed hasVoted condition from button opening');

// 4. Remove the closing parenthesis and condition
content = content.replace(
  `                              )}`,
  ``
);
console.log('✅ Removed condition closing from button');

fs.writeFileSync(adminPath, content);
console.log('\n✅ All updates complete!');
