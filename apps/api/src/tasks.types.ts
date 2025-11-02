export interface TaskKey {
  projectId: string;
  taskId: string;
}

export const TASK_STATUSES = ['TODO', 'IN PROGRESS', 'COMPLETE'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const DEFAULT_TASK_STATUS: TaskStatus = 'TODO';

export const isTaskStatus = (value: unknown): value is TaskStatus =>
  typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);

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
}

export interface UpdateTaskPayload {
  name?: string;
  description?: string | null;
  status?: TaskStatus;
}
