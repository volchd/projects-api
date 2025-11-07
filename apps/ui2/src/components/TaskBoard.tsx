import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type TaskBoardProps = {
  tasks: Task[];
  statuses: readonly TaskStatus[];
  labels: readonly TaskLabel[];
  isLoading: boolean;
  error: string | null;
  creatingStatus: TaskStatus | null;
  updatingTaskId: string | null;
  deletingTaskId: string | null;
  isUpdatingStatuses: boolean;
  onCreateTask: (values: TaskEditorValues) => Promise<void>;
  onUpdateTask: (taskId: string, values: TaskEditorValues) => Promise<void>;
  onAddStatus: (status: string) => Promise<void>;
  onReorderStatuses: (statuses: readonly TaskStatus[]) => Promise<void>;
  onEditTask: (taskId: string) => void;
};

export const TaskBoard = ({
  tasks,
  statuses,
  labels,
  isLoading,
  error,
  creatingStatus,
  updatingTaskId,
  deletingTaskId,
  isUpdatingStatuses,
  onCreateTask,
  onUpdateTask,
  onAddStatus,
  onReorderStatuses,
  onEditTask,
}: TaskBoardProps) => {
  const [activeCreateStatus, setActiveCreateStatus] = useState<TaskStatus | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [draggingStatus, setDraggingStatus] = useState<TaskStatus | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [isDragOverAddColumn, setDragOverAddColumn] = useState(false);
  const [isAddingStatus, setIsAddingStatus] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [addStatusError, setAddStatusError] = useState<string | null>(null);
  const [isColumnsScrolling, setIsColumnsScrolling] = useState(false);
  const columnsRef = useRef<HTMLDivElement | null>(null);

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
  const sortableStatusKeys = useMemo(() => {
    const baseStatuses = statuses.length ? [...statuses] : [...DEFAULT_TASK_STATUSES];
    return new Set(baseStatuses.map((status) => status.toLowerCase()));
  }, [statuses]);

  const tasksByStatus = useMemo(() => {
    const base = orderedStatuses.reduce<Record<TaskStatus, Task[]>>((acc, status) => {
      acc[status] = [];
      return acc;
    }, {} as Record<TaskStatus, Task[]>);

    const withTasks = tasks.reduce<Record<TaskStatus, Task[]>>((acc, task) => {
      if (!acc[task.status]) {
        acc[task.status] = [];
      }
      acc[task.status].push(task);
      return acc;
    }, base);

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

  useEffect(() => {
    if (dragOverStatus && !orderedStatuses.includes(dragOverStatus)) {
      setDragOverStatus(null);
    }
  }, [dragOverStatus, orderedStatuses]);

  useEffect(() => {
    const node = columnsRef.current;
    if (!node) {
      return;
    }

    let hideTimeout: number | null = null;

    const handleScroll = () => {
      setIsColumnsScrolling((current) => {
        if (!current) {
          return true;
        }
        return current;
      });

      if (hideTimeout !== null) {
        window.clearTimeout(hideTimeout);
      }

      hideTimeout = window.setTimeout(() => {
        setIsColumnsScrolling(false);
      }, 900);
    };

    node.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      node.removeEventListener('scroll', handleScroll);
      if (hideTimeout !== null) {
        window.clearTimeout(hideTimeout);
      }
    };
  }, []);

  const handleCreateSubmit = async (values: TaskEditorValues) => {
    try {
      await onCreateTask(values);
      setActiveCreateStatus(null);
    } catch {
      // Leave the editor open; the parent component will surface the error.
    }
  };

  const isCreating = (status: TaskStatus) => creatingStatus === status;

  const normalizeStatusName = useCallback((value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase(), []);

  const handleStartAddStatus = useCallback(() => {
    setIsAddingStatus(true);
    setNewStatusName('');
    setAddStatusError(null);
  }, []);

  const handleCancelAddStatus = useCallback(() => {
    if (isUpdatingStatuses) {
      return;
    }
    setIsAddingStatus(false);
    setNewStatusName('');
    setAddStatusError(null);
  }, [isUpdatingStatuses]);

  const handleAddStatusSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isUpdatingStatuses) {
        return;
      }

      const normalized = normalizeStatusName(newStatusName);
      if (!normalized) {
        setAddStatusError('Enter a status name');
        return;
      }

      const normalizedKey = normalized.toLowerCase();
      if (orderedStatuses.some((status) => status.toLowerCase() === normalizedKey)) {
        setAddStatusError('That status already exists');
        return;
      }

      try {
        await onAddStatus(normalized);
        setIsAddingStatus(false);
        setNewStatusName('');
        setAddStatusError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add status';
        setAddStatusError(message);
      }
    },
    [isUpdatingStatuses, newStatusName, normalizeStatusName, onAddStatus, orderedStatuses],
  );

  const handleDragStart = useCallback((event: ReactDragEvent<HTMLElement>, taskId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);
    setDraggingTaskId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingTaskId(null);
    setDragOverStatus(null);
  }, []);

  const handleColumnDragOver = useCallback(
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

  const handleColumnDragLeave = useCallback(
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
        // Ignore errors; parent surfaces them.
      }
    },
    [draggingTaskId, onUpdateTask, tasksById],
  );

  const handleStatusDragStart = useCallback(
    (event: ReactDragEvent<HTMLElement>, status: TaskStatus) => {
      if (!sortableStatusKeys.has(status.toLowerCase()) || draggingTaskId || isUpdatingStatuses) {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', status);
      event.dataTransfer.setData('text/status', status);
      setDraggingStatus(status);
      setDragOverColumn(status);
      setDragOverAddColumn(false);
    },
    [draggingTaskId, isUpdatingStatuses, sortableStatusKeys],
  );

  const handleStatusDragEnd = useCallback(() => {
    setDraggingStatus(null);
    setDragOverColumn(null);
    setDragOverAddColumn(false);
  }, []);

  const handleStatusDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, status: TaskStatus) => {
      if (!draggingStatus) {
        return;
      }
      if (!sortableStatusKeys.has(status.toLowerCase())) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (dragOverColumn !== status) {
        setDragOverColumn(status);
      }
      if (isDragOverAddColumn) {
        setDragOverAddColumn(false);
      }
    },
    [dragOverColumn, draggingStatus, isDragOverAddColumn, sortableStatusKeys],
  );

  const handleStatusDragLeave = useCallback(
    (event: ReactDragEvent<HTMLDivElement>, status: TaskStatus) => {
      if (!draggingStatus) {
        return;
      }
      const related = event.relatedTarget as Node | null;
      if (related && event.currentTarget.contains(related)) {
        return;
      }
      setDragOverColumn((current) => (current === status ? null : current));
    },
    [draggingStatus],
  );

  const handleStatusDrop = useCallback(
    async (event: ReactDragEvent<HTMLDivElement>, status: TaskStatus) => {
      if (!draggingStatus) {
        return;
      }
      if (!sortableStatusKeys.has(status.toLowerCase()) || draggingStatus === status) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setDragOverColumn(null);
      setDragOverAddColumn(false);

      const current = draggingStatus;
      setDraggingStatus(null);

      if (!current) {
        return;
      }

      const withoutDragging = statuses.filter((item) => item !== current);
      const targetIndex = withoutDragging.findIndex((item) => item === status);

      if (targetIndex < 0) {
        return;
      }

      const next = [...withoutDragging];
      next.splice(targetIndex, 0, current);

      const didChange = next.some((value, index) => value !== statuses[index]);
      if (!didChange) {
        return;
      }

      try {
        await onReorderStatuses(next);
      } catch {
        // Parent component surfaces errors.
      }
    },
    [draggingStatus, onReorderStatuses, sortableStatusKeys, statuses],
  );

  const handleStatusDragEnterAddColumn = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!draggingStatus) {
        return;
      }
      if (!sortableStatusKeys.has(draggingStatus.toLowerCase())) {
        return;
      }
      event.preventDefault();
      setDragOverColumn(null);
      setDragOverAddColumn(true);
    },
    [draggingStatus, sortableStatusKeys],
  );

  const handleStatusDropOnAddColumn = useCallback(
    async (event: ReactDragEvent<HTMLDivElement>) => {
      if (!draggingStatus) {
        return;
      }
      if (!sortableStatusKeys.has(draggingStatus.toLowerCase())) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const current = draggingStatus;
      setDraggingStatus(null);
      setDragOverAddColumn(false);

      if (!current || statuses[statuses.length - 1] === current) {
        return;
      }

      const next = statuses.filter((item) => item !== current);
      if (next.length === statuses.length) {
        return;
      }
      next.push(current);

      const didChange = next.some((value, index) => value !== statuses[index]);
      if (!didChange) {
        return;
      }

      try {
        await onReorderStatuses(next);
      } catch {
        // Parent component surfaces errors.
      }
    },
    [draggingStatus, onReorderStatuses, sortableStatusKeys, statuses],
  );

  const handleStatusDragLeaveAddColumn = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!draggingStatus) {
        return;
      }
      const related = event.relatedTarget as Node | null;
      if (related && event.currentTarget.contains(related)) {
        return;
      }
      setDragOverAddColumn(false);
    },
    [draggingStatus],
  );

  return (
    <div
      className={clsx('flex gap-4 overflow-x-auto pb-4 pr-2', isColumnsScrolling && 'snap-x')}
      ref={columnsRef}
    >
      {statusOptions.map((column) => {
        const columnTasks = tasksByStatus[column.key] ?? [];
        const showEmptyState =
          columnTasks.length === 0 && activeCreateStatus !== column.key && !isLoading && !error;
        const showLoadingState = isLoading && columnTasks.length === 0;
        const showErrorState = error && columnTasks.length === 0;

        const isDragTarget = Boolean(draggingTaskId) && dragOverStatus === column.key;

        const isSortable = sortableStatusKeys.has(column.key.toLowerCase());
        const isColumnDragTarget =
          Boolean(draggingStatus) && dragOverColumn === column.key && draggingStatus !== column.key;
        const isColumnDragging = draggingStatus === column.key;

        return (
          <div
            key={column.key}
            className={clsx(
              'flex w-[320px] min-w-[280px] flex-shrink-0 flex-col rounded-3xl border border-white/10 bg-white/5 p-4 shadow-card backdrop-blur',
              isDragTarget && 'border-white/50 shadow-card',
              isColumnDragTarget && 'ring-2 ring-white/40',
              isColumnDragging && 'opacity-70',
            )}
            onDragOver={(event) => handleStatusDragOver(event, column.key)}
            onDragEnter={(event) => handleStatusDragOver(event, column.key)}
            onDragLeave={(event) => handleStatusDragLeave(event, column.key)}
            onDrop={(event) => handleStatusDrop(event, column.key)}
          >
            <div
              className={clsx(
                'flex items-center justify-between rounded-2xl border border-white/5 bg-white/10 px-3 py-2 text-sm font-semibold text-white',
                isSortable && !draggingTaskId && !isUpdatingStatuses ? 'cursor-grab active:cursor-grabbing' : '',
              )}
              draggable={isSortable && !draggingTaskId && !isUpdatingStatuses}
              onDragStart={(event) => handleStatusDragStart(event, column.key)}
              onDragEnd={handleStatusDragEnd}
              data-column-drag-handle={isSortable ? 'true' : undefined}
            >
              <div className="flex items-center gap-2">
                <span>{column.label}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white">
                  {columnTasks.length}
                </span>
              </div>
              {isSortable ? (
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 text-white/70 transition hover:border-white/40 hover:text-white"
                  aria-label={`Reorder ${column.label} column`}
                  draggable={isSortable && !draggingTaskId && !isUpdatingStatuses}
                  onDragStart={(event) => handleStatusDragStart(event, column.key)}
                  onDragEnd={handleStatusDragEnd}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
                    <path
                      fill="currentColor"
                      d="M7 10h10v2H7v-2Zm0-4h10v2H7V6Zm0 8h10v2H7v-2Zm0 4h10v2H7v-2Z"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
            <div
              className={clsx(
                'mt-4 flex flex-1 flex-col gap-3',
                isDragTarget && 'rounded-2xl border border-dashed border-white/30 bg-white/5 p-3',
              )}
              onDragOver={(event) => handleColumnDragOver(event, column.key)}
              onDragEnter={(event) => handleColumnDragOver(event, column.key)}
              onDragLeave={(event) => handleColumnDragLeave(event, column.key)}
              onDrop={(event) => handleDrop(event, column.key)}
            >
              {activeCreateStatus === column.key ? (
                <TaskEditor
                  mode="create"
                  status={column.key}
                  statuses={statusOptions}
                  availableLabels={labels}
                  isSubmitting={isCreating(column.key)}
                  onSubmit={handleCreateSubmit}
                  onCancel={() => setActiveCreateStatus(null)}
                />
              ) : null}
              {showLoadingState ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/60">
                  Loading…
                </div>
              ) : null}
              {showErrorState ? (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-6 text-center text-sm text-rose-100">
                  {error}
                </div>
              ) : null}
              {showEmptyState ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/50">
                  No tasks yet.
                </div>
              ) : null}
              {columnTasks.map((task) => (
                <article
                  key={task.taskId}
                  className={clsx(
                    'rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10',
                    draggingTaskId === task.taskId
                      ? 'cursor-grabbing opacity-60'
                      : 'cursor-grab active:cursor-grabbing',
                    updatingTaskId === task.taskId && 'ring-2 ring-indigo-400/60',
                    deletingTaskId === task.taskId && 'opacity-40',
                  )}
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
            {activeCreateStatus === column.key ? null : (
              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center rounded-2xl border border-dashed border-white/20 px-3 py-2 text-sm font-semibold text-white/70 transition hover:border-white/40 hover:text-white disabled:opacity-60"
                onClick={() => {
                  setActiveCreateStatus(column.key);
                }}
                disabled={Boolean(creatingStatus)}
              >
                <span aria-hidden="true" className="mr-1 text-lg">
                  +
                </span>
                Add Task
              </button>
            )}
          </div>
        );
      })}
      <div
        className={clsx(
          'flex w-[320px] min-w-[280px] flex-shrink-0 flex-col rounded-3xl border border-dashed border-white/20 bg-white/0 p-4 text-white/70 transition hover:border-white/40',
          isDragOverAddColumn && 'border-white/60 bg-white/5',
        )}
        onDragOver={handleStatusDragEnterAddColumn}
        onDragEnter={handleStatusDragEnterAddColumn}
        onDragLeave={handleStatusDragLeaveAddColumn}
        onDrop={handleStatusDropOnAddColumn}
      >
        {isAddingStatus ? (
          <form className="space-y-3" onSubmit={handleAddStatusSubmit}>
            <input
              type="text"
              value={newStatusName}
              onChange={(event) => {
                setNewStatusName(event.target.value);
                if (addStatusError) {
                  setAddStatusError(null);
                }
              }}
              placeholder="Status name"
              aria-label="Status name"
              disabled={isUpdatingStatuses}
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-0 disabled:opacity-60"
            />
            {addStatusError ? (
              <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100" role="alert">
                {addStatusError}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex flex-1 items-center justify-center rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
                type="submit"
                disabled={isUpdatingStatuses || !newStatusName.trim()}
              >
                {isUpdatingStatuses ? 'Saving…' : 'Save'}
              </button>
              <button
                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white disabled:opacity-60"
                type="button"
                onClick={handleCancelAddStatus}
                disabled={isUpdatingStatuses}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 px-3 py-6 text-sm font-semibold text-white/70 transition hover:border-white/40 hover:text-white disabled:opacity-60"
            onClick={handleStartAddStatus}
            disabled={isUpdatingStatuses}
          >
            <span aria-hidden="true" className="text-2xl">
              +
            </span>
            Add status
          </button>
        )}
      </div>
    </div>
  );
};
