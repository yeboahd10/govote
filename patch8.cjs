const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, 'src/Components/Admin.jsx');
let content = fs.readFileSync(adminPath, 'utf-8');

// Find and replace the entire broken button section
const pattern = /{student\.hasVoted && \(\s*<button[\s\S]*?Reset[\s\S]*?<\/button>\s*<button/;
const replacement = `<button
                                onClick={() => handleResetStudentVote(student)}
                                disabled={isResettingStudentVote}
                                className="text-blue-600 hover:text-blue-800 font-semibold disabled:opacity-70"
                              >
                                Reset
                              </button>
                              <button`;

content = content.replace(pattern, replacement);

// Remove stray closing parenthesis that was left behind
content = content.replace(/\s+\}\)\s+<button/, `\n                              <button`);

fs.writeFileSync(adminPath, content);
console.log('✅ Fixed button rendering!');
