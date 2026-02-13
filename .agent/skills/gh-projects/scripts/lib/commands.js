/**
 * Aggregator for GitHub Projects V2 Commands.
 * 
 * This file serves as the primary entry point for the skill, aggregating
 * functionality from specialized modules:
 * - helpers: Shared caching and API utilities.
 * - core: Basic board management (Pulse, Add, Set, Groom, List).
 * - composite: High-level agent workflows (Epic, Blueprint, Ship, ReadTree).
 * 
 * This modular structure ensures the codebase remains maintainable as we 
 * add more advanced agent-first capabilities.
 */

const core = require('./commands/core');
const composite = require('./commands/composite');

// Export all commands as a flat object to maintain compatibility with 
// the existing projects.js CLI entry point.
module.exports = {
  ...core,
  ...composite
};
