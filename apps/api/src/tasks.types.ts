export interface TaskKey {
  projectId: string;
  taskId: string;
}

export type TaskStatus = string;

export const DEFAULT_TASK_STATUS: TaskStatus = 'TODO';

export const isTaskStatus = (value: unknown, allowed: readonly string[]): value is TaskStatus =>
  typeof value === 'string' && allowed.includes(value);

export const TASK_PRIORITY_VALUES = ['None', 'Low', 'Normal', 'High', 'Urgent'] as const;

export type TaskPriority = (typeof TASK_PRIORITY_VALUES)[number];

export const DEFAULT_TASK_PRIORITY: TaskPriority = 'None';

export const isTaskPriority = (value: unknown): value is TaskPriority =>
  typeof value === 'string' && TASK_PRIORITY_VALUES.includes(value as TaskPriority);

export type TaskLabel = string;

export interface Task extends TaskKey {
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  labels: TaskLabel[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  name: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
  labels?: TaskLabel[];
}

export interface UpdateTaskPayload {
  name?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
  labels?: TaskLabel[];
}
