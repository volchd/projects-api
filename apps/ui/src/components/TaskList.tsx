import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { Task, TaskPriority, TaskStatus } from '../types';
import { DEFAULT_TASK_STATUSES, toStatusOptions } from '../constants/taskStatusOptions';
import { TaskEditor } from './TaskEditor';

type TaskEditorValues = {
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
};

type TaskListProps = {
  tasks: Task[];
  statuses: readonly TaskStatus[];
  isLoading: boolean;
  error: string | null;
  creatingStatus: TaskStatus | null;
  updatingTaskId: string | null;
  deletingTaskId: string | null;
  onCreateTask: (values: TaskEditorValues) => Promise<void>;
  onUpdateTask: (taskId: string, values: TaskEditorValues) => Promise<void>;
  onEditTask: (taskId: string) => void;
};

export const TaskList = ({
  tasks,
  statuses,
  isLoading,
  error,
  creatingStatus,
  updatingTaskId,
  deletingTaskId,
  onCreateTask,
  onUpdateTask,
  onEditTask,
}: TaskListProps) => {
  const [activeCreateStatus, setActiveCreateStatus] = useState<TaskStatus | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  const orderedStatuses = useMemo(() => {
    const base = (statuses.length ? [...statuses] : [...DEFAULT_TASK_STATUSES]) as TaskStatus[];
    const seen = new Set(base.map((status) => status.toLowerCase()));

    for (const task of tasks) {
      const key = task.status.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        base.push(task.status);
      }
    }

    return base;
  }, [statuses, tasks]);

  const statusOptions = useMemo(() => toStatusOptions(orderedStatuses), [orderedStatuses]);

  const tasksByStatus = useMemo(() => {
    const grouped = orderedStatuses.reduce<Record<TaskStatus, Task[]>>((acc, status) => {
      acc[status] = [];
      return acc;
    }, {} as Record<TaskStatus, Task[]>);

    const withTasks = tasks.reduce<Record<TaskStatus, Task[]>>((acc, task) => {
      if (!acc[task.status]) {
        acc[task.status] = [];
      }
      acc[task.status].push(task);
      return acc;
    }, grouped);

    for (const statusTasks of Object.values(withTasks)) {
      statusTasks.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }

    return withTasks;
  }, [orderedStatuses, tasks]);

  const tasksById = useMemo(() => {
    return tasks.reduce<Record<string, Task>>((acc, task) => {
      acc[task.taskId] = task;
      return acc;
    }, {});
  }, [tasks]);

  useEffect(() => {
    if (activeCreateStatus && !orderedStatuses.includes(activeCreateStatus)) {
      setActiveCreateStatus(null);
    }
  }, [activeCreateStatus, orderedStatuses]);

  const handleCreateSubmit = async (values: TaskEditorValues) => {
    try {
      await onCreateTask(values);
      setActiveCreateStatus(null);
    } catch {
      // Keep editor open; error surfaces at parent.
    }
  };

  const isCreating = (status: TaskStatus) => creatingStatus === status;

  const handleDragStart = useCallback((event: ReactDragEvent<HTMLElement>, taskId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);
    setDraggingTaskId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingTaskId(null);
    setDragOverStatus(null);
  }, []);

  const handleSectionDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, status: TaskStatus) => {
      if (!draggingTaskId) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (dragOverStatus !== status) {
        setDragOverStatus(status);
      }
    },
    [dragOverStatus, draggingTaskId],
  );

  const handleSectionDragLeave = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, status: TaskStatus) => {
      if (!draggingTaskId) {
        return;
      }
      const related = event.relatedTarget as Node | null;
      if (related && event.currentTarget.contains(related)) {
        return;
      }
      setDragOverStatus((current) => (current === status ? null : current));
    },
    [draggingTaskId],
  );

  const handleDrop = useCallback(
    async (event: ReactDragEvent<HTMLDivElement>, status: TaskStatus) => {
      if (!draggingTaskId) {
        return;
      }

      event.preventDefault();
      setDragOverStatus(null);

      const task = tasksById[draggingTaskId];
      setDraggingTaskId(null);

      if (!task || task.status === status) {
        return;
      }

      try {
        await onUpdateTask(task.taskId, {
          name: task.name,
          description: task.description,
          status,
          priority: task.priority,
          startDate: task.startDate,
          dueDate: task.dueDate,
        });
      } catch {
        // Errors surface via parent handlers.
      }
    },
    [draggingTaskId, onUpdateTask, tasksById],
  );

  return (
    <div className="list-view">
      {statusOptions.map((statusOption) => {
        const statusTasks = tasksByStatus[statusOption.key] ?? [];
        const showLoading = isLoading && statusTasks.length === 0;
        const showError = Boolean(error) && statusTasks.length === 0;
        const showEmpty = !isLoading && !error && statusTasks.length === 0 && activeCreateStatus !== statusOption.key;
        const isDragTarget = Boolean(draggingTaskId) && dragOverStatus === statusOption.key;

        return (
          <section
            className={`list-view__section${isDragTarget ? ' list-view__section--droppable' : ''}`}
            key={statusOption.key}
          >
            <header className="list-view__section-header">
              <div className="list-view__section-title">
                <h2>{statusOption.label}</h2>
                <span className="list-view__count">{statusTasks.length}</span>
              </div>
              {activeCreateStatus === statusOption.key ? null : (
                <button
                  type="button"
                  className="list-view__add"
                  onClick={() => {
                    setActiveCreateStatus(statusOption.key);
                  }}
                  disabled={Boolean(creatingStatus)}
                >
                  <span aria-hidden="true">+</span>
                  Add Task
                </button>
              )}
            </header>
            <div
              className={`list-view__body${isDragTarget ? ' list-view__body--droppable' : ''}`}
              onDragOver={(event) => handleSectionDragOver(event, statusOption.key)}
              onDragEnter={(event) => handleSectionDragOver(event, statusOption.key)}
              onDragLeave={(event) => handleSectionDragLeave(event, statusOption.key)}
              onDrop={(event) => handleDrop(event, statusOption.key)}
            >
              {activeCreateStatus === statusOption.key ? (
                <TaskEditor
                  mode="create"
                  status={statusOption.key}
                  statuses={statusOptions}
                  isSubmitting={isCreating(statusOption.key)}
                  onSubmit={handleCreateSubmit}
                  onCancel={() => setActiveCreateStatus(null)}
                />
              ) : null}

              {showLoading ? <div className="list-view__placeholder">Loading…</div> : null}
              {showError ? <div className="list-view__placeholder list-view__placeholder--error">{error}</div> : null}
              {showEmpty ? (
                <div className="list-view__placeholder list-view__placeholder--muted">No tasks yet.</div>
              ) : null}

              {statusTasks.map((task) => (
                <article
                  className={`task-card task-card--list${
                    draggingTaskId === task.taskId ? ' task-card--dragging' : ' task-card--draggable'
                  }`}
                  key={task.taskId}
                  draggable
                  onDragStart={(event) => handleDragStart(event, task.taskId)}
                  onDragEnd={handleDragEnd}
                  aria-grabbed={draggingTaskId === task.taskId}
                >
                  <header>
                    <h3>{task.name}</h3>
                    <button
                      type="button"
                      aria-label={`Edit ${task.name}`}
                      onClick={() => {
                        setActiveCreateStatus(null);
                        onEditTask(task.taskId);
                      }}
                      disabled={updatingTaskId === task.taskId || deletingTaskId === task.taskId}
                    >
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
          </section>
        );
      })}
    </div>
  );
};
