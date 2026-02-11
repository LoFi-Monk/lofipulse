/**
 * GitHub Metadata helpers.
 *
 * Fetches issue details to populate PR metadata.
 */
const { runGraphQL, gh } = require('./gh');

/**
 * Fetches title, labels, and project info for a given issue.
 *
 * @param {string} owner - Repo owner
 * @param {string} repo - Repo name
 * @param {number} issueNumber
 * @returns {object|null} { title, labels: string[], project: { id, title } }
 */
function getIssueDetails(owner, repo, issueNumber) {
  const query = `
    query($owner: String!, $repo: String!, $issueNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $issueNumber) {
          title
          labels(first: 10) {
            nodes {
              name
            }
          }
          projectItems(first: 5) {
            nodes {
              project {
                id
                title
                number
              }
            }
          }
        }
      }
    }
  `;

  const result = runGraphQL(query, { owner, repo, issueNumber });
  if (!result?.data?.repository?.issue) return null;

  const issue = result.data.repository.issue;
  
  // Extract labels
  const labels = issue.labels.nodes.map(n => n.name);

  // Extract first project (heuristically the "main" one)
  const projectItem = issue.projectItems.nodes[0];
  const project = projectItem ? projectItem.project : null;

  return {
    title: issue.title,
    labels,
    project
  };
}

/**
 * Gets the current repo owner and name.
 * Uses `gh repo view` to be robust against remotes.
 */
function getRepoInfo() {
  try {
    const json = gh('repo view --json owner,name');
    if (!json) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}

module.exports = { getIssueDetails, getRepoInfo };
