import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjects } from './hooks/useProjects';
import { useTasks } from './hooks/useTasks';
import { ProjectSidebar } from './components/ProjectSidebar';
import { ProjectForm } from './components/ProjectForm';
import { TaskBoard } from './components/TaskBoard';
import { TaskList } from './components/TaskList';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Topbar } from './components/Topbar';
import { CommandPalette } from './components/CommandPalette';
import { Modal } from './components/Modal';
import { TaskEditor } from './components/TaskEditor';
import { DEFAULT_TASK_STATUSES, toStatusOptions } from './constants/taskStatusOptions';
import type { Project, Task, TaskPriority, TaskStatus, TaskView } from './types';

type ProjectFormMode = 'create' | 'edit' | null;

const UNKNOWN_ERROR = 'Unknown error';
const EMPTY_STATUSES: TaskStatus[] = [];

function App() {
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
    creating,
    updatingProjectId,
    deletingProjectId,
    createProject,
    updateProject,
    deleteProject,
    updateProjectStatuses,
    refresh: refreshProjects,
  } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectFormMode, setProjectFormMode] = useState<ProjectFormMode>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<Task | null>(null);
  const [taskView, setTaskView] = useState<TaskView>('board');
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalSubmitting, setTaskModalSubmitting] = useState(false);
  const [taskModalError, setTaskModalError] = useState<string | null>(null);
  const [taskEditModalId, setTaskEditModalId] = useState<string | null>(null);
  const [taskEditModalSubmitting, setTaskEditModalSubmitting] = useState(false);
  const [taskEditModalError, setTaskEditModalError] = useState<string | null>(null);
  const taskDeletePromiseRef = useRef<{ resolve: () => void; reject: (reason?: unknown) => void } | null>(null);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const selectedProject = useMemo(
    () => sortedProjects.find((project) => project.id === selectedProjectId) ?? null,
    [sortedProjects, selectedProjectId],
  );
  const activeStatuses = selectedProject?.statuses ?? EMPTY_STATUSES;
  const activeLabels = selectedProject?.labels ?? [];
  const defaultModalStatus = activeStatuses[0] ?? DEFAULT_TASK_STATUSES[0];
  const statusOptionsForModal = useMemo(
    () => toStatusOptions(activeStatuses.length ? activeStatuses : DEFAULT_TASK_STATUSES),
    [activeStatuses],
  );

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen((value) => !value);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  useEffect(() => {
    if (sortedProjects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    setSelectedProjectId((previous) => {
      if (previous && sortedProjects.some((project) => project.id === previous)) {
        return previous;
      }
      return sortedProjects[0]?.id ?? null;
    });
  }, [sortedProjects]);

  useEffect(() => {
    if (!selectedProjectId) {
      setTaskModalOpen(false);
      setTaskModalError(null);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    setTaskEditModalId(null);
    setTaskEditModalError(null);
    setTaskEditModalSubmitting(false);
  }, [selectedProjectId]);

  const {
    tasks,
    isLoading: tasksLoading,
    error: tasksError,
    hasProject,
    creatingStatus: creatingTaskStatus,
    updatingTaskId,
    deletingTaskId,
    createTask,
    updateTask,
    deleteTask,
  } = useTasks(selectedProjectId, activeStatuses);

  const taskBeingEdited = useMemo(
    () =>
      taskEditModalId
        ? tasks.find((task) => task.taskId === taskEditModalId) ?? null
        : null,
    [taskEditModalId, tasks],
  );

  useEffect(() => {
    if (!taskEditModalId) {
      return;
    }
    if (!taskBeingEdited) {
      setTaskEditModalId(null);
      setTaskEditModalError(null);
      setTaskEditModalSubmitting(false);
    }
  }, [taskBeingEdited, taskEditModalId]);

  const commandItems = useMemo(() => {
    const defaultShortcutLabels = {
      projectShortcutLabel: 'Cmd+Option+P',
      taskShortcutLabel: 'Cmd+Option+T',
    };

    const { projectShortcutLabel, taskShortcutLabel } = (() => {
      if (typeof navigator === 'undefined') {
        return defaultShortcutLabels;
      }
      const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
      const platform = nav.userAgentData?.platform ?? nav.platform ?? '';
      const normalized = platform.toLowerCase();
      const isApple =
        normalized.includes('mac') || normalized.includes('iphone') || normalized.includes('ipad');
      if (isApple) {
        return defaultShortcutLabels;
      }
      return {
        projectShortcutLabel: 'Ctrl+Alt+P',
        taskShortcutLabel: 'Ctrl+Alt+T',
      };
    })();

    return [
      {
        id: 'create-project',
        label: `Create project (${projectShortcutLabel})`,
        description: 'Start a new project',
        disabled: false,
      },
      {
        id: 'create-task',
        label: `Create task (${taskShortcutLabel})`,
        description: selectedProject ? `Add a task to ${selectedProject.name}` : `Select a project to enable`,
        disabled: !selectedProject,
      },
    ];
  }, [selectedProject]);

  const resetErrors = useCallback(() => {
    setFormError(null);
    setBoardError(null);
  }, []);

  const handleOpenCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);

  const handleCloseCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, []);

  const handleSelectProject = useCallback(
    (projectId: string) => {
      setSelectedProjectId(projectId);
      setProjectFormMode(null);
      resetErrors();
    },
    [resetErrors],
  );

  const handleCreateRequest = useCallback(() => {
    setProjectFormMode('create');
    resetErrors();
  }, [resetErrors]);

  const handleOpenTaskModal = useCallback(() => {
    if (!selectedProjectId) {
      return;
    }
    resetErrors();
    setTaskModalError(null);
    setTaskModalSubmitting(false);
    setTaskModalOpen(true);
  }, [resetErrors, selectedProjectId]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const isPrimaryModifier = event.metaKey || event.ctrlKey;
      if (!isPrimaryModifier) {
        return;
      }
      const hasAlt = event.altKey;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingTarget =
        tagName === 'input' || tagName === 'textarea' || target?.isContentEditable;

      if (isTypingTarget) {
        return;
      }

      if (event.code === 'KeyP') {
        if (!hasAlt) {
          return;
        }
        event.preventDefault();
        handleCreateRequest();
        return;
      }

      if (event.code === 'KeyT') {
        if (!hasAlt) {
          return;
        }
        event.preventDefault();
        handleOpenTaskModal();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [handleCreateRequest, handleOpenTaskModal]);

  const handleEditRequest = useCallback(
    (project: Project) => {
      setSelectedProjectId(project.id);
      setProjectFormMode('edit');
      resetErrors();
    },
    [resetErrors],
  );

  const handleDeleteRequest = useCallback(
    (project: Project) => {
      setPendingDeleteProject(project);
      resetErrors();
    },
    [resetErrors],
  );

  const handleCancelForm = useCallback(() => {
    setProjectFormMode(null);
    resetErrors();
  }, [resetErrors]);

  const handleTaskModalCancel = useCallback(() => {
    if (taskModalSubmitting) {
      return;
    }
    setTaskModalOpen(false);
    setTaskModalError(null);
  }, [taskModalSubmitting]);

  const handleAddStatus = useCallback(
    async (status: string) => {
      if (!selectedProject) {
        throw new Error('Select a project before adding statuses');
      }

      const normalized = status.trim().replace(/\s+/g, ' ').toUpperCase();
      if (!normalized) {
        throw new Error('Enter a status name');
      }

      const exists = selectedProject.statuses.some(
        (current) => current.toLowerCase() === normalized.toLowerCase(),
      );
      if (exists) {
        throw new Error('That status already exists');
      }

      try {
        setBoardError(null);
        await updateProjectStatuses(selectedProject.id, [...selectedProject.statuses, normalized]);
      } catch (err) {
        const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
        setBoardError(message);
        throw new Error(message);
      }
    },
    [selectedProject, updateProjectStatuses],
  );

  const handleReorderStatuses = useCallback(
    async (nextStatuses: readonly TaskStatus[]) => {
      if (!selectedProject) {
        throw new Error('Select a project before reordering statuses');
      }

      const isSameOrder =
        selectedProject.statuses.length === nextStatuses.length &&
        selectedProject.statuses.every((status, index) => status === nextStatuses[index]);

      if (isSameOrder) {
        return;
      }

      try {
        setBoardError(null);
        await updateProjectStatuses(selectedProject.id, [...nextStatuses]);
      } catch (err) {
        const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
        setBoardError(message);
        throw new Error(message);
      }
    },
    [selectedProject, updateProjectStatuses],
  );

  const handleCreateSubmit = useCallback(
    async ({ name, description }: { name: string; description: string }) => {
      if (!name) {
        setFormError('Project name is required');
        return;
      }

      try {
        setFormError(null);
        const created = await createProject({
          name,
          description: description ? description : null,
        });
        setProjectFormMode(null);
        if (created?.id) {
          setSelectedProjectId(created.id);
        }
      } catch (err) {
        setFormError(err instanceof Error ? err.message : UNKNOWN_ERROR);
      }
    },
    [createProject],
  );

  const handleEditSubmit = useCallback(
    async ({ name, description }: { name: string; description: string }) => {
      if (!selectedProject) {
        return;
      }

      if (!name) {
        setFormError('Project name is required');
        return;
      }

      try {
        setFormError(null);
        await updateProject(selectedProject.id, {
          name,
          description: description ? description : null,
        });
        setProjectFormMode(null);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : UNKNOWN_ERROR);
      }
    },
    [selectedProject, updateProject],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDeleteProject) {
      return;
    }

    try {
      setBoardError(null);
      await deleteProject(pendingDeleteProject.id);
      if (selectedProjectId === pendingDeleteProject.id) {
        setProjectFormMode(null);
      }
      setPendingDeleteProject(null);
    } catch (err) {
      setBoardError(err instanceof Error ? err.message : UNKNOWN_ERROR);
    }
  }, [deleteProject, pendingDeleteProject, selectedProjectId]);

  const handleDeleteCancel = useCallback(() => {
    if (deletingProjectId) {
      return;
    }
    setPendingDeleteProject(null);
  }, [deletingProjectId]);

  const handleTaskCreate = useCallback(
    async (values: {
      name: string;
      description: string | null;
      status: TaskStatus;
      priority: TaskPriority;
      startDate?: string | null;
      dueDate?: string | null;
      labels: string[];
    }) => {
      try {
        setBoardError(null);
        await createTask({
          name: values.name,
          description: values.description,
          status: values.status,
          priority: values.priority,
          startDate: values.startDate ?? null,
          dueDate: values.dueDate ?? null,
          labels: values.labels,
        });
        await refreshProjects().catch(() => {});
      } catch (err) {
        const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
        setBoardError(message);
        throw err;
      }
    },
    [createTask, refreshProjects],
  );

  const handleTaskModalSubmit = useCallback(
    async (values: {
      name: string;
      description: string | null;
      status: TaskStatus;
      priority: TaskPriority;
      startDate?: string | null;
      dueDate?: string | null;
      labels: string[];
    }) => {
      try {
        setTaskModalSubmitting(true);
        setTaskModalError(null);
        setBoardError(null);
        await createTask({
          name: values.name,
          description: values.description,
          status: values.status,
          priority: values.priority,
          startDate: values.startDate ?? null,
          dueDate: values.dueDate ?? null,
          labels: values.labels,
        });
        await refreshProjects().catch(() => {});
        setTaskModalOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
        setTaskModalError(message);
      } finally {
        setTaskModalSubmitting(false);
      }
    },
    [createTask, refreshProjects],
  );

  const handleCommandSelect = useCallback(
    (commandId: string) => {
      handleCloseCommandPalette();
      if (commandId === 'create-project') {
        handleCreateRequest();
        return;
      }
      if (commandId === 'create-task') {
        handleOpenTaskModal();
      }
    },
    [handleCloseCommandPalette, handleCreateRequest, handleOpenTaskModal],
  );

  const handleTaskUpdate = useCallback(
    async (
      taskId: string,
      values: {
        name: string;
        description: string | null;
        status: TaskStatus;
        priority: TaskPriority;
        startDate?: string | null;
        dueDate?: string | null;
        labels: string[];
      },
    ) => {
      try {
        setBoardError(null);
        await updateTask(taskId, {
          name: values.name,
          description: values.description,
          status: values.status,
          priority: values.priority,
          startDate: values.startDate ?? null,
          dueDate: values.dueDate ?? null,
          labels: values.labels,
        });
        await refreshProjects().catch(() => {});
      } catch (err) {
        const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
        setBoardError(message);
        throw err;
      }
    },
    [refreshProjects, updateTask],
  );

  const handleTaskEditRequest = useCallback(
    (taskId: string) => {
      const task = tasks.find((item) => item.taskId === taskId);
      if (!task) {
        return;
      }
      resetErrors();
      setTaskEditModalId(taskId);
      setTaskEditModalError(null);
      setTaskEditModalSubmitting(false);
    },
    [resetErrors, tasks],
  );

  const handleTaskEditModalSubmit = useCallback(
    async (values: {
      name: string;
      description: string | null;
      status: TaskStatus;
      priority: TaskPriority;
      startDate?: string | null;
      dueDate?: string | null;
      labels: string[];
    }) => {
      if (!taskEditModalId) {
        return;
      }
      try {
        setTaskEditModalSubmitting(true);
        setTaskEditModalError(null);
        await handleTaskUpdate(taskEditModalId, values);
        setTaskEditModalId(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
        setTaskEditModalError(message);
      } finally {
        setTaskEditModalSubmitting(false);
      }
    },
    [handleTaskUpdate, taskEditModalId],
  );

  const handleTaskEditModalCancel = useCallback(() => {
    if (taskEditModalSubmitting) {
      return;
    }
    setTaskEditModalId(null);
    setTaskEditModalError(null);
  }, [taskEditModalSubmitting]);

  const handleTaskDeleteRequest = useCallback(
    (taskId: string) => {
      const task = tasks.find((item) => item.taskId === taskId);
      if (!task) {
        return Promise.resolve();
      }

      setBoardError(null);
      setPendingDeleteTask(task);

      if (taskDeletePromiseRef.current) {
        taskDeletePromiseRef.current.reject(new Error('Replaced'));
      }

      return new Promise<void>((resolve, reject) => {
        taskDeletePromiseRef.current = { resolve, reject };
      });
    },
    [tasks],
  );

  const handleTaskDeleteConfirm = useCallback(async () => {
    if (!pendingDeleteTask) {
      return;
    }

    try {
      setBoardError(null);
      await deleteTask(pendingDeleteTask.taskId);
      taskDeletePromiseRef.current?.resolve();
      setPendingDeleteTask(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
      setBoardError(message);
      taskDeletePromiseRef.current?.reject(err);
    } finally {
      taskDeletePromiseRef.current = null;
    }
  }, [deleteTask, pendingDeleteTask]);

  const handleTaskDeleteCancel = useCallback(() => {
    if (pendingDeleteTask && deletingTaskId === pendingDeleteTask.taskId) {
      return;
    }
    taskDeletePromiseRef.current?.reject(new Error('Cancelled'));
    taskDeletePromiseRef.current = null;
    setPendingDeleteTask(null);
  }, [deletingTaskId, pendingDeleteTask]);

  const handleSelectView = useCallback((view: TaskView) => {
    setTaskView(view);
  }, [setTaskView]);

  const isUpdatingSelectedProject = Boolean(selectedProject && updatingProjectId === selectedProject.id);

  const isUpdatingSelected =
    selectedProject && updatingProjectId === selectedProject.id && projectFormMode === 'edit';
  const projectFormSubmitting =
    projectFormMode === 'create'
      ? creating
      : projectFormMode === 'edit'
        ? Boolean(isUpdatingSelected)
        : false;

  return (
    <div className="flex min-h-screen lg:h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 lg:flex-row lg:overflow-hidden">
      <div className="flex-shrink-0 px-4 py-6 sm:px-6 lg:px-10 lg:min-h-screen lg:h-screen lg:w-80">
        <div className="h-full">
          <ProjectSidebar
            projects={sortedProjects}
            isLoading={projectsLoading}
            error={projectsError}
            selectedProjectId={selectedProjectId}
            deletingProjectId={deletingProjectId}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateRequest}
            onEditProject={handleEditRequest}
            onDeleteProject={handleDeleteRequest}
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-screen lg:h-screen flex-col gap-6 px-4 pb-6 sm:px-6 lg:px-10 overflow-hidden">
        <Topbar
          activeView={taskView}
          onSelectView={handleSelectView}
          onOpenCommandPalette={handleOpenCommandPalette}
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <section className="glass-panel flex h-full min-h-0 flex-col gap-6 overflow-hidden p-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="panel-section-title">
                {projectFormMode === 'create' ? 'New project' : 'Workspace overview'}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                {projectFormMode === 'create'
                  ? 'Create a project'
                  : selectedProject?.name ?? 'Select a project'}
              </h1>
              {projectFormMode !== 'create' && selectedProject?.description ? (
                <p className="max-w-2xl text-sm text-white/70">{selectedProject.description}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {projectFormMode === null && selectedProject ? (
                <>
                  <button
                    type="button"
                    onClick={handleOpenTaskModal}
                    className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    New task
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedProject) {
                        handleEditRequest(selectedProject);
                      }
                    }}
                    className="inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
                  >
                    Edit project
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={handleCreateRequest}
                className="inline-flex items-center rounded-full border border-dashed border-white/30 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white/60 hover:text-white"
              >
                New project
              </button>
            </div>
          </header>

          {boardError && projectFormMode === null ? (
            <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {boardError}
            </div>
          ) : null}

          {projectFormMode === null && !hasProject ? (
            <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-white/70">
              Choose a project to view its tasks.
            </div>
          ) : null}

          <div className="flex-1 min-h-0 overflow-hidden">
            {projectFormMode === null && hasProject ? (
              taskView === 'board' ? (
                <TaskBoard
                  key={`${selectedProjectId ?? 'no-project'}-board`}
                  tasks={tasks}
                  statuses={activeStatuses}
                  labels={activeLabels}
                  isLoading={tasksLoading}
                  error={tasksError}
                  creatingStatus={creatingTaskStatus}
                  updatingTaskId={updatingTaskId}
                  deletingTaskId={deletingTaskId}
                  isUpdatingStatuses={isUpdatingSelectedProject}
                  onCreateTask={handleTaskCreate}
                  onUpdateTask={handleTaskUpdate}
                  onAddStatus={handleAddStatus}
                  onReorderStatuses={handleReorderStatuses}
                  onEditTask={handleTaskEditRequest}
                />
              ) : (
                <TaskList
                  key={`${selectedProjectId ?? 'no-project'}-list`}
                  tasks={tasks}
                  statuses={activeStatuses}
                  labels={activeLabels}
                  isLoading={tasksLoading}
                  error={tasksError}
                  creatingStatus={creatingTaskStatus}
                  updatingTaskId={updatingTaskId}
                  deletingTaskId={deletingTaskId}
                  onCreateTask={handleTaskCreate}
                  onUpdateTask={handleTaskUpdate}
                  onEditTask={handleTaskEditRequest}
                />
              )
            ) : null}
          </div>
        </section>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDeleteTask)}
        title="Delete task"
        description={
          pendingDeleteTask
            ? `Are you sure you want to delete “${pendingDeleteTask.name}”? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete task"
        isConfirming={
          pendingDeleteTask ? deletingTaskId === pendingDeleteTask.taskId : false
        }
        onConfirm={handleTaskDeleteConfirm}
        onCancel={handleTaskDeleteCancel}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteProject)}
        title="Delete project"
        description={
          pendingDeleteProject
            ? `Are you sure you want to delete “${pendingDeleteProject.name}”? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete project"
        isConfirming={Boolean(deletingProjectId)}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <CommandPalette
        open={isCommandPaletteOpen}
        commands={commandItems}
        onClose={handleCloseCommandPalette}
        onSelect={handleCommandSelect}
      />

      <Modal
        open={projectFormMode !== null}
        title={projectFormMode === 'create' ? 'Create project' : 'Update project'}
        onClose={handleCancelForm}
        isDismissDisabled={projectFormSubmitting}
      >
        {projectFormMode === 'create' ? (
          <ProjectForm
            mode="create"
            isSubmitting={creating}
            error={formError}
            onSubmit={handleCreateSubmit}
            onCancel={handleCancelForm}
          />
        ) : null}

        {projectFormMode === 'edit' && selectedProject ? (
          <ProjectForm
            mode="edit"
            initialValues={{
              name: selectedProject.name,
              description: selectedProject.description,
            }}
            isSubmitting={Boolean(isUpdatingSelected)}
            error={formError}
            onSubmit={handleEditSubmit}
            onCancel={handleCancelForm}
          />
        ) : null}
      </Modal>

      <Modal
        open={isTaskModalOpen}
        title="Create task"
        description={selectedProject ? `Add a task to ${selectedProject.name}` : undefined}
        onClose={handleTaskModalCancel}
        isDismissDisabled={taskModalSubmitting}
      >
        <TaskEditor
          mode="create"
          status={defaultModalStatus}
          statuses={statusOptionsForModal}
          availableLabels={activeLabels}
          isSubmitting={taskModalSubmitting}
          error={taskModalError}
          onSubmit={handleTaskModalSubmit}
          onCancel={handleTaskModalCancel}
        />
      </Modal>

      <Modal
        open={Boolean(taskBeingEdited)}
        title="Edit task"
        description={
          taskBeingEdited && selectedProject
            ? `Update ${taskBeingEdited.name} in ${selectedProject.name}`
            : undefined
        }
        onClose={handleTaskEditModalCancel}
        isDismissDisabled={
          taskEditModalSubmitting ||
          (taskBeingEdited ? deletingTaskId === taskBeingEdited.taskId : false)
        }
        size="wide"
      >
        {taskBeingEdited ? (
          <TaskEditor
            mode="edit"
            status={taskBeingEdited.status}
            statuses={statusOptionsForModal}
            availableLabels={activeLabels}
            initialValues={{
              name: taskBeingEdited.name,
              description: taskBeingEdited.description,
              priority: taskBeingEdited.priority,
              startDate: taskBeingEdited.startDate,
              dueDate: taskBeingEdited.dueDate,
              labels: taskBeingEdited.labels,
            }}
            isSubmitting={
              taskEditModalSubmitting || updatingTaskId === taskBeingEdited.taskId
            }
            isDeleting={deletingTaskId === taskBeingEdited.taskId}
            error={taskEditModalError}
            onSubmit={handleTaskEditModalSubmit}
            onCancel={handleTaskEditModalCancel}
            onDelete={async () => {
              try {
                setTaskEditModalError(null);
                await handleTaskDeleteRequest(taskBeingEdited.taskId);
                setTaskEditModalId(null);
              } catch (err) {
                if (err instanceof Error) {
                  if (err.message === 'Cancelled' || err.message === 'Replaced') {
                    return;
                  }
                  setTaskEditModalError(err.message);
                  return;
                }
                setTaskEditModalError(UNKNOWN_ERROR);
              }
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

export default App;
