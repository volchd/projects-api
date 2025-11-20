export type Project = {
  id: string;
  name: string;
  description: string | null;
  statuses: ProjectStatus[];
  labels: ProjectLabel[];
};

export type ProjectStatus = string;

export type TaskStatus = ProjectStatus;

export type TaskPriority = 'None' | 'Low' | 'Normal' | 'High' | 'Urgent';

export type ProjectLabel = string;
export type TaskLabel = ProjectLabel;

export type TaskView = 'board' | 'list' | 'comments';

export type Task = {
  projectId: string;
  taskId: string;
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  labels: TaskLabel[];
  createdBy: string;
  assigneeId: string;
  createdAt: string;
  updatedAt: string;
};
