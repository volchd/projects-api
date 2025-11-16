# Backend Reference (`apps/api`)

The backend is a Serverless (AWS Lambda + API Gateway) application written in TypeScript. It exposes CRUD endpoints for Projects and Tasks, validates every request, and stores data inside a single DynamoDB table.

## Directory Structure

```
apps/api/
├── src/
│   ├── auth.ts              # user resolution (stubbed to demo-user)
│   ├── dynamodb.ts          # shared DynamoDB DocumentClient wiring
│   ├── model.ts             # partition/sort key helpers and constants
│   ├── projects.ts          # Project handlers (create/get/list/update/delete)
│   ├── projects.types.ts    # shared interfaces + validation helpers
│   ├── tasks.ts             # Task handlers
│   ├── tasks.types.ts       # task-specific types and enums
│   └── response.ts          # JSON/CORS helper
├── tests/                   # Vitest suites (unit + integration)
├── serverless.yml           # Functions, IAM, DynamoDB table definition
└── docker-compose.yml       # DynamoDB Local container for offline dev
```

## Runtime Stack

- Node.js 20 (configured in `serverless.yml`).
- AWS SDK v3 (`@aws-sdk/lib-dynamodb`).
- esbuild bundling via Serverless `build` block (sourcemaps enabled for easier debugging).
- Vitest for unit and integration tests.

## Environment Variables

| Variable | Source | Purpose |
| --- | --- | --- |
| `TABLE_NAME` | Serverless `provider.environment` | Name of the DynamoDB table. Required at runtime. |
| `IS_OFFLINE` | serverless-offline | Tells `dynamodb.ts` to hit DynamoDB Local. |
| `DYNAMODB_ENDPOINT` | Manual | Override DynamoDB endpoint (used by tests/local tooling). |
| `CORS_ALLOWED_ORIGIN` / `CORS_ALLOWED_HEADERS` / `CORS_ALLOWED_METHODS` | Manual | Override the defaults hard-coded in `response.ts`. |

## Data Model

Both Projects and Tasks live in the same table:

- Partition key (`PK`) is always `PROJECT#<projectId>`.
- Sort key (`SK`) is `PROJECT` for projects and `TASK#<taskId>` for tasks.
- Global Secondary Index (`GSI1`) maps `USER#<userId>` → `PROJECT#<projectId>` so we can list projects per user quickly.
- All items include metadata like `entityType`, `createdAt`, and `updatedAt` for observability.

`src/model.ts` centralizes key builders so handlers cannot drift.

## Request Validation & Normalization

- `projects.ts` and `tasks.ts` parse JSON bodies via `parseBody` helper, accumulate validation errors, and bail out with `400` responses when needed.
- Status and label fields are trimmed, deduped, and upper/lower-case normalized. Maximum length is 40 characters.
- Task dates are parsed as ISO 8601 strings and validated for ordering (due date cannot be earlier than start date).
- Task priorities must be one of `TASK_PRIORITY_VALUES` defined in `tasks.types.ts`.
- Every handler enforces ownership by checking the hard-coded user id (swap `resolveUserId` once auth is wired in).

## Handler Behavior Highlights

- `createProject` generates UUIDs server-side, writes the record with a conditional expression so duplicate PKs fail fast, and returns the normalized project payload.
- `updateProject` builds a dynamic `UpdateExpression` only from provided fields and refuses empty payloads.
- `deleteProject` first deletes every task belonging to the project (paging through DynamoDB results) before deleting the project so no orphaned tasks remain.
- `createTask` ensures the requested status exists in the parent project's configured status list. When new labels are sent for a task, the handler persists them back to the project via `ensureProjectLabels` so UI filters stay in sync.
- `updateTask` enforces user ownership and only updates provided fields. When labels change, it also updates the parent project's label list to include any newly seen labels.
- `listTasksByProject` and `getTask` simply query within the project's partition; pagination can be added later via `LastEvaluatedKey`.

## Error Handling & Logging

- The shared `handleError` helper logs errors with a generated `requestId` and returns a generic `500` payload referencing the id.
- Conditional write failures return `404 Not Found` so clients see deterministic behavior when resources disappear between reads and writes.
- JSON parsing errors return a structured `{ errors: [...] }` body that the UI already understands via `parseError` helper.

## Local Development Workflow

1. `npm install` once at repo root (installs every workspace).
2. Start DynamoDB Local: `npm --workspace apps/api run docker:up` (runs docker-compose file).
3. Launch API offline: `npm run dev:api` (under the hood runs `serverless offline start`). Hot reloads TypeScript sources.
4. Run tests: `npm run test:api`. Use `npm --workspace apps/api run test:watch` during development. Integration tests expect DynamoDB Local to be running.

## Deployment Workflow

- Run `npm run build:api` to bundle handlers (esbuild).
- Deploy with `npm --workspace apps/api run deploy` which shells out to `serverless deploy` and provisions/updates the DynamoDB table, Lambda functions, and API Gateway routes.
- Remove with `npm --workspace apps/api run remove`.
- CI/CD tip: set AWS credentials/region in the runner and run the same scripts so the infrastructure definition remains single-sourced.

## Extending the API

1. Add new business logic to `src/*` and expose it in `serverless.yml` under `functions`.
2. Stick to the existing validation strategy—parse the JSON body once, accumulate human-readable errors, and bail early with `json(400, { errors })`.
3. Use helpers from `model.ts` for key generation and `response.ts` for consistent headers.
4. Update `docs/api-reference.md` (and optionally `apps/ui/src/api/*`) whenever new endpoints ship so both the UI and third-party consumers stay in sync.
