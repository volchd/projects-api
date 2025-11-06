import { apiUrl, parseError } from './client';
import type { Project } from '../types';

export type ProjectPayload = { name: string; description: string | null };

export const fetchProjects = async (): Promise<Project[]> => {
  const response = await fetch(apiUrl('/projects'));
  if (!response.ok) {
    await parseError(response, `Failed to load projects (${response.status})`);
  }

  const data = (await response.json()) as { items?: Project[] };
  return data.items ?? [];
};

export const createProject = async (payload: ProjectPayload) => {
  const response = await fetch(apiUrl('/projects'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to create project');
  }

  const data = await response.json().catch(() => undefined);
  return data as Project | undefined;
};

export const updateProject = async (projectId: string, payload: ProjectPayload) => {
  const response = await fetch(apiUrl(`/projects/${projectId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to update project');
  }

  return (await response.json()) as Project;
};

export const deleteProject = async (projectId: string) => {
  const response = await fetch(apiUrl(`/projects/${projectId}`), {
    method: 'DELETE',
  });

  if (!response.ok) {
    await parseError(response, 'Failed to delete project');
  }
};

export const updateProjectStatuses = async (projectId: string, statuses: string[]) => {
  const response = await fetch(apiUrl(`/projects/${projectId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statuses }),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to update project statuses');
  }

  return (await response.json()) as Project;
};

export const updateProjectLabels = async (projectId: string, labels: string[]) => {
  const response = await fetch(apiUrl(`/projects/${projectId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels }),
  });

  if (!response.ok) {
    await parseError(response, 'Failed to update project labels');
  }

  return (await response.json()) as Project;
};
