import { useCallback, useMemo } from 'react';
import type { Project } from '../types';
import { ProjectSidebarItem } from './ProjectSidebarItem';

type ProjectSidebarProps = {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  selectedProjectId: string | null;
  deletingProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
};

export const ProjectSidebar = ({
  projects,
  isLoading,
  error,
  selectedProjectId,
  deletingProjectId,
  onSelectProject,
  onCreateProject,
  onEditProject,
  onDeleteProject,
}: ProjectSidebarProps) => {
  const projectCountLabel = useMemo(() => {
    if (error || isLoading) {
      return null;
    }
    return projects.length.toString();
  }, [error, isLoading, projects.length]);

  const metaLabel = useMemo(() => {
    if (error) {
      return error;
    }
    if (isLoading) {
      return 'Loading projects…';
    }
    if (projects.length === 0) {
      return 'No projects yet';
    }
    return null;
  }, [error, isLoading, projects.length]);

  const handleSelect = useCallback(
    (projectId: string) => {
      onSelectProject(projectId);
    },
    [onSelectProject],
  );

  return (
    <aside className="sticky top-0 flex flex-col self-start shrink-0 w-[clamp(240px,24vw,320px)] h-screen p-6 overflow-y-auto bg-white border-r border-gray-200 shadow-md backdrop-blur-xl dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
          Collab
        </span>
      </div>

      <div className="flex flex-col gap-4 mt-6">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-medium tracking-widest text-gray-500 uppercase dark:text-gray-400">
            Projects
            {projectCountLabel && (
              <span className="ml-1 text-xs font-medium tracking-normal text-gray-500 normal-case dark:text-gray-400">
                ({projectCountLabel})
              </span>
            )}
          </span>
          <button
            type="button"
            className="inline-flex items-center justify-center w-8 h-8 text-xl font-semibold text-indigo-600 transition-colors bg-indigo-100 rounded-lg dark:bg-indigo-900/40 dark:text-indigo-400 hover:bg-indigo-200/80 dark:hover:bg-indigo-900/60"
            onClick={onCreateProject}
            aria-label="Create project"
          >
            <span aria-hidden="true">+</span>
            <span className="sr-only">Create project</span>
          </button>
        </div>
        {metaLabel && (
          <p
            className={
              error
                ? 'text-sm text-red-600 dark:text-red-400'
                : 'text-sm text-gray-500 dark:text-gray-400'
            }
          >
            {metaLabel}
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {projects.map((project) => (
            <ProjectSidebarItem
              key={project.id}
              project={project}
              isActive={project.id === selectedProjectId}
              isDeleting={deletingProjectId === project.id}
              onSelect={handleSelect}
              onEdit={onEditProject}
              onDelete={onDeleteProject}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
};
