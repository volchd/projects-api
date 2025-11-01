import { FormEvent, useEffect, useMemo, useState } from 'react';
import './App.css';

type Project = {
  id: string;
  name: string;
  description: string | null;
  statuses: string[];
};

type TaskStatus = 'TODO' | 'IN PROGRESS' | 'COMPLETE';

type Task = {
  projectId: string;
  taskId: string;
  name: string;
  description: string | null;
  status: TaskStatus;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

const apiUrl = (path: string) => {
  if (!API_BASE) {
    return path;
  }
  return `${API_BASE.replace(/\/$/, '')}${path}`;
};

const fetchProjects = async (): Promise<Project[]> => {
  const response = await fetch(apiUrl('/projects'));
  if (!response.ok) {
    throw new Error(`Failed to load projects (${response.status})`);
  }

  const data = (await response.json()) as { items?: Project[] };
  return data.items ?? [];
};

const createProject = async (payload: { name: string; description: string | null }) => {
  const response = await fetch(apiUrl('/projects'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => undefined);
    const message =
      (Array.isArray(data?.errors) && data.errors.join(', ')) ||
      (typeof data?.message === 'string' ? data.message : 'Failed to create project');
    throw new Error(message);
  }
};

const fetchTasks = async (projectId: string): Promise<Task[]> => {
  const response = await fetch(apiUrl(`/projects/${projectId}/tasks`));
  if (!response.ok) {
    throw new Error(`Failed to load tasks (${response.status})`);
  }

  const data = (await response.json()) as { items?: Task[] };
  return data.items ?? [];
};

const TASK_COLUMNS = [
  { key: 'TODO' as TaskStatus, label: 'To Do' },
  { key: 'IN PROGRESS' as TaskStatus, label: 'In Progress' },
  { key: 'COMPLETE' as TaskStatus, label: 'Done' },
] as const;

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const selectedProject = useMemo(
    () => sortedProjects.find((project) => project.id === selectedProjectId) ?? null,
    [sortedProjects, selectedProjectId],
  );

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      TODO: [],
      'IN PROGRESS': [],
      COMPLETE: [],
    };

    for (const task of tasks) {
      grouped[task.status].push(task);
    }

    return grouped;
  }, [tasks]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingProjects(true);
        setProjectsError(null);
        const items = await fetchProjects();

        if (!cancelled) {
          setProjects(items);
          setSelectedProjectId((previous) => {
            if (previous && items.some((project) => project.id === previous)) {
              return previous;
            }
            return items[0]?.id ?? null;
          });
        }
      } catch (err) {
        if (!cancelled) {
          setProjectsError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoadingProjects(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoadingTasks(true);
        setTasksError(null);
        const items = await fetchTasks(selectedProjectId);

        if (!cancelled) {
          setTasks(items);
        }
      } catch (err) {
        if (!cancelled) {
          setTasksError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoadingTasks(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newProjectName.trim();
    const trimmedDescription = newProjectDescription.trim();

    if (!trimmedName) {
      setCreateProjectError('Project name is required');
      return;
    }

    try {
      setCreatingProject(true);
      setCreateProjectError(null);
      await createProject({
        name: trimmedName,
        description: trimmedDescription ? trimmedDescription : null,
      });

      setNewProjectName('');
      setNewProjectDescription('');
      setShowProjectForm(false);

      const items = await fetchProjects();
      setProjects(items);
      const createdProject =
        items.find((project) => project.name === trimmedName) ?? items[0] ?? null;
      if (createdProject) {
        setSelectedProjectId(createdProject.id);
      }
    } catch (err) {
      setCreateProjectError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  const handleNewProjectToggle = () => {
    setShowProjectForm((prev) => !prev);
    setCreateProjectError(null);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar__header">
          <div className="sidebar__logo">Flowlite</div>
        </header>

        <button
          type="button"
          className="sidebar__new-project"
          onClick={handleNewProjectToggle}
        >
          <span className="sidebar__new-project-plus">+</span>
          New Project
        </button>

        {showProjectForm ? (
          <form className="sidebar__form" onSubmit={handleCreateProject}>
            <input
              type="text"
              name="name"
              placeholder="Project name"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              disabled={creatingProject}
            />
            <textarea
              name="description"
              placeholder="Short description (optional)"
              value={newProjectDescription}
              onChange={(event) => setNewProjectDescription(event.target.value)}
              disabled={creatingProject}
              rows={2}
            />
            {createProjectError ? (
              <p className="sidebar__form-error">{createProjectError}</p>
            ) : null}
            <div className="sidebar__form-actions">
              <button type="submit" disabled={creatingProject}>
                {creatingProject ? 'Creating…' : 'Create'}
              </button>
              <button type="button" onClick={handleNewProjectToggle} disabled={creatingProject}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="sidebar__section">
          <div className="sidebar__section-title">Projects</div>
          {loadingProjects ? <p className="sidebar__meta">Loading…</p> : null}
          {projectsError ? (
            <p className="sidebar__meta sidebar__meta--error">{projectsError}</p>
          ) : null}

          {!loadingProjects && !projectsError && sortedProjects.length === 0 ? (
            <p className="sidebar__meta">No projects yet.</p>
          ) : null}

          <ul className="sidebar__list">
            {sortedProjects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => handleProjectSelect(project.id)}
                  className={
                    project.id === selectedProjectId
                      ? 'sidebar__project sidebar__project--active'
                      : 'sidebar__project'
                  }
                >
                  <span>{project.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar__search">
            <label htmlFor="search" className="sr-only">
              Search tasks
            </label>
            <div className="topbar__search-input">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="topbar__search-icon">
                <path
                  fill="currentColor"
                  d="m20.65 19.29-3.66-3.66a7 7 0 1 0-1.36 1.36l3.66 3.66a1 1 0 0 0 1.36-1.36ZM5 10a5 5 0 1 1 5 5 5 5 0 0 1-5-5Z"
                />
              </svg>
              <input id="search" type="search" placeholder="Search tasks..." />
            </div>
          </div>

          <div className="topbar__actions">
            <nav className="topbar__tabs">
              <button className="topbar__tab topbar__tab--active" type="button">
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M4 5h16a1 1 0 0 1 1 1v12.5a.5.5 0 0 1-.85.35L15 15H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
                  />
                </svg>
                Board
              </button>
              <button className="topbar__tab" type="button">
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M5 6h14a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Zm0 5h14a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Zm0 5h14a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Z"
                  />
                </svg>
                List
              </button>
              <button className="topbar__tab" type="button">
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 3a9 9 0 0 0-7.49 13.92l-1.39 3.47a1 1 0 0 0 1.29 1.29l3.47-1.39A9 9 0 1 0 12 3Zm0 16a7 7 0 1 1 7-7 7 7 0 0 1-7 7Z"
                  />
                </svg>
                Comments
              </button>
            </nav>
            <div className="topbar__spacer" aria-hidden="true" />
            <button type="button" className="topbar__command">
              <span>Command</span>
              <span className="topbar__command-key">⌘K</span>
            </button>
            <button type="button" className="topbar__icon-button" aria-label="Notifications">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-4-5.65V4a2 2 0 0 0-4 0v1.35A6 6 0 0 0 6 11v5l-2 2v1h16v-1Z"
                />
              </svg>
            </button>
            <button type="button" className="topbar__invite">
              Invite
            </button>
            <div className="topbar__avatar" aria-hidden="true">
              <span>AC</span>
            </div>
          </div>
        </header>

        <section className="board">
          <header className="board__header">
            <div>
              <h1>{selectedProject?.name ?? 'Select a project'}</h1>
              {selectedProject?.description ? <p>{selectedProject.description}</p> : null}
            </div>
          </header>

          {!selectedProjectId ? (
            <div className="board__empty">Choose a project to view its tasks.</div>
          ) : null}

          {selectedProjectId ? (
            <div className="board__columns">
              {TASK_COLUMNS.map((column) => (
                <div className="board__column" key={column.key}>
                  <div className="board__column-header">
                    <h2>{column.label}</h2>
                    <span className="board__count">{tasksByStatus[column.key].length}</span>
                  </div>
                  <div className="board__cards">
                    {loadingTasks && tasksByStatus[column.key].length === 0 ? (
                      <div className="board__placeholder">Loading…</div>
                    ) : null}
                    {tasksError && tasksByStatus[column.key].length === 0 ? (
                      <div className="board__placeholder board__placeholder--error">
                        {tasksError}
                      </div>
                    ) : null}
                    {!loadingTasks && !tasksError && tasksByStatus[column.key].length === 0 ? (
                      <div className="board__placeholder board__placeholder--muted">
                        No tasks yet.
                      </div>
                    ) : null}
                    {tasksByStatus[column.key].map((task) => (
                      <article key={task.taskId} className="task-card">
                        <header>
                          <h3>{task.name}</h3>
                          <button type="button" aria-label={`Edit ${task.name}`}>
                            <svg aria-hidden="true" viewBox="0 0 24 24">
                              <path
                                fill="currentColor"
                                d="M3 17.25V21h3.75l11-11.06-3.75-3.75L3 17.25ZM20.71 7a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.82 1.82 3.75 3.75L20.71 7Z"
                              />
                            </svg>
                          </button>
                        </header>
                        {task.description ? <p>{task.description}</p> : null}
                      </article>
                    ))}
                  </div>
                  <button type="button" className="board__add-task">
                    <span aria-hidden="true">+</span>
                    Add Task
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default App;
