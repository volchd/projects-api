import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import clsx from 'clsx';
import type { Task, TaskLabel, TaskPriority, TaskStatus } from '../types';
import { DEFAULT_TASK_STATUSES, toStatusOptions } from '../constants/taskStatusOptions';
import { TaskEditor } from './TaskEditor';

type TaskEditorValues = {
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
  labels: TaskLabel[];
};

type TaskListProps = {
  tasks: Task[];
  statuses: readonly TaskStatus[];
  labels: readonly TaskLabel[];
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
  labels,
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
          labels: task.labels,
        });
      } catch {
        // Errors surface via parent handlers.
      }
    },
    [draggingTaskId, onUpdateTask, tasksById],
  );

  return (
    <div className="space-y-6">
      {statusOptions.map((statusOption) => {
        const statusTasks = tasksByStatus[statusOption.key] ?? [];
        const showLoading = isLoading && statusTasks.length === 0;
        const showError = Boolean(error) && statusTasks.length === 0;
        const showEmpty = !isLoading && !error && statusTasks.length === 0 && activeCreateStatus !== statusOption.key;
        const isDragTarget = Boolean(draggingTaskId) && dragOverStatus === statusOption.key;

        return (
          <section
            className={clsx(
              'rounded-3xl border border-white/10 bg-white/5 p-5 shadow-card transition',
              isDragTarget && 'border-white/40',
            )}
            key={statusOption.key}
          >
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">{statusOption.label}</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white">
                  {statusTasks.length}
                </span>
              </div>
              {activeCreateStatus === statusOption.key ? null : (
                <button
                  type="button"
                  className="inline-flex items-center rounded-2xl border border-dashed border-white/20 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white disabled:opacity-60"
                  onClick={() => {
                    setActiveCreateStatus(statusOption.key);
                  }}
                  disabled={Boolean(creatingStatus)}
                >
                  <span aria-hidden="true" className="mr-1 text-lg">
                    +
                  </span>
                  Add Task
                </button>
              )}
            </header>
            <div
              className={clsx(
                'mt-4 flex flex-col gap-3',
                isDragTarget && 'rounded-2xl border border-dashed border-white/30 bg-white/5 p-3',
              )}
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
                  availableLabels={labels}
                  isSubmitting={isCreating(statusOption.key)}
                  onSubmit={handleCreateSubmit}
                  onCancel={() => setActiveCreateStatus(null)}
                />
              ) : null}

              {showLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/60">
                  Loading…
                </div>
              ) : null}
              {showError ? (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-6 text-center text-sm text-rose-100">
                  {error}
                </div>
              ) : null}
              {showEmpty ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/50">
                  No tasks yet.
                </div>
              ) : null}

              {statusTasks.map((task) => (
                <article
                  className={clsx(
                    'rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10',
                    draggingTaskId === task.taskId
                      ? 'cursor-grabbing opacity-60'
                      : 'cursor-grab active:cursor-grabbing',
                    updatingTaskId === task.taskId && 'ring-2 ring-indigo-400/60',
                    deletingTaskId === task.taskId && 'opacity-40',
                  )}
                  key={task.taskId}
                  draggable
                  onDragStart={(event) => handleDragStart(event, task.taskId)}
                  onDragEnd={handleDragEnd}
                  aria-grabbed={draggingTaskId === task.taskId}
                >
                  <header className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-white">{task.name}</h3>
                      <p className="text-xs uppercase tracking-wide text-white/50">{task.status}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Edit ${task.name}`}
                      onClick={() => {
                        setActiveCreateStatus(null);
                        onEditTask(task.taskId);
                      }}
                      disabled={updatingTaskId === task.taskId || deletingTaskId === task.taskId}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-white/10 text-white/70 transition hover:border-white/40 hover:text-white disabled:opacity-40"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
                        <path
                          fill="currentColor"
                          d="M3 17.25V21h3.75l11-11.06-3.75-3.75L3 17.25ZM20.71 7a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.82 1.82 3.75 3.75L20.71 7Z"
                        />
                      </svg>
                    </button>
                  </header>
                  {task.labels.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {task.labels.map((label) => (
                        <span
                          key={`${task.taskId}-label-${label.toLowerCase()}`}
                          className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {task.description ? (
                    <p className="mt-2 text-sm text-white/70">{task.description}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
