/**
 * High-level PR commands.
 *
 * Implements the --create logic.
 */
const { getCurrentBranch, parseIssueFromBranch } = require('./git');
const { getIssueDetails, getRepoInfo } = require('./metadata');
const { gh } = require('./gh');

/**
 * Creates a PR for the current branch.
 *
 * 1. Detects issue number from argument or branch name.
 * 2. Fetches issue metadata (title, labels, project).
 * 3. Constructs PR body with "Closes #N".
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
  const baseBody = opts.body || '<!-- Add description here -->';
  const body = `${baseBody}\n\nCloses #${issueNumber}`;

  console.log(`PR Title: "${title}"`);
  console.log(`PR Body: Closes #${issueNumber}`);
  console.log(`Labels: ${labels.join(', ') || '(none)'}`);
  
  if (issue && issue.project) {
    console.log(`Project: ${issue.project.title} (will auto-add)`);
  }

  if (opts.dryRun) {
    console.log('\n[Dry Run] PR Create skipped.');
    return;
  }

  // Create PR
  console.log('\nCreating PR...');
  // Note: we don't pass labels/project to `gh pr create` directly because
  // we want to ensure we handle failures gracefully and maybe the CLI doesn't support
  // project-item-add in the same call (it supports --project, but reliable item-add is better).
  // Actually, `gh pr create` supports `--label` and `--project`. 
  // But inheriting from issue is the key.
  
  let cmd = `pr create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}"`;
  
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

  // Post-creation steps: Project Board
  // We use `gh pr create --project` if possible, but let's do it explicitly to be safe
  // and handle "ProjectV2" vs "Classic" confusion automatically if we use our `gh-projects` skill logic.
  // For now, let's use `gh project item-add` if we have a project ID.
  
  if (issue && issue.project) {
    console.log(`Adding PR to project "${issue.project.title}"...`);
    // Need the PR URL or Number. `prUrl` is typically the URL.
    try {
      gh(`project item-add ${issue.project.number} --owner "${repoInfo.owner.login}" --url "${prUrl}"`);
      console.log('Project item added.');
    } catch (err) {
      console.error('Failed to add to project (non-fatal).');
    }
  }
}

module.exports = { cmdCreate };
