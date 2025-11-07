import type { TaskPriority } from '../types';

export type TaskPriorityOption = {
  key: TaskPriority;
  label: string;
  className?: string;
};

export const TASK_PRIORITY_VALUES: readonly TaskPriority[] = ['None', 'Low', 'Normal', 'High', 'Urgent'];

export const toPriorityOptions = (
  priorities: readonly TaskPriority[] = TASK_PRIORITY_VALUES,
): readonly TaskPriorityOption[] =>
  priorities.map((priority) => {
    const base = {
      key: priority,
      label: priority,
      className: '',
    };

    switch (priority) {
      case 'Low':
        return { ...base, className: 'text-emerald-600 dark:text-emerald-300' };
      case 'Normal':
        return { ...base, className: 'text-sky-600 dark:text-sky-300' };
      case 'High':
        return { ...base, className: 'text-amber-600 dark:text-amber-300' };
      case 'Urgent':
        return { ...base, className: 'text-rose-600 dark:text-rose-300' };
      default:
        return { ...base, className: 'text-slate-600 dark:text-white/80' };
    }
  });
