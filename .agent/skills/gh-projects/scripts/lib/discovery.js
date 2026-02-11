/**
 * Auto-discovers GitHub project metadata from the current workspace.
 *
 * Resolves owner, repo name, and project number by matching the repository
 * name to a GitHub Project title. This eliminates hardcoded configuration
 * and lets the skill work across forks and renames automatically.
 *
 * Assumes: the GitHub Project title exactly matches the repository name
 * (e.g. repo "lofipulse" -> Project title "lofipulse").
 */
const { quotePS, gh } = require('./gh');

function getProjectMetadata() {
  // Pull owner and repo from the current git remote
  const owner = gh('repo view --json owner --jq ".owner.login"');
  const repo = gh('repo view --json name --jq ".name"');

  if (!owner || !repo) {
    console.error('Auto-Discovery Failed: Could not resolve repository metadata.');
    process.exit(1);
  }

  // Scan all projects for a title match against the repo name
  const projectsRaw = gh(`project list --owner ${quotePS(owner)} --format json`);
  if (!projectsRaw) {
    console.error(`Auto-Discovery Failed: Could not list projects for owner '${owner}'.`);
    process.exit(1);
  }

  const projects = JSON.parse(projectsRaw);
  const project = projects.projects.find(p => p.title === repo);

  if (!project) {
    console.error(`Auto-Discovery Failed: No GitHub Project found with title '${repo}' for owner '${owner}'.`);
    process.exit(1);
  }

  return { owner, repo, projectNumber: project.number, projectId: project.id };
}

module.exports = { getProjectMetadata };
