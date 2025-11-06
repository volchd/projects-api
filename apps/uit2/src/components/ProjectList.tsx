import { useState, useEffect } from 'react';
import { useProjects } from '../hooks/useProjects';
import { Modal } from './Modal';
import { ProjectEditForm } from './ProjectEditForm';
import type { Project } from '../types';

interface ProjectListProps {
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
}

export function ProjectList({ selectedProjectId, onSelectProject }: ProjectListProps) {
  const { projects, error, createProject, updateProject } = useProjects();
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      onSelectProject(projects[0].id);
    }
  }, [projects, selectedProjectId, onSelectProject]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      try {
        const newProject = await createProject({ name: newProjectName.trim(), description: null });
        if (newProject) {
          onSelectProject(newProject.id);
        }
        setNewProjectName('');
        setCreateModalOpen(false);
      } catch (err) {
        // Error is already handled by the hook
      }
    }
  };

  const handleUpdateProject = async (newName: string) => {
    if (editingProject && newName.trim()) {
      try {
        await updateProject(editingProject.id, { name: newName.trim(), description: null });
        setEditingProject(null);
      } catch (err) {
        // Error is already handled by the hook
      }
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="rounded-full p-2 hover:bg-gray-200"
          title="Create new project"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </button>
      </div>
      {error && <div className="text-red-500">{error}</div>}
      <ul className="mt-4">
        {projects.map((project) => (
          <li key={project.id} className="group relative">
            <button
              onClick={() => onSelectProject(project.id)}
              className={`w-full rounded-md p-2 text-left ${
                selectedProjectId === project.id ? 'bg-blue-100' : ''
              }`}
            >
              {project.name}
            </button>
            <button
              onClick={() => setEditingProject(project)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 opacity-0 group-hover:opacity-100"
              title="Edit project"
            >
              <svg
                className="h-5 w-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Project"
      >
        <form onSubmit={handleCreateProject}>
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="New project name"
            className="w-full rounded-md border border-gray-300 p-2"
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-md bg-blue-500 p-2 text-white"
          >
            Create
          </button>
        </form>
      </Modal>

      {editingProject && (
        <Modal
          isOpen={!!editingProject}
          onClose={() => setEditingProject(null)}
          title="Edit Project"
        >
          <ProjectEditForm
            project={editingProject}
            onSubmit={handleUpdateProject}
            onCancel={() => setEditingProject(null)}
          />
        </Modal>
      )}
    </div>
  );
}
