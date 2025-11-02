import type { TaskStatus } from '../types';

export type TaskStatusOption = {
  key: TaskStatus;
  label: string;
};

export const TASK_STATUS_OPTIONS: readonly TaskStatusOption[] = [
  { key: 'TODO', label: 'To Do' },
  { key: 'IN PROGRESS', label: 'In Progress' },
  { key: 'COMPLETE', label: 'Done' },
] as const;
