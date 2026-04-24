const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, 'src/Components/Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf-8');

// Read and show the button area for debugging
const match = content.match(/{student\.hasVoted &&[\s\S]*?Delete[\s\S]*?<\/button>/);
if (match) {
  console.log('Found button section');
}

// Fix 1: Replace the broken/incomplete conditional button
const brokenPattern = /{student\.hasVoted &&\s*\(\s*<button[\s\S]*?<\/button>\s*<\/button>/;
const newButton = `<button
                                onClick={() => handleResetStudentVote(student)}
                                disabled={isResettingStudentVote}
                                className="text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-70"
                              >
                                Reset
                              </button>

                              <button`;

content = content.replace(brokenPattern, newButton);
console.log('✅ Fixed button');

// Fix 2: Replace the try/catch block in handleResetStudentVote
const oldTry = `try {
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

const newTry = `try {
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

content = content.replace(oldTry, newTry);
console.log('✅ Updated try/catch');

fs.writeFileSync(adminPath, content);
console.log('✅ Complete!');
