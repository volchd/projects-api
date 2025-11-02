import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { useProjects } from './hooks/useProjects';
import { useTasks } from './hooks/useTasks';
import { ProjectSidebar } from './components/ProjectSidebar';
import { ProjectForm } from './components/ProjectForm';
import { TaskBoard } from './components/TaskBoard';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Topbar } from './components/Topbar';
import type { Project, Task, TaskStatus } from './types';

type ProjectFormMode = 'create' | 'edit' | null;

const UNKNOWN_ERROR = 'Unknown error';

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
  } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectFormMode, setProjectFormMode] = useState<ProjectFormMode>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<Task | null>(null);
  const taskDeletePromiseRef = useRef<{ resolve: () => void; reject: (reason?: unknown) => void } | null>(null);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const selectedProject = useMemo(
    () => sortedProjects.find((project) => project.id === selectedProjectId) ?? null,
    [sortedProjects, selectedProjectId],
  );

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
  } = useTasks(selectedProjectId);

  const resetErrors = useCallback(() => {
    setFormError(null);
    setBoardError(null);
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
    async (values: { name: string; description: string | null; status: TaskStatus }) => {
      try {
        setBoardError(null);
        await createTask({
          name: values.name,
          description: values.description,
          status: values.status,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
        setBoardError(message);
        throw err;
      }
    },
    [createTask],
  );

  const handleTaskUpdate = useCallback(
    async (taskId: string, values: { name: string; description: string | null; status: TaskStatus }) => {
      try {
        setBoardError(null);
        await updateTask(taskId, {
          name: values.name,
          description: values.description,
          status: values.status,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
        setBoardError(message);
        throw err;
      }
    },
    [updateTask],
  );

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

  const isUpdatingSelected =
    selectedProject && updatingProjectId === selectedProject.id && projectFormMode === 'edit';

  return (
    <div className="app">
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

      <main className="main">
        <Topbar />
        <section className="board">
          <header className="board__header">
            <h1>
              {projectFormMode === 'create'
                ? 'Create a project'
                : selectedProject?.name ?? 'Select a project'}
            </h1>
            {projectFormMode !== 'create' && selectedProject?.description ? (
              <p>{selectedProject.description}</p>
            ) : null}
          </header>

          {boardError && projectFormMode === null ? (
            <div className="board__alert board__alert--error">{boardError}</div>
          ) : null}

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

          {projectFormMode === null && !hasProject ? (
            <div className="board__empty">Choose a project to view its tasks.</div>
          ) : null}

          {projectFormMode === null && hasProject ? (
            <TaskBoard
              key={selectedProjectId ?? 'no-project'}
              tasks={tasks}
              isLoading={tasksLoading}
              error={tasksError}
              creatingStatus={creatingTaskStatus}
              updatingTaskId={updatingTaskId}
              deletingTaskId={deletingTaskId}
              onCreateTask={handleTaskCreate}
              onUpdateTask={handleTaskUpdate}
              onDeleteTask={handleTaskDeleteRequest}
            />
          ) : null}
        </section>
      </main>

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
    </div>
  );
}

export default App;
