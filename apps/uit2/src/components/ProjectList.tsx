import { useState, useEffect } from 'react';
import { useProjects } from '../hooks/useProjects';
import { Modal } from './Modal';

interface ProjectListProps {
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
}

export function ProjectList({ selectedProjectId, onSelectProject }: ProjectListProps) {
  const { projects, error, createProject } = useProjects();
  const [newProjectName, setNewProjectName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        setIsModalOpen(false);
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
          onClick={() => setIsModalOpen(true)}
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
          <li key={project.id}>
            <button
              onClick={() => onSelectProject(project.id)}
              className={`w-full rounded-md p-2 text-left ${
                selectedProjectId === project.id ? 'bg-blue-100' : ''
              }`}
            >
              {project.name}
            </button>
          </li>
        ))}
      </ul>
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
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
    </div>
  );
}
