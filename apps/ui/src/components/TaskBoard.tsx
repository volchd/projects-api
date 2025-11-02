import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_OPTIONS } from '../constants/taskStatusOptions';
import { TaskEditor } from './TaskEditor';

type TaskEditorValues = {
  name: string;
  description: string | null;
  status: TaskStatus;
};

type TaskBoardProps = {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  creatingStatus: TaskStatus | null;
  updatingTaskId: string | null;
  deletingTaskId: string | null;
  onCreateTask: (values: TaskEditorValues) => Promise<void>;
  onUpdateTask: (taskId: string, values: TaskEditorValues) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
};

export const TaskBoard = ({
  tasks,
  isLoading,
  error,
  creatingStatus,
  updatingTaskId,
  deletingTaskId,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}: TaskBoardProps) => {
  const [activeCreateStatus, setActiveCreateStatus] = useState<TaskStatus | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  const tasksByStatus = useMemo(() => {
    const base = TASK_STATUS_OPTIONS.reduce<Record<TaskStatus, Task[]>>(
      (acc, option) => {
        acc[option.key] = [];
        return acc;
      },
      {} as Record<TaskStatus, Task[]>,
    );

    return tasks.reduce<Record<TaskStatus, Task[]>>((acc, task) => {
      acc[task.status].push(task);
      return acc;
    }, base);
  }, [tasks]);

  const tasksById = useMemo(() => {
    return tasks.reduce<Record<string, Task>>((acc, task) => {
      acc[task.taskId] = task;
      return acc;
    }, {});
  }, [tasks]);

  useEffect(() => {
    if (!editingTaskId) {
      return;
    }
    if (!tasks.some((task) => task.taskId === editingTaskId)) {
      setEditingTaskId(null);
    }
  }, [editingTaskId, tasks]);

  const handleCreateSubmit = async (values: TaskEditorValues) => {
    try {
      await onCreateTask(values);
      setActiveCreateStatus(null);
    } catch {
      // Leave the editor open; the parent component will surface the error.
    }
  };

  const handleEditSubmit = async (taskId: string, values: TaskEditorValues) => {
    try {
      await onUpdateTask(taskId, values);
      setEditingTaskId(null);
    } catch {
      // Keep editor open on failure.
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await onDeleteTask(taskId);
      setEditingTaskId(null);
    } catch {
      // Ignore errors here; parent handles messaging.
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
        });
      } catch {
        // Ignore errors; parent surfaces them.
      }
    },
    [draggingTaskId, onUpdateTask, tasksById],
  );

  return (
    <div className="board__columns">
      {TASK_STATUS_OPTIONS.map((column) => {
        const columnTasks = tasksByStatus[column.key];
        const showEmptyState =
          columnTasks.length === 0 && activeCreateStatus !== column.key && !isLoading && !error;
        const showLoadingState = isLoading && columnTasks.length === 0;
        const showErrorState = error && columnTasks.length === 0;

        const isDragTarget = Boolean(draggingTaskId) && dragOverStatus === column.key;

        return (
          <div
            className={`board__column${isDragTarget ? ' board__column--droppable' : ''}`}
            key={column.key}
          >
            <div className="board__column-header">
              <h2>{column.label}</h2>
              <span className="board__count">{columnTasks.length}</span>
            </div>
            <div
              className="board__cards"
              onDragOver={(event) => handleColumnDragOver(event, column.key)}
              onDragEnter={(event) => handleColumnDragOver(event, column.key)}
              onDragLeave={(event) => handleColumnDragLeave(event, column.key)}
              onDrop={(event) => handleDrop(event, column.key)}
            >
              {activeCreateStatus === column.key ? (
                <TaskEditor
                  mode="create"
                  status={column.key}
                  statuses={TASK_STATUS_OPTIONS}
                  isSubmitting={isCreating(column.key)}
                  onSubmit={handleCreateSubmit}
                  onCancel={() => setActiveCreateStatus(null)}
                />
              ) : null}
              {showLoadingState ? <div className="board__placeholder">Loading…</div> : null}
              {showErrorState ? (
                <div className="board__placeholder board__placeholder--error">{error}</div>
              ) : null}
              {showEmptyState ? (
                <div className="board__placeholder board__placeholder--muted">No tasks yet.</div>
              ) : null}
              {columnTasks.map((task) =>
                editingTaskId === task.taskId ? (
                  <TaskEditor
                    key={task.taskId}
                    mode="edit"
                    status={task.status}
                    statuses={TASK_STATUS_OPTIONS}
                    initialValues={{ name: task.name, description: task.description }}
                    isSubmitting={updatingTaskId === task.taskId}
                    isDeleting={deletingTaskId === task.taskId}
                    onSubmit={async (values) => {
                      await handleEditSubmit(task.taskId, values);
                    }}
                    onCancel={() => setEditingTaskId(null)}
                    onDelete={async () => {
                      await handleDelete(task.taskId);
                    }}
                  />
                ) : (
                  <article
                    key={task.taskId}
                    className={`task-card${
                      draggingTaskId === task.taskId ? ' task-card--dragging' : ' task-card--draggable'
                    }`}
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
                          setEditingTaskId(task.taskId);
                        }}
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
                ),
              )}
            </div>
            {activeCreateStatus === column.key ? null : (
              <button
                type="button"
                className="board__add-task"
                onClick={() => {
                  setEditingTaskId(null);
                  setActiveCreateStatus(column.key);
                }}
                disabled={Boolean(creatingStatus)}
              >
                <span aria-hidden="true">+</span>
                Add Task
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
