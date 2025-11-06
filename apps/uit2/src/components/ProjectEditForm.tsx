import { useState, useEffect } from 'react';
import type { Project } from '../types';

interface ProjectEditFormProps {
  project: Project;
  onSubmit: (payload: { name: string; description: string | null }) => Promise<void>;
  onCancel: () => void;
}

export function ProjectEditForm({ project, onSubmit, onCancel }: ProjectEditFormProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');

  useEffect(() => {
    setName(project.name);
    setDescription(project.description || '');
  }, [project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit({ name: name.trim(), description: description.trim() ? description.trim() : null });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label htmlFor="projectName" className="block text-sm font-medium text-stone-700">
            Name
          </label>
          <input
            id="projectName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label
            htmlFor="projectDescription"
            className="block text-sm font-medium text-stone-700"
          >
            Description
          </label>
          <textarea
            id="projectDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Project description (optional)"
            className="mt-1 w-full rounded-md border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
            rows={4}
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end space-x-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md bg-stone-200 px-4 py-2 text-stone-700 hover:bg-stone-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-4 py-2 text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          Save
        </button>
      </div>
    </form>
  );
}
