export interface TaskKey {
  projectId: string;
  taskId: string;
}

export type TaskStatus = string;

export const DEFAULT_TASK_STATUS: TaskStatus = 'TODO';

export const isTaskStatus = (value: unknown, allowed: readonly string[]): value is TaskStatus =>
  typeof value === 'string' && allowed.includes(value);

export interface Task extends TaskKey {
  name: string;
  description: string | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  name: string;
  description?: string | null;
  status?: TaskStatus;
}

export interface UpdateTaskPayload {
  name?: string;
  description?: string | null;
  status?: TaskStatus;
}
