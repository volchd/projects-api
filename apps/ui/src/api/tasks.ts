import { apiUrl, parseError } from './client';
import type { Task } from '../types';

export const fetchTasks = async (projectId: string): Promise<Task[]> => {
  const response = await fetch(apiUrl(`/projects/${projectId}/tasks`));
  if (!response.ok) {
    await parseError(response, `Failed to load tasks (${response.status})`);
  }

  const data = (await response.json()) as { items?: Task[] };
  return data.items ?? [];
};
