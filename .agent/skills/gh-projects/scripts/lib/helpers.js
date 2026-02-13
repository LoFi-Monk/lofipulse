/**
 * Shared helpers for GitHub Projects V2.
 * 
 * This module provides central utilities for:
 * 1. Caching GitHub Project metadata (schema & items) to reduce API latency.
 * 2. Mapping human-readable field values to GitHub CLI flags/options.
 * 3. Atomic execution of field updates.
 * 
 * These helpers are designed to be reused across both 'core' (CRUD) and 
 * 'composite' (Agent-First) commands to ensure consistent behavior.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { gh, runGraphQL, quotePS } = require('./gh');

// The cache file is stored in a hidden directory in the workspace to allow 
// persistence across different command invocations while avoiding git pollution.
const CACHE_FILE = path.resolve(process.cwd(), '.agent', '.cache_project_schema.json');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute cache lifespan

/**
 * Fetches all project items and field definitions in a single round-trip.
 * 
 * This is the primary optimization for high-speed board operations. It 
 * aggressively caches the project schema and item list to avoid 
 * redundant GraphQL queries during batch updates (like grooming or blueprints).
 * 
 * @param {Object} meta - Discovery metadata { owner, projectNumber, ... }
 * @param {Boolean} noCache - If true, ignores existing cache and fetches fresh data.
 * @returns {Object|null} The ProjectV2 node or null if not accessible.
 */
function fetchProjectData(meta, noCache = false) {
  // Check cache first if not explicitly disabled
  try {
    if (!noCache && fs.existsSync(CACHE_FILE)) {
      const stats = fs.statSync(CACHE_FILE);
      const isFresh = (Date.now() - stats.mtimeMs) < CACHE_TTL_MS;
      if (isFresh) {
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      }
    }
  } catch (e) {
    // Fallback to fresh fetch on any cache error
  }

  // Comprehensive query for IDs, fields, and existing items
  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue { number }
                ... on PullRequest { number }
              }
            }
          }
          fields(first: 30) {
            nodes {
              ... on ProjectV2Field { id name }
              ... on ProjectV2IterationField { id name }
              ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
              }
            }
          }
        }
      }
    }
  `;

  const result = runGraphQL(query, { owner: meta.owner, number: meta.projectNumber });
  const project = result?.data?.user?.projectV2 || null;

  // Persist fresh data to disk for future commands
  if (project) {
    try {
      const dir = path.dirname(CACHE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CACHE_FILE, JSON.stringify(project, null, 2));
    } catch (e) {
      // Non-fatal if we can't write cache
    }
  }

  return project;
}

/**
 * Resolves a field name and value to its specific GitHub CLI flag and ID.
 * 
 * GitHub Projects uses several property types (Iteration, SingleSelect, 
 * Text, Number). This helper identifies the field type and resolves 
 * Select Option names to their requisite internal IDs.
 * 
 * @param {Object} field - The field definition from fetchProjectData
 * @param {String} value - The human-readable value to set
 * @returns {Object|null} { flag, value } for GH CLI, or null if value invalid.
 */
function buildFieldCLIArgs(field, value) {
  // Single Select requires mapping the name to a specific option ID
  if (field.options) {
    const option = field.options.find(o => o.name === value);
    if (!option) return null;
    return { flag: '--single-select-option-id', value: option.id };
  }
  // Default to text-based value for standard fields
  return { flag: '--text', value };
}

/**
 * Executes a 'project item-edit' command for a single field via CLI.
 * 
 * We prefer the CLI over GraphQL mutations for updates where possible 
 * to leverage the CLI's standard success/failure handling and escaping.
 * 
 * @returns {Boolean} True if update succeeded.
 */
function updateField(projectId, itemId, fieldId, cliArgs) {
  const res = gh(`project item-edit --id ${itemId} --project-id ${projectId} --field-id ${fieldId} ${cliArgs.flag} ${quotePS(cliArgs.value)}`);
  return res !== null;
}

/**
 * Deletes the project metadata cache to force a refresh on the next command.
 * Called automatically after any mutation that changes the board state.
 */
function invalidateCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
  } catch (e) {
    // Ignore if file already gone
  }
}

module.exports = {
  fetchProjectData,
  buildFieldCLIArgs,
  updateField,
  invalidateCache
};
