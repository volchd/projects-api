# Projects Platform Workspace

This repository bundles the Serverless API and the Vite + React UI inside an npm workspaces layout. Workspaces keep each surface isolated while allowing shared tooling and types.

## Structure
- `apps/api` — the existing Serverless + Node.js backend (moved from the old repo root).
- `apps/ui` — Vite + React client that talks to the Serverless API.
- `packages` — optional shared libraries (types, utilities) consumed by the apps.

## Getting Started
Install dependencies for every workspace:
```bash
npm install
```

### Local Development
Run the API (Serverless offline) in one terminal:
```bash
npm run dev:api
```

Run the UI (Vite dev server) in another terminal:
```bash
npm run dev:ui
```
Both commands can also be executed from within their workspaces via `npm install` followed by `npm run dev`, but using the root scripts keeps the workspace context consistent.

> Tip: `npm run dev` will invoke any `dev` scripts that exist across all workspaces, but it runs them sequentially. Prefer the explicit `dev:*` commands above when you need both servers at the same time.

## Documentation
- [Architecture overview](docs/architecture.md) — how the API, UI, and DynamoDB table fit together.
- [Backend reference](docs/backend.md) — handler behavior, validation rules, and deployment tips.
- [Frontend reference](docs/frontend.md) — React structure, hooks, and UI workflows.
- [API reference](docs/api-reference.md) — request/response schemas for every endpoint.

## Useful Commands
- `npm run build:api` / `npm run build:ui` — build just one surface.
- `npm run build` — build every workspace.
- `npm run test:api` / `npm run test:ui` — run tests per surface.
- `npm run test` — execute all available test suites.
- `npm --workspace apps/api run deploy` — deploy the Serverless stack to AWS (see API README).

## Notes
- Detailed backend instructions live in `apps/api/README.md`.
- UI-specific information, including environment variables and hosting guidance, is documented in `apps/ui/README.md`.
- After restructuring, regenerate the lockfile by running `npm install` at the root (creates a workspace-aware `package-lock.json`).
