import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task, TaskStatus } from '../types';
import {
  createTask as apiCreateTask,
  deleteTask as apiDeleteTask,
  fetchTasks as apiFetchTasks,
  updateTask as apiUpdateTask,
  type CreateTaskPayload,
  type UpdateTaskPayload,
} from '../api/tasks';

const UNKNOWN_ERROR = 'Unknown error';
const DEFAULT_STATUS: TaskStatus = 'TODO';

type UseTasksState = {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  creatingStatus: TaskStatus | null;
  updatingTaskId: string | null;
  deletingTaskId: string | null;
};

export const useTasks = (projectId: string | null) => {
  const [state, setState] = useState<UseTasksState>({
    tasks: [],
    isLoading: false,
    error: null,
    creatingStatus: null,
    updatingTaskId: null,
    deletingTaskId: null,
  });
  const projectIdRef = useRef<string | null>(projectId);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setPartialState = useCallback((partial: Partial<UseTasksState>) => {
    if (!isMountedRef.current) {
      return;
    }
    setState((previous) => ({ ...previous, ...partial }));
  }, []);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const refresh = useCallback(
    async (overrideProjectId?: string) => {
      const currentProjectId = overrideProjectId ?? projectIdRef.current;
      if (!currentProjectId) {
        setPartialState({ tasks: [], error: null });
        return [];
      }

      try {
        const items = await apiFetchTasks(currentProjectId);
        setPartialState({ tasks: items, error: null });
        return items;
      } catch (err) {
        const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
        setPartialState({ tasks: [], error: message });
        throw err;
      }
    },
    [setPartialState],
  );

  useEffect(() => {
    if (!projectId) {
      setPartialState({ tasks: [], error: null, isLoading: false });
      return;
    }

    let cancelled = false;
    const load = async () => {
      setPartialState({ isLoading: true, error: null });
      try {
        const items = await apiFetchTasks(projectId);
        if (!cancelled) {
          setPartialState({ tasks: items });
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
          setPartialState({ error: message, tasks: [] });
        }
      } finally {
        if (!cancelled) {
          setPartialState({ isLoading: false });
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, setPartialState]);

  const ensureProject = useCallback(() => {
    const current = projectIdRef.current;
    if (!current) {
      throw new Error('Select a project before managing tasks');
    }
    return current;
  }, []);

  const createTask = useCallback(
    async (payload: CreateTaskPayload & { status?: TaskStatus }) => {
      const currentProjectId = ensureProject();
      const targetStatus = payload.status ?? DEFAULT_STATUS;
      setPartialState({ creatingStatus: targetStatus });

      try {
        const created = await apiCreateTask(currentProjectId, {
          name: payload.name,
          description: payload.description,
        });

        let latestTask: Task | null = created;

        if (payload.status && payload.status !== created.status) {
          latestTask = await apiUpdateTask(currentProjectId, created.taskId, {
            status: payload.status,
          });
        }

        const items = await refresh(currentProjectId);
        return latestTask ?? items.find((task) => task.taskId === created.taskId) ?? null;
      } finally {
        setPartialState({ creatingStatus: null });
      }
    },
    [ensureProject, refresh, setPartialState],
  );

  const updateTask = useCallback(
    async (taskId: string, payload: UpdateTaskPayload) => {
      const currentProjectId = ensureProject();
      setPartialState({ updatingTaskId: taskId });

      try {
        const updated = await apiUpdateTask(currentProjectId, taskId, payload);
        await refresh(currentProjectId);
        return updated;
      } finally {
        setPartialState({ updatingTaskId: null });
      }
    },
    [ensureProject, refresh, setPartialState],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const currentProjectId = ensureProject();
      setPartialState({ deletingTaskId: taskId });

      try {
        await apiDeleteTask(currentProjectId, taskId);
        await refresh(currentProjectId);
      } finally {
        setPartialState({ deletingTaskId: null });
      }
    },
    [ensureProject, refresh, setPartialState],
  );

  return {
    ...state,
    refresh,
    hasProject: Boolean(projectId),
    createTask,
    updateTask,
    deleteTask,
  };
};
