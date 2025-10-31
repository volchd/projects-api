export interface TaskKey {
  projectId: string;
  taskId: string;
}

export interface Task extends TaskKey {
  name: string;
  description: string | null;
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
}
