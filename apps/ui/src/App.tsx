import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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

const updateProject = async (
  projectId: string,
  payload: { name: string; description: string | null },
) => {
  const response = await fetch(apiUrl(`/projects/${projectId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => undefined);
    const message =
      (Array.isArray(data?.errors) && data.errors.join(', ')) ||
      (typeof data?.message === 'string' ? data.message : 'Failed to update project');
    throw new Error(message);
  }
};

const deleteProject = async (projectId: string) => {
  const response = await fetch(apiUrl(`/projects/${projectId}`), {
    method: 'DELETE',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => undefined);
    const message =
      (Array.isArray(data?.errors) && data.errors.join(', ')) ||
      (typeof data?.message === 'string' ? data.message : 'Failed to delete project');
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
  const [projectMenuOpenId, setProjectMenuOpenId] = useState<string | null>(null);
  const projectMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [editingProject, setEditingProject] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [updatingProject, setUpdatingProject] = useState(false);
  const [updateProjectError, setUpdateProjectError] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null);

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

  const isDeleteInProgress =
    projectPendingDelete !== null && deletingProjectId === projectPendingDelete.id;

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

  useEffect(() => {
    if (!projectMenuOpenId) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const container = projectMenuRefs.current[projectMenuOpenId];
      if (container && !container.contains(event.target as Node)) {
        setProjectMenuOpenId(null);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [projectMenuOpenId]);

  useEffect(() => {
    if (!selectedProject) {
      setProjectMenuOpenId(null);
      setEditingProject(false);
      setEditProjectName('');
      setEditProjectDescription('');
    }
  }, [selectedProject]);

  useEffect(() => {
    if (!projectPendingDelete) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deletingProjectId) {
        setProjectPendingDelete(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [projectPendingDelete, deletingProjectId]);

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
    setEditingProject(false);
    setProjectMenuOpenId(null);
    setUpdateProjectError(null);
    setShowProjectForm(false);
    setCreateProjectError(null);
    setNewProjectName('');
    setNewProjectDescription('');
  };

  const handleNewProjectToggle = () => {
    setShowProjectForm((previous) => {
      const next = !previous;
      setCreateProjectError(null);
      if (next) {
        setEditingProject(false);
        setUpdateProjectError(null);
      } else {
        setNewProjectName('');
        setNewProjectDescription('');
      }
      return next;
    });
  };

  const handleProjectMenuToggle = (projectId: string) => {
    setProjectMenuOpenId((previous) => (previous === projectId ? null : projectId));
  };

  const registerProjectMenuRef = (projectId: string) => (node: HTMLDivElement | null) => {
    if (node) {
      projectMenuRefs.current[projectId] = node;
    } else {
      delete projectMenuRefs.current[projectId];
    }
  };

  const handleEditProjectClick = (project: Project) => {
    setProjectMenuOpenId(null);
    setSelectedProjectId(project.id);
    setShowProjectForm(false);
    setCreateProjectError(null);
    setNewProjectName('');
    setNewProjectDescription('');
    setEditingProject(true);
    setEditProjectName(project.name);
    setEditProjectDescription(project.description ?? '');
    setUpdateProjectError(null);
  };

  const handleEditProjectCancel = () => {
    setEditingProject(false);
    setUpdateProjectError(null);
    setEditProjectName('');
    setEditProjectDescription('');
  };

  const handleUpdateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedProject) {
      return;
    }

    const trimmedName = editProjectName.trim();
    const trimmedDescription = editProjectDescription.trim();

    if (!trimmedName) {
      setUpdateProjectError('Project name is required');
      return;
    }

    try {
      setUpdatingProject(true);
      setUpdateProjectError(null);
      const projectId = selectedProject.id;
      await updateProject(projectId, {
        name: trimmedName,
        description: trimmedDescription ? trimmedDescription : null,
      });
      const items = await fetchProjects();
      setProjects(items);
      setSelectedProjectId((previous) => {
        if (previous && items.some((project) => project.id === previous)) {
          return previous;
        }
        return projectId;
      });
      setEditingProject(false);
      setEditProjectName('');
      setEditProjectDescription('');
    } catch (err) {
      setUpdateProjectError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUpdatingProject(false);
    }
  };

  const handleDeleteProjectRequest = (project: Project) => {
    setProjectPendingDelete(project);
    setProjectMenuOpenId(null);
    setUpdateProjectError(null);
  };

  const handleDeleteProjectCancel = () => {
    if (deletingProjectId) {
      return;
    }
    setProjectPendingDelete(null);
  };

  const handleDeleteProjectConfirm = async () => {
    if (!projectPendingDelete) {
      return;
    }

    const project = projectPendingDelete;

    try {
      setDeletingProjectId(project.id);
      setUpdateProjectError(null);
      setProjectMenuOpenId(null);
      const projectId = project.id;
      const deletingSelected =
        selectedProjectId === projectId ||
        (!selectedProjectId && selectedProject?.id === projectId);
      await deleteProject(projectId);
      const items = await fetchProjects();
      setProjects(items);
      setSelectedProjectId((previous) => {
        if (!previous) {
          return items[0]?.id ?? null;
        }
        if (previous !== projectId && items.some((item) => item.id === previous)) {
          return previous;
        }
        return items.find((item) => item.id !== projectId)?.id ?? null;
      });
      if (deletingSelected || (editingProject && selectedProject?.id === projectId)) {
        setEditingProject(false);
        setEditProjectName('');
        setEditProjectDescription('');
      }
      setProjectPendingDelete(null);
    } catch (err) {
      setUpdateProjectError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDeletingProjectId(null);
    }
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
          disabled={creatingProject}
        >
          <span className="sidebar__new-project-plus">+</span>
          New Project
        </button>

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
            {sortedProjects.map((project) => {
              const isMenuOpen = projectMenuOpenId === project.id;
              const isDeleting = deletingProjectId === project.id;
              const isActive = project.id === selectedProjectId;
              return (
                <li key={project.id} className="sidebar__project-item">
                  <div
                    className={isActive ? 'sidebar__project sidebar__project--active' : 'sidebar__project'}
                    ref={registerProjectMenuRef(project.id)}
                  >
                    <button
                      type="button"
                      onClick={() => handleProjectSelect(project.id)}
                      className="sidebar__project-button"
                    >
                      <span>{project.name}</span>
                    </button>
                    <button
                      type="button"
                      className="sidebar__project-menu-button"
                      onClick={() => handleProjectMenuToggle(project.id)}
                      aria-haspopup="menu"
                      aria-expanded={isMenuOpen}
                    >
                      <span className="sr-only">Project actions</span>
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                        <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                      </svg>
                    </button>
                    {isMenuOpen ? (
                      <div className="sidebar__project-menu" role="menu">
                        <button
                          type="button"
                          className="sidebar__project-menu-item"
                          onClick={() => handleEditProjectClick(project)}
                          role="menuitem"
                        >
                          Update project
                        </button>
                        <button
                          type="button"
                          className="sidebar__project-menu-item sidebar__project-menu-item--danger"
                          onClick={() => handleDeleteProjectRequest(project)}
                          disabled={isDeleting}
                          role="menuitem"
                        >
                          {isDeleting ? 'Deleting…' : 'Delete project'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
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
            <h1>
              {showProjectForm
                ? 'Create a project'
                : selectedProject?.name ?? 'Select a project'}
            </h1>
            {!showProjectForm && selectedProject?.description ? (
              <p>{selectedProject.description}</p>
            ) : null}
          </header>

          {showProjectForm && createProjectError ? (
            <div className="board__alert board__alert--error">{createProjectError}</div>
          ) : null}

          {showProjectForm ? (
            <form className="project-editor" onSubmit={handleCreateProject}>
              <div className="project-editor__field">
                <label htmlFor="new-project-name" className="project-editor__label">
                  Project name
                </label>
                <input
                  id="new-project-name"
                  type="text"
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  disabled={creatingProject}
                  placeholder="Project name"
                />
              </div>
              <div className="project-editor__field">
                <label htmlFor="new-project-description" className="project-editor__label">
                  Description
                </label>
                <textarea
                  id="new-project-description"
                  value={newProjectDescription}
                  onChange={(event) => setNewProjectDescription(event.target.value)}
                  disabled={creatingProject}
                  placeholder="Short description (optional)"
                  rows={3}
                />
              </div>
              <div className="project-editor__actions">
                <button type="submit" disabled={creatingProject}>
                  {creatingProject ? 'Creating…' : 'Create project'}
                </button>
                <button type="button" onClick={handleNewProjectToggle} disabled={creatingProject}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {!showProjectForm && updateProjectError ? (
            <div className="board__alert board__alert--error">{updateProjectError}</div>
          ) : null}

          {!showProjectForm && editingProject && selectedProject ? (
            <form className="project-editor" onSubmit={handleUpdateProject}>
              <div className="project-editor__field">
                <label htmlFor="edit-project-name" className="project-editor__label">
                  Project name
                </label>
                <input
                  id="edit-project-name"
                  type="text"
                  value={editProjectName}
                  onChange={(event) => setEditProjectName(event.target.value)}
                  disabled={updatingProject}
                  placeholder="Project name"
                />
              </div>
              <div className="project-editor__field">
                <label htmlFor="edit-project-description" className="project-editor__label">
                  Description
                </label>
                <textarea
                  id="edit-project-description"
                  value={editProjectDescription}
                  onChange={(event) => setEditProjectDescription(event.target.value)}
                  disabled={updatingProject}
                  placeholder="Short description (optional)"
                  rows={3}
                />
              </div>
              <div className="project-editor__actions">
                <button type="submit" disabled={updatingProject}>
                  {updatingProject ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" onClick={handleEditProjectCancel} disabled={updatingProject}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {!showProjectForm && !selectedProjectId ? (
            <div className="board__empty">Choose a project to view its tasks.</div>
          ) : null}

          {!showProjectForm && selectedProjectId ? (
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
      {projectPendingDelete ? (
        <div className="confirm-dialog__backdrop" role="presentation" onClick={handleDeleteProjectCancel}>
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-dialog__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  fill="currentColor"
                  d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 14h-2v-2h2Zm0-4h-2V7h2Z"
                />
              </svg>
            </div>
            <h2 id="confirm-dialog-title" className="confirm-dialog__title">
              Delete project
            </h2>
            <p id="confirm-dialog-description" className="confirm-dialog__description">
              Are you sure you want to delete “{projectPendingDelete.name}”? This action cannot be
              undone.
            </p>
            <div className="confirm-dialog__actions">
              <button
                type="button"
                className="confirm-dialog__button"
                onClick={handleDeleteProjectCancel}
                disabled={isDeleteInProgress}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-dialog__button confirm-dialog__button--danger"
                onClick={handleDeleteProjectConfirm}
                disabled={isDeleteInProgress}
              >
                {isDeleteInProgress ? 'Deleting…' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
