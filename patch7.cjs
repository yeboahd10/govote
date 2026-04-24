const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, 'src/Components/Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf-8');

// Fix the broken button structure
content = content.replace(
  `{student.hasVoted && (
                                <button
                                  onClick={() => handleResetStudentVote(student)}
                                  disabled={isResettingStudentVote}
                                  className="text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-70"
                                >
                                  Reset
                                </button>

                              <button`,
  `<button
                                onClick={() => handleResetStudentVote(student)}
                                disabled={isResettingStudentVote}
                                className="text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-70"
                              >
                                Reset
                              </button>
                              <button`
);

console.log('✅ Fixed Reset button to show for all students');

// Also fix the missing closing brace in the function
content = content.replace(
  `    }

  const handleRepairStudentData = async () => {`,
  `    }
  }

  const handleRepairStudentData = async () => {`
);

console.log('✅ Fixed missing closing brace');

fs.writeFileSync(adminPath, content);
console.log('✅ All fixes complete!');
