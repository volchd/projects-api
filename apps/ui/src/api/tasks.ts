import { apiUrl, parseError } from './client';
import type { Task, TaskStatus } from '../types';

export type CreateTaskPayload = {
  name: string;
  description: string | null;
  status?: TaskStatus;
};

export type UpdateTaskPayload = {
  name?: string;
  description?: string | null;
  status?: TaskStatus;
};

export const fetchTasks = async (projectId: string): Promise<Task[]> => {
  const response = await fetch(apiUrl(`/projects/${projectId}/tasks`));
  if (!response.ok) {
    await parseError(response, `Failed to load tasks (${response.status})`);
  }

  const data = (await response.json()) as { items?: Task[] };
  return data.items ?? [];
};

export const createTask = async (projectId: string, payload: CreateTaskPayload) => {
  const response = await fetch(apiUrl(`/projects/${projectId}/tasks`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      description: payload.description,
      status: payload.status,
    }),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to create task');
  }

  return (await response.json()) as Task;
};

export const updateTask = async (
  projectId: string,
  taskId: string,
  payload: UpdateTaskPayload,
) => {
  const response = await fetch(apiUrl(`/projects/${projectId}/tasks/${taskId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to update task');
  }

  return (await response.json()) as Task;
};

export const deleteTask = async (projectId: string, taskId: string) => {
  const response = await fetch(apiUrl(`/projects/${projectId}/tasks/${taskId}`), {
    method: 'DELETE',
  });

  if (!response.ok) {
    await parseError(response, 'Failed to delete task');
  }
};
