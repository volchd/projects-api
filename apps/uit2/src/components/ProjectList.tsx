import { useState, useEffect } from 'react';
import { useProjects } from '../hooks/useProjects';

interface ProjectListProps {
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
}

export function ProjectList({ selectedProjectId, onSelectProject }: ProjectListProps) {
  const { projects, error, createProject } = useProjects();
  const [newProjectName, setNewProjectName] = useState('');

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
      } catch (err) {
        // Error is already handled by the hook
      }
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Projects</h1>
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
      <form onSubmit={handleCreateProject} className="mt-4">
        <input
          type="text"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          placeholder="New project name"
          className="w-full rounded-md border border-gray-300 p-2"
        />
        <button
          type="submit"
          className="mt-2 w-full rounded-md bg-blue-500 p-2 text-white"
        >
          Create Project
        </button>
      </form>
    </div>
  );
}
