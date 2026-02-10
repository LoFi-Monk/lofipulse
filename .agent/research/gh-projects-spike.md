# Research: GitHub Projects Spike (CLI vs. GraphQL)

## Overview

The goal is to eliminate 'Mermaid Sync Friction' by establishing a dynamic source of truth from GitHub Projects V2.

## Comparison

| Feature            | `gh project` CLI / Extensions                           | GitHub GraphQL API                             |
| :----------------- | :------------------------------------------------------ | :--------------------------------------------- |
| **Setup**          | Easy, familiar for humans.                              | Requires crafting complex queries.             |
| **Dependencies**   | Requires `gh` and potentially third-party extensions.   | Requires only `gh` (to run the query).         |
| **Reliability**    | Extensions can break or change output formats.          | Immutable API schema (mostly).                 |
| **Performance**    | Can be slow due to multiple calls per item.             | Fetch everything in a single batch query.      |
| **Data Structure** | Often returns text/tables; needs parsing (regex).       | Returns structured JSON; easy for code/agents. |
| **Custom Fields**  | Supported but can be verbose to retrieve for all items. | Seamlessly integrated into query nodes.        |

## Technical Decision: GraphQL

As the **Lead Developer**, I recommend using **GraphQL** via the `gh api graphql` command.

**Reasoning:**

1. **Determinism:** Agents work best with predictable JSON. CLI extensions often output human-readable tables that are brittle to parse.
2. **Efficiency:** A single GraphQL query can hydrate the entire state of the project board, whereas CLI commands might require N+1 calls to get custom field values for N items.
3. **No External Bloat:** We avoid requiring the user to install unofficial extensions like `heaths/gh-projects` or `yahsan2/gh-pm`.

## Prototype GraphQL Query

```graphql
query ($owner: String!, $number: Int!) {
  user(login: $owner) {
    projectV2(number: $number) {
      items(first: 20) {
        nodes {
          id
          content {
            ... on Issue {
              title
              number
              state
              url
            }
          }
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2FieldCommon {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldTextValue {
                text
                field {
                  ... on ProjectV2FieldCommon {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldDateValue {
                date
                field {
                  ... on ProjectV2FieldCommon {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Mapping to Agent Context

The agent should be able to run a "pulse" command that:

1. Executes the above query.
2. Processes the JSON into an actionable "Queue" format.
3. Identifies items assigned to the current persona.
