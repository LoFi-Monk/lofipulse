---
config:
  kanban:
    ticketBaseUrl: "https://github.com/LoFi-Monk/lofipulse/issues/#TICKET#"
---

# Project Kanban

```mermaid
kanban
  backlog
    [Config Package]@{ ticket: '#3', priority: 'P1' }
    [Harness Runtime]@{ ticket: '#4', priority: 'P2' }
    [Pi SDK Integration]@{ ticket: '#5', priority: 'P2' }
    [CLI REPL]@{ ticket: '#6', priority: 'P2' }
    [Setup Turborepo]@{ ticket: '#11', priority: 'P1' }
    [Configure Secretlint]@{ ticket: '#8', priority: 'P2' }
    [Implement EARS Method Skill]@{ ticket: '#13', priority: 'P1' }
    [Implement Mandatory Metadata]@{ ticket: '#15', priority: 'P1' }
  todo
  in-progress
  blocked
  review
  done
    [Spike: Advanced GitHub Projects Skill]@{ ticket: '#12', assigned: 'Lead Developer', priority: 'P1' }
    [Monorepo Foundation]@{ ticket: '#2', assigned: 'Lead Developer', priority: 'P1' }
    [Project Initialization & CI Setup]@{ ticket: '#1', assigned: 'Lead Developer', priority: 'P1' }
  archive
    [Infra & Gate Cleanup]@{ ticket: '#10', assigned: 'Lead Developer', priority: 'P2' }
    [Fix YouTube Transcript Bugs]@{ ticket: '#9', assigned: 'Lead Developer', priority: 'P1' }
    [Update Personas]
    [Create Runbooks]
```
