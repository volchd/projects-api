import type { TaskPriority } from '../types';

export const PRIORITY_COLOR_MAP: Record<TaskPriority, string> = {
  None: 'text-slate-500 dark:text-white/70',
  Low: 'text-emerald-600 dark:text-emerald-300',
  Normal: 'text-sky-600 dark:text-sky-300',
  High: 'text-amber-600 dark:text-amber-300',
  Urgent: 'text-rose-600 dark:text-rose-300',
};
