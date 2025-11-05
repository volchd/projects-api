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
    <li className="relative">
      <div
        className={
          isActive
            ? 'flex items-center gap-2 rounded-lg bg-indigo-100/80 px-4 py-2 text-indigo-700 shadow-[inset_0_0_0_1px] shadow-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:shadow-indigo-700/60'
            : 'flex items-center gap-2 rounded-lg px-4 py-2 text-gray-900 transition-colors hover:bg-indigo-100/50 dark:text-gray-50 dark:hover:bg-indigo-900/20'
        }
      >
        <button
          type="button"
          onClick={handleSelect}
          className={
            isActive
              ? 'flex-1 py-1 text-left text-sm font-semibold'
              : 'flex-1 py-1 text-left text-sm'
          }
        >
          <span>{project.name}</span>
        </button>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-indigo-100 hover:text-indigo-600 focus-visible:bg-indigo-100 focus-visible:text-indigo-600 dark:text-gray-400 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-400 dark:focus-visible:bg-indigo-900/40 dark:focus-visible:text-indigo-400"
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-100 hover:text-red-600 focus-visible:bg-red-100 focus-visible:text-red-600 disabled:opacity-60 dark:text-gray-400 dark:hover:bg-red-900/40 dark:hover:text-red-400 dark:focus-visible:bg-red-900/40 dark:focus-visible:text-red-400"
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
