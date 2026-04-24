const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, 'src/Components/Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf-8');

// Replace the conditional Reset button to show for all students
const oldButton = `{student.hasVoted && (
                                <button
                                  onClick={() => handleResetStudentVote(student)}
                                  disabled={isResettingStudentVote}
                                  className="text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-70"
                                >
                                  Reset
                                </button>
                              )}`;

const newButton = `<button
                                onClick={() => handleResetStudentVote(student)}
                                disabled={isResettingStudentVote}
                                className="text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-70"
                              >
                                Reset
                              </button>`;

if (content.includes(oldButton)) {
  content = content.replace(oldButton, newButton);
  console.log('✅ Updated button to show for all students');
} else {
  console.log('⚠️  Button pattern not found');
}

// Update the handler function
const oldFunc = `const handleResetStudentVote = async (student) => {
    if (isResettingStudentVote) {
      return
    }

    const confirmed = window.confirm(\`Reset vote for \${student.name}? They will be able to vote again.\`)

    if (!confirmed) {
      return
    }

    setVoterMessage('')
    setIsResettingStudentVote(true)

    try {
      const resetStudentVote = httpsCallable(functions, 'resetStudentVote')
      await resetStudentVote({ studentId: student.studentId })
      setVoterMessage(\`Vote reset for \${student.name}. They can vote again now.\`)
      await loadStudents()
    } catch (resetError) {
      console.error('Failed to reset vote:', resetError)
      setVoterMessage(\`Failed to reset vote: \${resetError.message}\`)
    } finally {
      setIsResettingStudentVote(false)
    }
  }`;

const newFunc = `const handleResetStudentVote = async (student) => {
    if (isResettingStudentVote) {
      return
    }

    const statusText = student.hasVoted ? 'reset vote' : 'clear vote locks'
    const confirmed = window.confirm(\`Are you sure you want to \${statusText} for \${student.name}? They will be able to vote again.\`)

    if (!confirmed) {
      return
    }

    setVoterMessage('')
    setIsResettingStudentVote(true)

    try {
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
    }
  }`;

if (content.includes(oldFunc)) {
  content = content.replace(oldFunc, newFunc);
  console.log('✅ Updated handleResetStudentVote function');
} else {
  console.log('⚠️  Function pattern not found - checking for partial match');
  if (content.includes('const handleResetStudentVote')) {
    console.log('   Function exists but pattern may differ');
  }
}

fs.writeFileSync(adminPath, content);
console.log('✅ Patch complete!');
