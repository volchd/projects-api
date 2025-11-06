import type { TaskStatus } from '../types';

export type TaskStatusOption = {
  key: TaskStatus;
  label: string;
};

export const DEFAULT_TASK_STATUSES: readonly TaskStatus[] = ['TODO', 'IN PROGRESS', 'COMPLETE'];

export const formatStatusLabel = (status: string): string => {
  return status
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const toStatusOptions = (statuses: readonly TaskStatus[]): readonly TaskStatusOption[] =>
  statuses.map((status) => ({
    key: status,
    label: formatStatusLabel(status),
  }));
