export type Project = {
  id: string;
  name: string;
  description: string | null;
  statuses: string[];
};

export type TaskStatus = 'TODO' | 'IN PROGRESS' | 'COMPLETE';

export type Task = {
  projectId: string;
  taskId: string;
  name: string;
  description: string | null;
  status: TaskStatus;
};
