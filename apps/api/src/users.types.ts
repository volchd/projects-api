export interface UserProfile {
  userId: string;
  email: string | null;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertUserProfilePayload {
  firstName: string;
  lastName: string;
}

export interface ValidationResult<T> {
  value?: T;
  errors: string[];
}

export interface ParsedBodyResult {
  value?: unknown;
  error?: string;
}

export const MAX_NAME_LENGTH = 100;
