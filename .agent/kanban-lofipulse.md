---
config:
  kanban:
    ticketBaseUrl: "https://github.com/LoFi-Monk/lofipulse/issues/#TICKET#"
---

# Project Kanban

```mermaid
kanban
  backlog
    [Monorepo Foundation]@{ ticket: '#2', priority: 'High' }
    [Config Package]@{ ticket: '#3', priority: 'High' }
    [Harness Runtime]@{ ticket: '#4', priority: 'Med' }
    [Pi SDK Integration]@{ ticket: '#5', priority: 'Med' }
    [CLI REPL]@{ ticket: '#6', priority: 'Low' }
  todo
  in-progress
    [Project Init & CI]@{ ticket: '#1', assigned: 'Lead Developer', priority: 'High' }
  blocked
  review
  done
    [Setup Repo]
    [Setup Lofi Gate]
    [Create Project Manager Skill]
    [Define Team Structure]
    [Update Personas]
    [Create Runbooks]
  archive
```
