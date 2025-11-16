# Frontend Reference (`apps/ui`)

The UI is a Vite + React + TypeScript single-page app that consumes the Projects API. Styling uses Tailwind (configured in `tailwind.config.cjs`), plus custom components.

## Directory Structure

```
apps/ui/
├── src/
│   ├── api/             # fetch helpers + ApiError abstraction
│   ├── components/      # reusable UI building blocks
│   ├── constants/       # status/priority color palettes and option lists
│   ├── hooks/           # data fetching and UI state hooks
│   ├── App.tsx          # main app shell
│   ├── main.tsx         # React entry point
│   └── types.ts         # shared UI types
├── index.html           # Vite entry document
├── vite.config.*        # dev/build configuration
└── README.md            # workspace-specific instructions
```

## Data Fetching Layer

- `src/api/client.ts` exposes `apiUrl`, an `ApiError`, and a `parseError` helper used by resource-specific modules.
- `src/api/projects.ts` and `src/api/tasks.ts` wrap `fetch` with JSON serialization/deserialization, so components/hooks deal with typed payloads.
- Every helper throws `ApiError` on non-2xx responses; React hooks catch these and surface human-friendly messages.

## State Management Hooks

- `useProjects` handles loading all projects on mount, exposing create/update/delete helpers and busy flags (`creating`, `updatingProjectId`, `deletingProjectId`). It stores state inside React and refreshes after every mutation to stay source-of-truth with the API.
- `useTasks` subscribes to a selected `projectId`, keeps tasks loaded for that project, enforces that operations only run when a project is selected, and tracks busy states per operation. It also mirrors the project's status list so new tasks always start in a valid column.
- `useTheme` toggles `dark`/`light` themes, persists the preference in `localStorage`, and updates `document.documentElement` classes/data attributes so Tailwind can reference them.

These hooks isolate asynchronous logic from presentation components, making it easier to add new surfaces (e.g., mobile) later.

## Component Overview

- `App.tsx` orchestrates the entire experience: selects projects, opens modals/drawers, wires keyboard shortcuts (Cmd/Ctrl + K), and toggles between kanban/list/comment workspace layouts.
- `ProjectSidebar`, `ProjectSidebarItem`, and `ProjectForm` manage project selection and CRUD flows.
- `TaskBoard` renders draggable-ish columns grouped by status; `TaskList` renders a chronological/card-based list alternative.
- `TaskEditor`, `Modal`, `ConfirmDialog`, and `CommandPalette` provide shared primitives for dialog UX.
- `Topbar` hosts theme toggles and entry points to the command palette + task modal.
- `DatePicker`, `Select`, and constants under `src/constants` keep styling consistent for repeated UI controls.

## Styling & Theming

- Base styles live in `src/index.css`. Tailwind is configured for `dark` mode via the `class` strategy (see `useTheme`).
- Priority/status color ramps live under `src/constants` so both the board and list surfaces stay synchronized.
- Component-specific classes use Tailwind utility strings; no CSS-in-JS runtime is introduced.

## Testing

- Run `npm run test:ui` to execute Vitest + React Testing Library suites (see `vitest.config.ts`).
- Tests can run against mocked fetch responses; hook logic is easily testable by mocking the API modules.

## Build & Deployment

1. `npm run dev:ui` starts Vite on port 5173 with the dev proxy sending `/projects` and `/tasks` calls to `http://localhost:3000` (serverless-offline).
2. `npm run build:ui` outputs static assets to `apps/ui/dist`.
3. Deploy by syncing `dist/` to S3 and fronting with CloudFront. See `apps/ui/README.md` for the detailed AWS workflow.
4. Set `VITE_API_BASE` to your production API origin before building if the UI will not share a host with the API gateway.

## Extending the UI

- Add new API helpers under `src/api` and surface them through hooks instead of calling `fetch` directly inside components.
- Keep shared types in `src/types.ts` so both hooks and components stay aligned.
- Prefer colocated state + view logic (e.g., `TaskEditor`) for small widgets, but graduate repeated cross-cutting logic into hooks or context providers when necessary.
