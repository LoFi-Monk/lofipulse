---
title: [Runbook Title]
service: [Service Name]
owners: [@user]
---

# Runbook: [Title]

> **Trigger:** [Alert Name] or [Symptom]

## 1. Overview

What is this alert/symptom? Is it critical?

## 2. Initial Assessment (Triage)

- **Severity Check:** Is the system down or just degraded?
- **Impact:** Who is affected?

## 3. Investigation

Steps to diagnose the root cause.

1. Check logs in `Laufey` or console.
2. Verify `[Service]` status.
3. Run diagnostic command:
   ```bash
   npm run diagnose
   ```

## 4. Remediation

**Common Fixes:**

- **Restart Service:**
  ```bash
  docker restart [container]
  ```
- **Clear Cache:** ...

## 5. Escalation

If unable to resolve in 30 minutes, contact: [Role/Person]
