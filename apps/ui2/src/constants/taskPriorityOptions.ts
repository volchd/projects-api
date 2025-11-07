import type { TaskPriority } from '../types';

export type TaskPriorityOption = {
  key: TaskPriority;
  label: string;
};

export const TASK_PRIORITY_VALUES: readonly TaskPriority[] = ['None', 'Low', 'Normal', 'High', 'Urgent'];

export const toPriorityOptions = (
  priorities: readonly TaskPriority[] = TASK_PRIORITY_VALUES,
): readonly TaskPriorityOption[] =>
  priorities.map((priority) => ({
    key: priority,
    label: priority,
  }));
