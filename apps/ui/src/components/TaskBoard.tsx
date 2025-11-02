import { useMemo } from 'react';
import type { Task, TaskStatus } from '../types';

const TASK_COLUMNS = [
  { key: 'TODO' as TaskStatus, label: 'To Do' },
  { key: 'IN PROGRESS' as TaskStatus, label: 'In Progress' },
  { key: 'COMPLETE' as TaskStatus, label: 'Done' },
] as const;

type TaskBoardProps = {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
};

export const TaskBoard = ({ tasks, isLoading, error }: TaskBoardProps) => {
  const tasksByStatus = useMemo(() => {
    return tasks.reduce<Record<TaskStatus, Task[]>>(
      (acc, task) => {
        acc[task.status].push(task);
        return acc;
      },
      { TODO: [], 'IN PROGRESS': [], COMPLETE: [] },
    );
  }, [tasks]);

  return (
    <div className="board__columns">
      {TASK_COLUMNS.map((column) => (
        <div className="board__column" key={column.key}>
          <div className="board__column-header">
            <h2>{column.label}</h2>
            <span className="board__count">{tasksByStatus[column.key].length}</span>
          </div>
          <div className="board__cards">
            {isLoading && tasksByStatus[column.key].length === 0 ? (
              <div className="board__placeholder">Loading…</div>
            ) : null}
            {error && tasksByStatus[column.key].length === 0 ? (
              <div className="board__placeholder board__placeholder--error">{error}</div>
            ) : null}
            {!isLoading && !error && tasksByStatus[column.key].length === 0 ? (
              <div className="board__placeholder board__placeholder--muted">No tasks yet.</div>
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
  );
};
