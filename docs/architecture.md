# Architecture

This workspace contains two deployable applications plus optional shared packages:

- `apps/api` — Serverless (AWS Lambda + API Gateway) backend that stores Projects and Tasks in DynamoDB.
- `apps/ui` — Vite + React client that consumes the API via REST calls and renders a kanban board + list UI.
- `packages/*` — a placeholder for shared libraries (types, utilities) consumed by the apps. Empty today but wired into npm workspaces.

The goal of the platform is to let a user create projects, define custom status columns/labels, and manage project tasks through both API and UI.

## High-Level Data Flow

1. A browser (or another HTTP client) calls the UI or the API gateway URL.
2. The UI uses the hooks under `apps/ui/src/hooks` to call the backend through `fetch` helpers located in `apps/ui/src/api`.
3. API Gateway forwards the request to the appropriate Lambda handler declared in `apps/api/serverless.yml`.
4. Handlers in `apps/api/src/projects.ts` and `apps/api/src/tasks.ts` validate payloads, resolve the authenticated user (currently hard-coded to `demo-user`), and perform the DynamoDB operation through the shared `ddbDocClient` instance (`apps/api/src/dynamodb.ts`).
5. DynamoDB stores both Projects and Tasks in a single table. Projects live at `PK=PROJECT#<projectId>, SK=PROJECT`, tasks at `PK=PROJECT#<projectId>, SK=TASK#<taskId>`. A global secondary index (`GSI1`) lets us list projects per user.
6. The API responds with JSON via the helper in `apps/api/src/response.ts`. The UI normalizes the payloads into React state and re-renders.

```
Browser ↔ UI (Vite dev server or CloudFront) ↔ API Gateway ↔ Lambda handler ↔ DynamoDB
```

## Backend Responsibilities

- Validation rules for all inputs (statuses, labels, dates, etc.) live with each handler so that UI and third-party consumers get consistent errors.
- `projects.ts` manages CRUD for project metadata, including deduping/normalizing status columns and labels that the UI uses to render boards and chips.
- `tasks.ts` keeps task-level validation synchronized with the parent project's configuration (e.g., a task status must exist in the owning project's status list).
- `dynamodb.ts` owns connectivity and offline detection so the rest of the codebase stays unaware of environment differences.
- The Serverless config declares infrastructure (table, IAM policies, API routes) so deployments stay reproducible.

## Frontend Responsibilities

- React + TypeScript + Tailwind (see `apps/ui/src/index.css`) implement the kanban experience.
- `App.tsx` orchestrates sidebar selection, dialog visibility, keyboard shortcuts, and view toggles (`board`, `list`, `comments`).
- Hooks encapsulate data fetching + optimistic UI behavior (`useProjects`, `useTasks`, `useTheme`).
- Components under `apps/ui/src/components` provide isolated pieces—sidebars, top bar, modal dialogs, task board columns, task editor, etc.—so styling and behavior stay focused.
- Constants under `apps/ui/src/constants` define color maps, priority/status options, and shared configuration consumed throughout the UI.

## Data Model Summary

| Entity  | Fields (subset) | Notes |
| --- | --- | --- |
| Project | `id`, `userId`, `name`, `description`, `statuses[]`, `labels[]`, timestamps | `statuses` and `labels` are normalized (deduped, trimmed, capped length 40). |
| Task | `projectId`, `taskId`, `name`, `description`, `status`, `priority`, `startDate`, `dueDate`, `labels[]`, timestamps | `status` must match the parent project statuses. Priority ∈ {`None`,`Low`,`Normal`,`High`,`Urgent`}. |

Both entities are stored in the same DynamoDB table to keep cross-entity transactions simple. Tasks inherit partition keys from their projects so deleting a project can efficiently delete its tasks via `Query` + batched `Delete` operations.

## Environments & Configuration

- **Local**: run `npm run dev:api` (Serverless Offline) + `npm run dev:ui` (Vite). DynamoDB Local runs via `npm --workspace apps/api run docker:up` and is auto-targeted when `IS_OFFLINE` or `DYNAMODB_ENDPOINT` is set.
- **AWS (dev/prod)**: `npm --workspace apps/api run deploy` provisions Lambda/API Gateway/DynamoDB. UI builds to static assets ready for S3 + CloudFront.
- Shared env vars:
  - `TABLE_NAME` (injected by Serverless) to point handlers to the correct DynamoDB table.
  - `CORS_*` vars (optional) to fine-tune API responses.
  - `VITE_API_BASE` (UI) to override API origin outside dev proxy.

## Build & Deploy Flow

1. Install dependencies once at the repo root (`npm install`) so workspace hoisting is respected.
2. Use `npm run build` to produce the Lambda bundles (esbuild) and UI static assets.
3. Deploy API via Serverless CLI command noted above; deploy UI by syncing `apps/ui/dist` to S3 and fronting it with CloudFront (see `apps/ui/README.md`).
4. Integration tests (Vitest) can run locally with DynamoDB Local to exercise the entire stack before deploying.

## Extending the System

- Shared utilities can live under `packages/*`; import them from both apps through workspace-relative imports.
- New backend handlers should follow the existing validation + response helpers to stay consistent.
- New UI features should encapsulate network access inside the `apps/ui/src/api` layer and reuse hooks to manage loading/error state.
