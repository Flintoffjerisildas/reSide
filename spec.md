# Specification

## Summary
**Goal:** Make local development self-contained by documenting and configuring the project so local dependency artifacts (frontend and local replica/canister artifacts) live inside the repository folder.

**Planned changes:**
- Add a new English local development guide (e.g., `LOCAL_DEV.md` / `README-local.md`) with copy-paste commands to install DFX, start the local replica, deploy canisters, install frontend dependencies, and run the frontend dev server.
- Document exactly where artifacts are created on disk (e.g., `node_modules`, project-local package manager store/cache, `.dfx`) and how to configure them to stay within the project directory.
- Add/update repo-checked-in package manager configuration to force a project-local dependency store/cache directory (e.g., a `.pnpm-store` under the repo) and document the install commands that use it.
- Add a repo-root runnable verification script under `scripts/` that checks for required tools (DFX, Node, package manager) and the expected project-local directories (e.g., `.dfx`, frontend dependency directories), exiting non-zero with actionable instructions when missing and zero with a success summary when present.
- Include a troubleshooting section in the local development guide covering common local setup failures (missing DFX, missing Node/pnpm, canister deploy failures).

**User-visible outcome:** A developer can follow a single local guide to run the app locally while keeping dependency caches/stores and replica/canister artifacts inside the project folder, and can run one script to verify prerequisites and local directories are set up correctly.
