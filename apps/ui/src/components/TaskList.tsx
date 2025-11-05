import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
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
    <div className="flex flex-col flex-1 gap-6 overflow-y-auto">
      {statusOptions.map((statusOption) => {
        const statusTasks = tasksByStatus[statusOption.key] ?? [];
        const showLoading = isLoading && statusTasks.length === 0;
        const showError = Boolean(error) && statusTasks.length === 0;
        const showEmpty =
          !isLoading && !error && statusTasks.length === 0 && activeCreateStatus !== statusOption.key;
        const isDragTarget = Boolean(draggingTaskId) && dragOverStatus === statusOption.key;

        return (
          <section
            className={`flex flex-col gap-4 p-4 bg-white border border-gray-200 rounded-2xl shadow-md dark:bg-gray-800 dark:border-gray-700 ${
              isDragTarget
                ? 'bg-indigo-100 border-indigo-300 shadow-inner dark:bg-indigo-900/20 dark:border-indigo-500/40'
                : ''
            }`}
            key={statusOption.key}
          >
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2.5">
                <h2 className="text-base font-medium">{statusOption.label}</h2>
                <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-sm font-semibold text-gray-900 bg-indigo-100 rounded-full dark:bg-indigo-900/40 dark:text-gray-50">
                  {statusTasks.length}
                </span>
              </div>
              {activeCreateStatus === statusOption.key ? null : (
                <button
                  type="button"
                  className="inline-flex items-center justify-start gap-2 px-4 py-2 text-sm font-medium text-gray-900 transition-colors bg-indigo-100 rounded-lg dark:bg-indigo-900/40 dark:text-gray-50 hover:bg-indigo-200/80 dark:hover:bg-indigo-900/60"
                  onClick={() => {
                    setActiveCreateStatus(statusOption.key);
                  }}
                  disabled={Boolean(creatingStatus)}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center w-5 h-5 font-semibold text-white bg-indigo-600 rounded-full dark:bg-indigo-500"
                  >
                    +
                  </span>
                  Add Task
                </button>
              )}
            </header>
            <div
              className={`flex flex-col gap-3.5 ${
                isDragTarget
                  ? 'bg-indigo-100/80 dark:bg-indigo-900/30 rounded-xl'
                  : ''
              }`}
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
                <div className="px-4 py-3 text-sm text-center text-gray-500 border border-dashed border-gray-300 rounded-xl dark:border-gray-600 dark:text-gray-400">
                  Loading…
                </div>
              ) : null}
              {showError ? (
                <div className="px-4 py-3 text-sm text-center text-yellow-700 bg-yellow-100 border border-dashed border-yellow-400 rounded-xl dark:bg-yellow-900/20 dark:border-yellow-400/40 dark:text-yellow-400">
                  {error}
                </div>
              ) : null}
              {showEmpty ? (
                <div className="px-4 py-3 text-sm text-center text-gray-500 border border-dashed border-gray-300 rounded-xl dark:border-gray-600 dark:text-gray-400">
                  No tasks yet.
                </div>
              ) : null}

              {statusTasks.map((task) => (
                <article
                  className={`relative flex flex-col gap-2.5 p-4 bg-white border border-gray-200 rounded-2xl shadow-md cursor-grab active:cursor-grabbing dark:bg-gray-800 dark:border-gray-700 group ${
                    draggingTaskId === task.taskId ? 'opacity-60' : ''
                  }`}
                  key={task.taskId}
                  draggable
                  onDragStart={(event) => handleDragStart(event, task.taskId)}
                  onDragEnd={handleDragEnd}
                  aria-grabbed={draggingTaskId === task.taskId}
                >
                  <header className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-medium">{task.name}</h3>
                    <button
                      type="button"
                      aria-label={`Edit ${task.name}`}
                      onClick={() => {
                        setActiveCreateStatus(null);
                        onEditTask(task.taskId);
                      }}
                      disabled={updatingTaskId === task.taskId || deletingTaskId === task.taskId}
                      className="p-1 text-gray-500 transition-colors rounded-lg opacity-0 pointer-events-none dark:text-gray-400 group-hover:opacity-100 group-hover:pointer-events-auto hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700/60 dark:hover:text-gray-50"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5">
                        <path
                          fill="currentColor"
                          d="M3 17.25V21h3.75l11-11.06-3.75-3.75L3 17.25ZM20.71 7a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.82 1.82 3.75 3.75L20.71 7Z"
                        />
                      </svg>
                    </button>
                  </header>
                  {task.labels.length ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {task.labels.map((label) => (
                        <span
                          key={`${task.taskId}-label-${label.toLowerCase()}`}
                          className="inline-flex items-center px-2 py-0.5 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full dark:bg-indigo-900/40 dark:text-indigo-300"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {task.description ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{task.description}</p>
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
