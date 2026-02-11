/**
 * High-level PR commands.
 *
 * Implements the --create logic.
 */
const { getCurrentBranch, parseIssueFromBranch } = require('./git');
const { getIssueDetails, getRepoInfo } = require('./metadata');
const { gh } = require('./gh');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Creates a PR for the current branch.
 *
 * 1. Detects issue number from argument or branch name.
 * 2. Fetches issue metadata (title, labels, project).
 * 3. Constructs PR body (template + `Closes #N`).
 * 4. Creates PR via `gh pr create`.
 * 5. Applies labels and project (if any).
 */
function cmdCreate(opts) {
  const branch = getCurrentBranch();
  if (!branch) {
    console.error('Error: Not in a git repository or no current branch.');
    process.exit(1);
  }

  const issueNumber = opts.issue || parseIssueFromBranch(branch);
  if (!issueNumber) {
    console.error('Error: Could not determine issue number from branch name.');
    console.error('Please verify the branch name contains the issue number (e.g. feat/issue-123) or use --issue <N>.');
    process.exit(1);
  }

  // Get Repo Info
  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    console.error('Error: Could not determine repository info. Run `gh repo view` to check connection.');
    process.exit(1);
  }

  console.log(`\nContext: ${repoInfo.owner.login}/${repoInfo.name}`);
  console.log(`Branch: ${branch}`);
  console.log(`Linked Issue: #${issueNumber}`);

  // Fetch Metadata
  const issue = getIssueDetails(repoInfo.owner.login, repoInfo.name, issueNumber);
  let title = opts.title || (issue ? issue.title : branch);
  const labels = opts.label ? [opts.label] : (issue ? issue.labels : []);
  
  // Construct Body
  let baseBody = opts.body;
  if (!baseBody) {
    // Try to load template
    const templatePath = path.join(process.cwd(), '.github', 'pull_request_template.md');
    if (fs.existsSync(templatePath)) {
      baseBody = fs.readFileSync(templatePath, 'utf-8');
      // Replace placeholder if exists, otherwise append
      if (baseBody.includes('<!-- Issue Number -->')) {
        baseBody = baseBody.replace('<!-- Issue Number -->', issueNumber);
      } else {
        baseBody += `\n\nCloses #${issueNumber}`;
      }
    } else {
      baseBody = '<!-- Add description here -->\n\nCloses #' + issueNumber;
    }
  } else {
    baseBody += `\n\nCloses #${issueNumber}`;
  }

  const body = baseBody;

  console.log(`PR Title: "${title}"`);
  console.log(`Labels: ${labels.join(', ') || '(none)'}`);
  
  if (issue && issue.project) {
    console.log(`Project: ${issue.project.title} (will auto-add)`);
  }

  if (opts.dryRun) {
    console.log('\n[Dry Run] PR Create skipped.');
    console.log('Body Preview:\n---\n' + body + '\n---');
    return;
  }

  // Create PR
  console.log('\nCreating PR...');
  
  // Add --assignee @me
  let cmd = `pr create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" --assignee "@me"`;
  
  // Add labels to creation command
  if (labels.length > 0) {
    cmd += ` --label "${labels.join(',')}"`;
  }

  // Execute creation
  const prUrl = gh(cmd);
  if (!prUrl) {
    console.error('Failed to create PR.');
    process.exit(1);
  }

  console.log(`PR Created: ${prUrl}`);

  // Extract PR Number from URL
  const prNumberMatch = prUrl.match(/\/pull\/(\d+)$/);
  const prNumber = prNumberMatch ? prNumberMatch[1] : null;

  // Post-creation steps: Project Board
  if (issue && issue.project) {
    console.log(`Adding PR to project "${issue.project.title}"...`);
    try {
      gh(`project item-add ${issue.project.number} --owner "${repoInfo.owner.login}" --url "${prUrl}"`);
      console.log('Project item added.');
      
      // Update Status to "In Review" -> Use gh-projects skill!
      // We assume gh-projects skill is at .agent/skills/gh-projects/scripts/projects.js
      if (prNumber) {
        console.log('Setting status to "In Review"...');
        const projectsScript = path.join(process.cwd(), '.agent', 'skills', 'gh-projects', 'scripts', 'projects.js');
        if (fs.existsSync(projectsScript)) {
           // We use --issue but pass the PR number. projects.js (updated) now handles PRs basically as items with numbers.
           try {
             execSync(`node "${projectsScript}" --set --issue ${prNumber} --field Status --value "In review"`, { stdio: 'inherit' });
           } catch (e) {
             console.error('Failed to set status (non-fatal).');
           }
        } else {
           console.warn('gh-projects skill script not found, skipping status update.');
        }
      }

    } catch (err) {
      console.error('Failed to add to project (non-fatal).');
    }
  }
}

module.exports = { cmdCreate };
