// Shared interfaces for Project entities and payloads.
export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
}

export interface CreateProjectPayload {
  name: string;
  description?: string | null;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
}

export interface ValidationResult<T> {
  value?: T;
  errors: string[];
}

export interface ParsedBodyResult {
  value?: unknown;
  error?: string;
}
