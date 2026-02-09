/**
 * @fileoverview Standard Skill Logger
 * 
 * INSTRUCTIONS FOR AGENTS:
 * This script is the PRIMARY way to log execution results.
 * It is self-documenting. Run it without arguments to see the instructions.
 */
const fs = require('fs');
const path = require('path');

// --- 1. HELP MODE CHECK ---
// If no arguments or help flag, print instructions and exit.
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
================================================================================
SKILL LOGGER INSTRUCTIONS
================================================================================

For complete logging policy and examples, see:
.agent/rules/skill-logging-policy.md

COMMAND FORMAT:
  node .agent/logging/logger.js --skill "<Name>" --status "<Status>" --message "<Details>" [--comment "<Suggestions>"]

ARGUMENTS:
  --skill     (Required) The specific name of the skill you just ran (e.g., "mermaid-validator")
  --status    (Required) The outcome: "Success", "Failed", "Fixed Error", etc.
  --message   (Required) A concise summary of what happened. 
              IMPORTANT: If status is "Failed", you MUST explain why here.
  --comment   (Optional) Suggestions for improving the skill or process. 
              Use this to streamline future executions.

================================================================================
`);
    process.exit(0);
}

// --- 2. ARGUMENT PARSING ---
const getArg = (name) => {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : 'Unknown';
};

const skill = getArg('--skill');
const status = getArg('--status');
const message = getArg('--message');
const comment = getArg('--comment'); // Optional

// --- 3. CONFIGURATION ---
// Log location: .agent/logging/skill-logs.md
// We resolve relative to this script: .agent/logging/logger.js -> ./skill-logs.md
const logFilePath = path.resolve(__dirname, 'skill-logs.md');

// Ensure directory exists
const logDir = path.dirname(logFilePath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// --- 4. DATA PREPARATION ---
const timestamp = new Date().toISOString();

// Helper to escape pipes for Markdown table
const safe = (str) => (str || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

const safeSkill = safe(skill);
const safeStatus = safe(status);
const safeMessage = safe(message);
const safeComment = comment === 'Unknown' ? '' : safe(comment); // Keep empty if not provided

// --- 5. LOGGING ---
const HEADER_LINE = '| Timestamp | Skill | Status | Message | Comment |';
const SEPARATOR_LINE = '|-----------|-------|--------|---------|---------|';

// Check if we need to initialize or migrate the file
let fileContent = '';
if (fs.existsSync(logFilePath)) {
    fileContent = fs.readFileSync(logFilePath, 'utf8');
}

// If file is empty or doesn't exist, write new header
if (!fileContent.trim()) {
    fs.writeFileSync(logFilePath, `${HEADER_LINE}\n${SEPARATOR_LINE}\n`, 'utf8');
} 
// Simple migration check: if the header doesn't contain "Comment", we might want to just append to it
// But appending columns to existing rows is hard. 
// For LoFi simplicity, we will just proceed. Markdown renders uneven tables fine usually.
// Or we could detect if the first line matches our new header.
else {
    const firstLine = fileContent.split('\n')[0];
    if (!firstLine.includes('Comment')) {
        // Legacy header detected. Let's just append a note or start a new table? 
        // Simplest: Just append the new row. Markdown readers interpret mismatching columns as empty cells usually.
        // Or we can be nice and rewrite the header row? No, that breaks the data rows below.
        // We will just accept the schema drift for old logs.
    }
}

const logEntry = `| ${timestamp} | ${safeSkill} | ${safeStatus} | ${safeMessage} | ${safeComment} |\n`;

try {
  fs.appendFileSync(logFilePath, logEntry, 'utf8');
  console.log('Log entry added successfully.');
} catch (err) {
  console.error('Error writing to log file:', err);
  process.exit(1);
}
