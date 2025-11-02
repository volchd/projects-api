import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project } from '../types';
import {
  createProject as apiCreateProject,
  deleteProject as apiDeleteProject,
  fetchProjects as apiFetchProjects,
  updateProject as apiUpdateProject,
  type ProjectPayload,
} from '../api/projects';

type UseProjectsState = {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  creating: boolean;
  updatingProjectId: string | null;
  deletingProjectId: string | null;
};

const UNKNOWN_ERROR = 'Unknown error';

export const useProjects = () => {
  const [state, setState] = useState<UseProjectsState>({
    projects: [],
    isLoading: true,
    error: null,
    creating: false,
    updatingProjectId: null,
    deletingProjectId: null,
  });
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setPartialState = useCallback((partial: Partial<UseProjectsState>) => {
    if (!isMountedRef.current) {
      return;
    }
    setState((previous) => ({ ...previous, ...partial }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const items = await apiFetchProjects();
      setPartialState({ projects: items, error: null });
      return items;
    } catch (err) {
      const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
      setPartialState({ error: message, projects: [] });
      throw err;
    }
  }, [setPartialState]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setPartialState({ isLoading: true, error: null });
      try {
        const items = await apiFetchProjects();
        if (cancelled) {
          return;
        }
        setPartialState({ projects: items });
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : UNKNOWN_ERROR;
          setPartialState({ error: message, projects: [] });
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
  }, [setPartialState]);

  const createProject = useCallback(
    async (payload: ProjectPayload) => {
      setPartialState({ creating: true });
      try {
        const created = await apiCreateProject(payload);
        const items = await refresh();
        return created ?? items.find((project) => project.name === payload.name) ?? null;
      } catch (err) {
        throw err;
      } finally {
        setPartialState({ creating: false });
      }
    },
    [refresh, setPartialState],
  );

  const updateProject = useCallback(
    async (projectId: string, payload: ProjectPayload) => {
      setPartialState({ updatingProjectId: projectId });
      try {
        await apiUpdateProject(projectId, payload);
        await refresh();
      } catch (err) {
        throw err;
      } finally {
        setPartialState({ updatingProjectId: null });
      }
    },
    [refresh, setPartialState],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      setPartialState({ deletingProjectId: projectId });
      try {
        await apiDeleteProject(projectId);
        await refresh();
      } catch (err) {
        throw err;
      } finally {
        setPartialState({ deletingProjectId: null });
      }
    },
    [refresh, setPartialState],
  );

  return {
    ...state,
    refresh,
    createProject,
    updateProject,
    deleteProject,
  };
};
