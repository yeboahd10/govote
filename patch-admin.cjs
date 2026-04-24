const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, 'src/Components/Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf-8');

// Find and replace the handleResetStudentVote function
const startPattern = 'const handleResetStudentVote = async (student) => {\n    if (isResettingStudentVote) {\n      return\n    }\n\n    const confirmed = window.confirm(`Reset vote for ${student.name}? They will be able to vote again.`)';

const replacement = `const handleResetStudentVote = async (student) => {
    if (isResettingStudentVote) {
      return
    }

    const statusText = student.hasVoted ? 'reset vote' : 'clear vote locks'
    const confirmed = window.confirm(\`Are you sure you want to \${statusText} for \${student.name}? They will be able to vote again.\`)`;

content = content.replace(startPattern, replacement);

// Now replace the try block inside the function
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
    }
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
    }
  }`;

content = content.replace(oldTryBlock, newTryBlock);

// Now remove the condition from the JSX button - make Reset show for all students
const oldButtonCondition = `                              {student.hasVoted && (
                                <button
                                  onClick={() => handleResetStudentVote(student)}
                                  disabled={isResettingStudentVote}
                                  className="text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-70"
                                >
                                  Reset
                                </button>
                              )}`;

const newButtonCondition = `                              <button
                                onClick={() => handleResetStudentVote(student)}
                                disabled={isResettingStudentVote}
                                className="text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-70"
                              >
                                Reset
                              </button>`;

content = content.replace(oldButtonCondition, newButtonCondition);

fs.writeFileSync(adminPath, content);
console.log('✅ Updated Admin.jsx successfully!');
