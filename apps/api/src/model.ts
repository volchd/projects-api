export const PROJECT_ENTITY_TYPE = 'Project';
export const TASK_ENTITY_TYPE = 'Task';
export const USER_PROFILE_ENTITY_TYPE = 'UserProfile';

export const PROJECT_SORT_KEY = 'PROJECT';
export const TASK_KEY_PREFIX = 'TASK#';
export const USER_KEY_PREFIX = 'USER#';
export const PROJECT_KEY_PREFIX = 'PROJECT#';
export const USER_PROFILE_SORT_KEY = 'PROFILE';

export const GSI1_NAME = 'GSI1';

export const projectPk = (projectId: string): string => `${PROJECT_KEY_PREFIX}${projectId}`;
export const projectSk = (): string => PROJECT_SORT_KEY;
export const projectGsiPk = (userId: string): string => `${USER_KEY_PREFIX}${userId}`;
export const projectGsiSk = (projectId: string): string => `${PROJECT_KEY_PREFIX}${projectId}`;
export const taskSk = (taskId: string): string => `${TASK_KEY_PREFIX}${taskId}`;
export const userPk = (userId: string): string => `${USER_KEY_PREFIX}${userId}`;
export const userProfileSk = (): string => USER_PROFILE_SORT_KEY;

export const isTaskSortKey = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(TASK_KEY_PREFIX);
