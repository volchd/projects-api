import { useCallback, useEffect, useState } from 'react';
import type { Task } from '../types';
import { fetchTasks as apiFetchTasks } from '../api/tasks';

const UNKNOWN_ERROR = 'Unknown error';

export const useTasks = (projectId: string | null) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (overrideProjectId?: string) => {
      const currentProjectId = overrideProjectId ?? projectId;
      if (!currentProjectId) {
        setTasks([]);
        setError(null);
        return [];
      }

      try {
        const items = await apiFetchTasks(currentProjectId);
        setTasks(items);
        setError(null);
        return items;
      } catch (err) {
        const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
        setTasks([]);
        setError(message);
        throw err;
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      setError(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const items = await apiFetchTasks(projectId);
        if (!cancelled) {
          setTasks(items);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
          setError(message);
          setTasks([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return {
    tasks,
    isLoading,
    error,
    refresh,
    hasProject: Boolean(projectId),
  };
};
