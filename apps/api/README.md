# Projects API (Serverless + Node.js + DynamoDB Local via Docker)

A minimal CRUD API for `Project` objects with nested `Task` resources.

> This package now lives inside an npm workspace at `apps/api`. Run the commands below either from this directory or by prefixing them with `npm --workspace apps/api`.

Project shape:
```json
{
  "id": "uuid",
  "userId": "user-123",
  "name": "My Project",
  "description": "optional"
}
```

Task shape:
```json
{
  "projectId": "project-uuid",
  "taskId": "task-uuid",
  "name": "Draft docs",
  "description": "optional",
  "status": "TODO",
  "priority": "None",
  "startDate": "ISO timestamp or null",
  "dueDate": "ISO timestamp or null",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

Task priority options: `None`, `Low`, `Normal`, `High`, `Urgent` (default is `None`).

## Prereqs
- Node.js 18+ (Node 20 recommended)
- Docker

## Environment configuration
All handlers import `src/config/env.ts`, which loads `.env` files (in priority order) and exports a typed configuration object. Start by copying the tracked example file and filling in real values:
```bash
cp apps/api/.env.example apps/api/.env.local
```

When you deploy with the Serverless Framework, the same loader runs but simply reads the environment variables that Lambda receives from `serverless.yml`; `.env` files are only needed for local development and CI.

The loader searches for `.env.<NODE_ENV>.local`, `.env.local`, `.env.<NODE_ENV>`, and `.env` (highest priority listed first). Keys defined in the shell/CI environment always win, so you can still `export` overrides when needed.

- **Local dev** — keep a `.env.local` with developer-specific secrets (ignored by Git). Serverless offline and Vitest both read through the loader, so no extra tooling is required.
- **GitHub Actions** — `.github/workflows/api-tests.yml` writes an `.env.test` file at runtime so the tests run with a consistent TABLE_NAME and Cognito IDs. Replace the placeholder values in that step with `${{ secrets.* }}` entries when you add real secrets to the repository/environment scope.
- **AWS** — `serverless deploy` provisions the DynamoDB table plus a Cognito user pool and app client (see `resources` in `serverless.yml`). The generated IDs are injected into every Lambda via CloudFormation `Ref`, so you no longer have to pre-populate `COGNITO_USER_POOL_ID` or `COGNITO_USER_POOL_CLIENT_ID` when targeting AWS. Update the `CallbackURLs`/`LogoutURLs` entries in `serverless.yml` to match your UI origin(s). After the deploy finishes, run `serverless info --verbose` (or read the CloudFormation outputs) to grab the exported Cognito IDs for the web client. If you add additional secrets later on, keep them in SSM Parameter Store/Secrets Manager and export them before deployments as needed.

## Quick Start (Local)
1) Install dependencies from the repository root (installs every workspace):
```bash
npm install
```

2) Start DynamoDB Local (from the root or inside `apps/api`):
```bash
npm --workspace apps/api run docker:up
```
This launches DynamoDB Local at `http://localhost:8000`.

3) Start the API locally with serverless-offline:
```bash
npm run dev:api
```
API base URL will be `http://localhost:3000`.

> Note about versions: this project pins **serverless v4** with **serverless-offline v14** to avoid the common peer dependency error you may have seen when using serverless v3.

3) Create the DynamoDB table (automatically created on real deploy). For local dev with offline, run a no-op deploy once or use AWS CLI. An easy path is to actually `serverless deploy` to AWS (will create the table) and continue developing offline. Alternatively, you can create the table against local DynamoDB using AWS CLI:
```bash
aws dynamodb create-table   --table-name projects-api-dev-Projects   --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S AttributeName=GSI1PK,AttributeType=S AttributeName=GSI1SK,AttributeType=S   --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE   --billing-mode PAY_PER_REQUEST   --global-secondary-indexes 'IndexName=GSI1,KeySchema=[{AttributeName=GSI1PK,KeyType=HASH},{AttributeName=GSI1SK,KeyType=RANGE}],Projection={ProjectionType=ALL}'   --endpoint-url http://localhost:8000   --region us-east-1
```
(Replace table name/region if you changed them in `serverless.yml`.)

4) Run the unit tests (Vitest) to verify the handlers:
```bash
npm run test:api
```
Use watch mode while iterating locally:
```bash
npm --workspace apps/api run test:watch
```

5) (Optional) Run the integration test against DynamoDB Local. Leave the container from step 1 running and execute:
```bash
npm --workspace apps/api run test -- tests/projects.integration.test.ts
```
This test provisions a throwaway table in the local instance, exercises the full CRUD flow, and then cleans everything up.

## Project Structure
- `src/` — Lambda handlers, data access, and shared utilities.
- `tests/` — Vitest suites covering unit and integration scenarios.
- `dist/` — Transpiled JavaScript output generated by `npm run build`.

## Endpoints
- `POST   /projects` — create a project
- `GET    /projects/{id}` — get a project by id
- `GET    /projects` — list projects by userId (via GSI)
- `PUT    /projects/{id}` — update name/description
- `DELETE /projects/{id}` — delete by id
- `POST   /projects/{projectId}/tasks` — create a task under a project (validates project ownership)
- `GET    /projects/{projectId}/tasks` — list tasks for a project
- `GET    /projects/{projectId}/tasks/{taskId}` — fetch a single task
- `PUT    /projects/{projectId}/tasks/{taskId}` — update task fields (name, description, status, priority, start/due dates)
- `DELETE /projects/{projectId}/tasks/{taskId}` — delete a task

## Authentication
Every request must include an `Authorization: Bearer <idToken>` header. The token is verified against the Cognito user pool configured through the `COGNITO_USER_POOL_ID` and `COGNITO_USER_POOL_CLIENT_ID` environment variables (defaults match the web app's pool). The backend automatically derives the authenticated user's id from the token claims and scopes reads/writes to that user.

## Example Requests
Create:
```bash
curl -s -X POST http://localhost:3000/projects   -H 'Content-Type: application/json'   -d '{"userId":"u1","name":"alpha","description":"first"}'
```

Get:
```bash
curl -s http://localhost:3000/projects/<id>
```

List by user:
```bash
curl -s http://localhost:3000/projects
```

Update:
```bash
curl -s -X PUT http://localhost:3000/projects/<id>   -H 'Content-Type: application/json'   -d '{"name":"alpha v2","description":"updated"}'
```

Delete:
```bash
curl -i -X DELETE http://localhost:3000/projects/<id>
```

Create task:
```bash
curl -s -X POST http://localhost:3000/projects/<projectId>/tasks   -H 'Content-Type: application/json'   -d '{"name":"Draft docs","description":"initial outline","priority":"High"}'
```

List tasks:
```bash
curl -s http://localhost:3000/projects/<projectId>/tasks
```

## Deploy to AWS (optional)
```bash
npm --workspace apps/api run deploy
```
This creates the DynamoDB table and API Gateway/Lambda infrastructure. To tear down:
```bash
npm --workspace apps/api run remove
```

## Notes
- The code auto-detects `serverless-offline` via `IS_OFFLINE` and points to `http://localhost:8000` for DynamoDB Local.
- For real AWS deploys, no special config is needed—the SDK will use the default AWS credentials/region.
- Projects and tasks share a single DynamoDB table: projects live at `PK=PROJECT#<id>, SK=PROJECT`, while tasks use `PK=PROJECT#<id>, SK=TASK#<taskId>`. A GSI (`GSI1`) indexes projects by `userId`.
- Unit tests use mocked DynamoDB clients for fast iteration; the integration test hits the real local DynamoDB container to validate end-to-end behavior.
