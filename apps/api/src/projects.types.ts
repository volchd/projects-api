// Shared interfaces for Project entities and payloads.
export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  statuses: ProjectStatus[];
  labels: ProjectLabel[];
}

export interface CreateProjectPayload {
  name: string;
  description?: string | null;
  statuses?: ProjectStatus[];
  labels?: ProjectLabel[];
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
  statuses?: ProjectStatus[];
  labels?: ProjectLabel[];
}

export interface ValidationResult<T> {
  value?: T;
  errors: string[];
}

export interface ParsedBodyResult {
  value?: unknown;
  error?: string;
}

export type ProjectStatus = string;

export const DEFAULT_PROJECT_STATUSES: ProjectStatus[] = ['TODO', 'IN PROGRESS', 'COMPLETE'];

export const MAX_PROJECT_STATUS_LENGTH = 40;

export type ProjectLabel = string;
