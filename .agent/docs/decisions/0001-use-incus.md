---
status: Approved
date: 2026-02-08
decision-makers: [LofiMonk, CTO Persona]
consulted: [DeepWiki Research]
---

# 1. Use Incus for Agent Containers for LofiPulse

## Context and Problem Statement

We need a container technology to run potentially unsafe Agent code.
We evaluated **Docker** (the standard) vs **Incus** (system containers).

The key requirements are:

1.  **Persistence**: Agents need a "Home" that feels like a real machine, retaining files and state across reboots.
2.  **Safety**: We need to run "Sub-Agents" (Docker inside Agent) without exposing the Host OS to root risks.
3.  **Resource Efficiency**: We want to run 10-50 agents on a single developer machine (WSL2).

## Considered Options

- **Docker Containers**: Standard application containers.
  - _Pros:_ Ubiquitous, easy to start.
  - _Cons:_ Ephemeral (state is lost on restart), Root-by-default (security risk), Nesting (`dind`) is insecure (`--privileged`).
- **Incus (LXD Fork)**: System containers.
  - _Pros:_ Persistent (like a VM), Unprivileged by default (safe), Native nesting support.
  - _Cons:_ Higher learning curve than Docker Desktop.

## Decision Outcome

Chosen option: **Incus**, because it provides the "Persistent Identity" and "Safety Sandbox" required for the "LofiPulse OS" vision.

### Positive Consequences

- **Safety:** We can safely nest Docker inside Incus agents.
- **Persistence:** Agents behave like "Digital Employees" with their own persistent computers.
- **Performance:** 10x RAM efficiency vs running separate WSL instances.
- **Permission Sanity:** Incus uses **UID Shifting (ID Maps)**. Files mounted from the Host are seen as `root` inside the container but remain owned by the `User` on the host, solving the "Docker Root File Permission" hell.

### Negative Consequences

- **System Dependency:** Incus is a Daemon (Service), not a library. It cannot be "bundled" inside an app folder. It must be installed on the User's machine (at the OS/Kernel level).
  - _Mitigation:_ See [Distribution Strategy](#distribution--trust-strategy) below.

## Distribution & Trust Strategy

To solve the "System Dependency" and "Trust" problems on Windows:

1.  **The "Pre-Cooked" Bundle (Convenience)**
    - We provide a **Custom WSL Distro Image** (`lofipulse-os.tar.gz`) hosted on **GitHub Releases**.
    - The Installer imports this image, giving the user a "One-Click" setup experience.

2.  **The Open Recipe (Transparency)**
    - We publish the **Source Build Script** (e.g., `build-image.sh`) in this repository.
    - **Trust:** Users verify the script to ensure no malicious code is added.
    - **Verify:** "Paranoid" users can run the script themselves to build the identical image from scratch.

## Links

- [Incus Research Notes](../plans/incus-research.md)
