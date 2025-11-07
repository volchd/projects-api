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
    <aside className="glass-panel flex w-full flex-shrink-0 flex-col gap-6 rounded-3xl p-6 lg:w-80">
      <div className="flex items-center justify-between">
        <div>
          <p className="panel-section-title">Workspace</p>
          <p className="text-2xl font-semibold text-white">Collab</p>
        </div>
        <button
          type="button"
          onClick={onCreateProject}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 text-lg font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
          aria-label="Create project"
        >
          +
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.4em] text-white/60">
          <span>Projects</span>
          {projectCountLabel ? <span className="text-[0.7rem] text-white/40">{projectCountLabel}</span> : null}
        </div>
        {metaLabel ? (
          <p className={error ? 'text-sm text-rose-300' : 'text-sm text-white/70'}>{metaLabel}</p>
        ) : null}
        <ul className="space-y-3">
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
