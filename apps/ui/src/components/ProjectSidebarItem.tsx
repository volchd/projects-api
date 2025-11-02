import { useCallback, useRef, useState } from 'react';
import type { Project } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  useClickOutside(containerRef, closeMenu, isMenuOpen);

  const handleSelect = useCallback(() => {
    onSelect(project.id);
    closeMenu();
  }, [closeMenu, onSelect, project.id]);

  const handleEdit = useCallback(() => {
    onEdit(project);
    closeMenu();
  }, [closeMenu, onEdit, project]);

  const handleDelete = useCallback(() => {
    onDelete(project);
    setIsMenuOpen(false);
  }, [onDelete, project]);

  return (
    <li className="sidebar__project-item">
      <div
        className={isActive ? 'sidebar__project sidebar__project--active' : 'sidebar__project'}
        ref={containerRef}
      >
        <button type="button" onClick={handleSelect} className="sidebar__project-button">
          <span>{project.name}</span>
        </button>
        <button
          type="button"
          className="sidebar__project-menu-button"
          onClick={() => setIsMenuOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
        >
          <span className="sr-only">Project actions</span>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="19" r="1.5" fill="currentColor" />
          </svg>
        </button>
        {isMenuOpen ? (
          <div className="sidebar__project-menu" role="menu">
            <button
              type="button"
              className="sidebar__project-menu-item"
              onClick={handleEdit}
              role="menuitem"
            >
              Update project
            </button>
            <button
              type="button"
              className="sidebar__project-menu-item sidebar__project-menu-item--danger"
              onClick={handleDelete}
              disabled={isDeleting}
              role="menuitem"
            >
              {isDeleting ? 'Deleting…' : 'Delete project'}
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
};
