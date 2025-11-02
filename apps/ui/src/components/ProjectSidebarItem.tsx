import { useCallback } from 'react';
import type { Project } from '../types';

type ProjectSidebarItemProps = {
  project: Project;
  isActive: boolean;
  isDeleting: boolean;
  onSelect: (projectId: string) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
};

export const ProjectSidebarItem = ({
  project,
  isActive,
  isDeleting,
  onSelect,
  onEdit,
  onDelete,
}: ProjectSidebarItemProps) => {
  const handleSelect = useCallback(() => {
    onSelect(project.id);
  }, [onSelect, project.id]);

  const handleEdit = useCallback(() => {
    onEdit(project);
  }, [onEdit, project]);

  const handleDelete = useCallback(() => {
    onDelete(project);
  }, [onDelete, project]);

  return (
    <li className="sidebar__project-item">
      <div className={isActive ? 'sidebar__project sidebar__project--active' : 'sidebar__project'}>
        <button type="button" onClick={handleSelect} className="sidebar__project-button">
          <span>{project.name}</span>
        </button>
        <button
          type="button"
          className="sidebar__project-action-button"
          onClick={handleEdit}
          aria-label="Edit project"
        >
          <span className="sr-only">Edit project</span>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M4 16.5V20h3.5L18.29 9.21a1 1 0 0 0 0-1.41l-2.79-2.79a1 1 0 0 0-1.41 0L4 16.5Z"
              fill="currentColor"
            />
            <path d="M20 22H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8v2H4v16h16v-8h2v8a2 2 0 0 1-2 2Z" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className="sidebar__project-action-button sidebar__project-action-button--danger"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label={isDeleting ? 'Deleting project' : 'Delete project'}
        >
          <span className="sr-only">{isDeleting ? 'Deleting project' : 'Delete project'}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M9 3a1 1 0 0 0-1 1v1H4v2h16V5h-4V4a1 1 0 0 0-1-1H9Z"
              fill="currentColor"
            />
            <path
              d="M6 8v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8H6Zm5 3h2v7h-2v-7Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </li>
  );
};
