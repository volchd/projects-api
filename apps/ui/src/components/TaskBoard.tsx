import { useEffect, useMemo, useState } from 'react';
import type { Task, TaskStatus } from '../types';
import { TaskEditor } from './TaskEditor';

const TASK_COLUMNS = [
  { key: 'TODO' as TaskStatus, label: 'To Do' },
  { key: 'IN PROGRESS' as TaskStatus, label: 'In Progress' },
  { key: 'COMPLETE' as TaskStatus, label: 'Done' },
] as const;

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

  const tasksByStatus = useMemo(() => {
    return tasks.reduce<Record<TaskStatus, Task[]>>(
      (acc, task) => {
        acc[task.status].push(task);
        return acc;
      },
      { TODO: [], 'IN PROGRESS': [], COMPLETE: [] },
    );
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

  return (
    <div className="board__columns">
      {TASK_COLUMNS.map((column) => {
        const columnTasks = tasksByStatus[column.key];
        const showEmptyState =
          columnTasks.length === 0 && activeCreateStatus !== column.key && !isLoading && !error;
        const showLoadingState = isLoading && columnTasks.length === 0;
        const showErrorState = error && columnTasks.length === 0;

        return (
          <div className="board__column" key={column.key}>
            <div className="board__column-header">
              <h2>{column.label}</h2>
              <span className="board__count">{columnTasks.length}</span>
            </div>
            <div className="board__cards">
              {activeCreateStatus === column.key ? (
                <TaskEditor
                  mode="create"
                  status={column.key}
                  statuses={TASK_COLUMNS}
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
                    statuses={TASK_COLUMNS}
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
                  <article key={task.taskId} className="task-card">
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
