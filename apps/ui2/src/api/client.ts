const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export const apiUrl = (path: string) => {
  if (!API_BASE) {
    return path;
  }
  return `${API_BASE.replace(/\/$/, '')}${path}`;
};

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const parseError = async (response: Response, fallback: string) => {
  const data = await response.json().catch(() => undefined);
  const message =
    (Array.isArray(data?.errors) && data.errors.join(', ')) ||
    (typeof data?.message === 'string' ? data.message : fallback);
  throw new ApiError(message, response.status);
};
