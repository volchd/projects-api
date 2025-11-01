# Projects Platform Workspace

This repository now hosts both the serverless API and the upcoming UI inside an npm workspaces layout.

## Structure
- `apps/api` — the existing Serverless + Node.js backend (moved from the old repo root).
- `apps/ui` — placeholder for the new web client (scaffold your preferred framework here).
- `packages` — optional shared libraries (types, utilities) consumed by the apps.

## Getting Started
Install dependencies for every workspace:
```bash
npm install
```

### API
```bash
npm run dev:api
```
Rerun any of the original backend scripts from inside `apps/api` or through `npm --workspace apps/api`.

### UI
A UI workspace is ready at `apps/ui`. Scaffold your chosen stack (e.g. Next.js, Vite) and expose a `dev` script to integrate with the root runners.

## Useful Commands
- `npm run dev` — runs `dev` in every workspace that defines it.
- `npm run build` — builds all workspaces.
- `npm run test` — executes test suites across the monorepo.

## Notes
- Existing DynamoDB/local development instructions for the API now live in `apps/api/README.md`.
- After restructuring, regenerate lockfiles by running `npm install` at the root (creates a workspace-aware `package-lock.json`).
