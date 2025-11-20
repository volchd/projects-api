# API Reference

Base URL depends on environment:

- Local (serverless-offline): `http://localhost:3000`
- AWS HTTP API URL after `serverless deploy`

All endpoints return JSON and include permissive CORS headers by default (configurable via `CORS_*` env variables). Error payloads follow:

```json
{
  "message": "Human readable message",
  "errors": ["Optional", "list", "of", "validation", "errors"],
  "requestId": "Only on 500s"
}
```

## Authentication

Send a Cognito ID token via `Authorization: Bearer <token>`. The backend verifies the token against the configured user pool and derives the user id from the claims (`cognito:username` or `sub`). Requests without a valid bearer token return `401`.

## User Profile

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/me/profile` | Fetch the current user's profile. |
| `PUT` | `/me/profile` | Create or update the current user's profile. |

### Profile Schema

```ts
interface UserProfile {
  userId: string;
  email: string | null;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
}
```

### Upsert Profile

Request body:

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace"
}
```

Rules:
- `firstName` and `lastName` required, non-empty strings up to 100 characters.
- Email is pulled from the authenticated token claims; clients do not need to send it.

Responses:
- `200` with the saved `UserProfile`.
- `400` with `{ errors: [...] }` when validation fails.
- `404` when fetching a profile that has not been created yet.

## Projects

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/projects` | Create a project. |
| `GET` | `/projects/{id}` | Fetch a project by id. |
| `GET` | `/projects` | List projects for the current user (uses `GSI1`). |
| `PUT` | `/projects/{id}` | Update name/description/statuses/labels. |
| `DELETE` | `/projects/{id}` | Delete a project and all of its tasks. |

### Project Schema

```ts
interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  statuses: string[];      // normalized, at least one entry
  labels: string[];        // optional, deduped & sorted
}
```

### Create Project

Request body:

```json
{
  "name": "Roadmap",
  "description": "Optional",
  "statuses": ["Todo", "In progress", "Done"],
  "labels": ["frontend", "backend"]
}
```

- `name` is required.
- `description` optional (`string` or `null`).
- `statuses` optional array; falls back to `['TODO', 'IN PROGRESS', 'COMPLETE']`. Each value must be <= 40 chars and unique (case-insensitive). Values are uppercased.
- `labels` optional array of <= 40 char unique strings.

Responses:
- `201` with `Project` JSON.
- `400` with `{ errors: [...] }` when validation fails.

### Update Project

Request body can include any subset of fields shown in the schema. At least one field must be present. `statuses` must contain ≥ 1 entry when provided.

Responses:
- `200` with updated `Project`.
- `400` when request is empty/invalid.
- `404` if the project does not exist.

### Delete Project

- Deletes the project record and every task whose `PK` matches.
- Returns `204` on success, `404` if the project is already gone.

## Tasks

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/projects/{projectId}/tasks` | Create a task inside a project. |
| `GET` | `/projects/{projectId}/tasks` | List tasks for a project. |
| `GET` | `/projects/{projectId}/tasks/{taskId}` | Fetch a single task. |
| `PUT` | `/projects/{projectId}/tasks/{taskId}` | Update a task. |
| `DELETE` | `/projects/{projectId}/tasks/{taskId}` | Delete a task. |

### Task Schema

```ts
interface Task {
  projectId: string;
  taskId: string;
  name: string;
  description: string | null;
  status: string;          // must exist in the owning project's status list
  priority: 'None' | 'Low' | 'Normal' | 'High' | 'Urgent';
  startDate: string | null; // ISO timestamps or null
  dueDate: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}
```

### Create Task

Request body:

```json
{
  "name": "Draft scope",
  "description": "Short summary",
  "status": "TODO",
  "priority": "High",
  "startDate": "2024-06-01T12:00:00.000Z",
  "dueDate": null,
  "labels": ["frontend"]
}
```

Rules:
- `name` required.
- `status` optional; defaults to the first status configured on the project.
- `priority` optional; defaults to `None`.
- `startDate`/`dueDate` accept ISO 8601 strings or `null`. When both provided, `dueDate` must be on/after `startDate`.
- `labels` optional array; new labels are appended back to the project's label list so filters stay aware of them.

Responses:
- `201` with `Task` JSON.
- `400` for validation errors (e.g., status not part of project statuses).
- `404` if the project does not exist or belongs to a different user.

### Update Task

- Accepts any subset of the task fields. Empty payloads return `400`.
- Status validation ensures the value remains inside the owning project's status list.
- Label updates again sync into the project-level label list.

Responses:
- `200` with updated `Task`.
- `400` / `404` similar to create.

### Delete Task

- Returns `204` on success, `404` if the task is already gone or user does not own it.

## Pagination & Filtering Roadmap

- Project list currently returns the full dataset per user. Add pagination by propagating DynamoDB's `LastEvaluatedKey` through API responses.
- Task list returns everything for a project. Filtering by status/label/search is handled client-side today; server-side filters can be added with additional query parameters.

## Versioning & Compatibility

- Keep this document in sync whenever the request/response shape changes.
- Consider namespacing future breaking changes under `/v2` and surfacing a `version` response header if public consumers rely on the API.
