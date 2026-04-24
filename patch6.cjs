const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, 'src/Components/Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf-8');

// Simple line-by-line replacement for the try block
const lines = content.split('\n');
let inResetFunction = false;
let inTryBlock = false;
let tryBlockStart = -1;
let tryBlockEnd = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const handleResetStudentVote = async (student) => {')) {
    inResetFunction = true;
  }

  if (inResetFunction && lines[i].trim() === 'try {') {
    inTryBlock = true;
    tryBlockStart = i;
  }

  if (inTryBlock && lines[i].trim() === '}' && tryBlockEnd === -1) {
    // Check if this is the closing brace of the finally block
    if (i > 0 && lines[i - 1].trim().endsWith('}')) {
      tryBlockEnd = i;
      break;
    }
  }
}

if (tryBlockStart !== -1 && tryBlockEnd !== -1) {
  console.log(`Found try block from line ${tryBlockStart} to ${tryBlockEnd}`);
  
  // Replace the try block
  const newTryBlock = [
    '    try {',
    '      if (student.hasVoted) {',
    '        // Student has voted: call resetStudentVote to clear vote and locks',
    '        const resetStudentVote = httpsCallable(functions, \'resetStudentVote\')',
    '        await resetStudentVote({ studentId: student.studentId })',
    '        setVoterMessage(`Vote reset for ${student.name}. They can vote again now.`)',
    '      } else {',
    '        // Student hasn\'t voted: call clearStudentVoteLocks to just clear locks',
    '        const clearStudentVoteLocks = httpsCallable(functions, \'clearStudentVoteLocks\')',
    '        const result = await clearStudentVoteLocks({ studentId: student.studentId })',
    '        setVoterMessage(`Cleared ${result.data.locksCleared} vote lock(s) for ${student.name}. They can now vote.`)',
    '      }',
    '      await loadStudents()',
    '    } catch (resetError) {',
    '      console.error(\'Failed to reset:\', resetError)',
    '      setVoterMessage(`Failed to reset: ${resetError.message}`)',
    '    } finally {',
    '      setIsResettingStudentVote(false)',
    '    }',
  ];
  
  lines.splice(tryBlockStart, tryBlockEnd - tryBlockStart + 1, ...newTryBlock);
  const newContent = lines.join('\n');
  fs.writeFileSync(adminPath, newContent);
  console.log('✅ Updated try/catch block!');
} else {
  console.log('⚠️  Could not find try block');
}
