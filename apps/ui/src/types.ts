export type Project = {
  id: string;
  name: string;
  description: string | null;
  statuses: ProjectStatus[];
};

export type ProjectStatus = string;

export type TaskStatus = ProjectStatus;

export type Task = {
  projectId: string;
  taskId: string;
  name: string;
  description: string | null;
  status: TaskStatus;
};
