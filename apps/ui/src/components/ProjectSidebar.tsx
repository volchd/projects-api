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
    <aside className="sidebar">
      <div className="sidebar__header">
        <span className="sidebar__logo">Collab</span>
        <button type="button" className="sidebar__new-project" onClick={onCreateProject}>
          <span className="sidebar__new-project-plus">+</span>
          New project
        </button>
      </div>

      <div className="sidebar__section">
        <span className="sidebar__section-title">
          Projects
          {projectCountLabel && <span className="sidebar__section-count">({projectCountLabel})</span>}
        </span>
        {metaLabel && (
          <p className={error ? 'sidebar__meta sidebar__meta--error' : 'sidebar__meta'}>{metaLabel}</p>
        )}
        <ul className="sidebar__list">
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
