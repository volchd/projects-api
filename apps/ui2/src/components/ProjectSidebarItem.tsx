import { useCallback } from 'react';
import clsx from 'clsx';
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
    <li>
      <div
        className={clsx(
          'flex items-center justify-between rounded-2xl border px-4 py-3 transition',
          isActive
            ? 'border-white/50 bg-white/10 shadow-card'
            : 'border-white/10 bg-white/0 hover:border-white/30 hover:bg-white/5',
        )}
      >
        <button
          type="button"
          onClick={handleSelect}
          className="text-left text-base font-medium text-white/90 transition hover:text-white"
        >
          {project.name}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-white/40 hover:text-white"
            onClick={handleEdit}
            aria-label="Edit project"
          >
            <span className="sr-only">Edit project</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
              <path
                fill="currentColor"
                d="M3 17.25V21h3.75l11-11.06-3.75-3.75L3 17.25ZM20.71 7a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.82 1.82 3.75 3.75L20.71 7Z"
              />
            </svg>
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/30 text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/10"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label={isDeleting ? 'Deleting project' : 'Delete project'}
          >
            <span className="sr-only">{isDeleting ? 'Deleting project' : 'Delete project'}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
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
      </div>
    </li>
  );
};
