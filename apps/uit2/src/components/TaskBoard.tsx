import { useState, useMemo } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';

interface TaskBoardProps {
  projectId: string;
}

export function TaskBoard({ projectId }: TaskBoardProps) {
  const { projects, updateProjectStatuses } = useProjects();
  const selectedProject = useMemo(() => projects.find((p) => p.id === projectId), [
    projects,
    projectId,
  ]);
  const { tasks, createTask, isLoading, error } = useTasks(
    projectId,
    selectedProject?.statuses ?? [],
  );
  const [newColumnName, setNewColumnName] = useState('');
  const [newTaskForms, setNewTaskForms] = useState<Record<string, string>>({});

  const columns = useMemo(() => {
    if (!selectedProject) return [];
    return selectedProject.statuses.map((status) => ({
      name: status,
      tasks: tasks.filter((task) => task.status === status),
    }));
  }, [selectedProject, tasks]);

  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newColumnName.trim() && selectedProject) {
      const newStatuses = [...selectedProject.statuses, newColumnName.trim()];
      try {
        await updateProjectStatuses(selectedProject.id, newStatuses);
        setNewColumnName('');
      } catch (err) {
        // Error is handled by the hook
      }
    }
  };

  const handleCreateTask = async (e: React.FormEvent, status: string) => {
    e.preventDefault();
    const taskName = newTaskForms[status];
    if (taskName && taskName.trim()) {
      try {
        await createTask({ name: taskName.trim(), status, description: null, priority: 'None' });
        setNewTaskForms({ ...newTaskForms, [status]: '' });
      } catch (err) {
        // Error is handled by the hook
      }
    }
  };

  const handleNewTaskNameChange = (status: string, value: string) => {
    setNewTaskForms({ ...newTaskForms, [status]: value });
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div>
      <form onSubmit={handleCreateColumn} className="mb-4 flex">
        <input
          type="text"
          value={newColumnName}
          onChange={(e) => setNewColumnName(e.target.value)}
          placeholder="New column name"
          className="flex-1 rounded-md border border-gray-300 p-2"
        />
        <button
          type="submit"
          className="ml-2 rounded-md bg-blue-500 p-2 text-white"
        >
          Create Column
        </button>
      </form>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {columns.map((column) => (
          <div key={column.name} className="rounded-md bg-gray-200 p-4">
            <h3 className="text-lg font-bold">{column.name}</h3>
            <ul className="mt-4 space-y-2">
              {column.tasks.map((task) => (
                <li key={task.taskId} className="rounded-md bg-white p-2 shadow-sm">
                  {task.name}
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => handleCreateTask(e, column.name)}
              className="mt-4"
            >
              <input
                type="text"
                value={newTaskForms[column.name] || ''}
                onChange={(e) => handleNewTaskNameChange(column.name, e.target.value)}
                placeholder="New task name"
                className="w-full rounded-md border border-gray-300 p-2"
              />
              <button
                type="submit"
                className="mt-2 w-full rounded-md bg-green-500 p-2 text-white"
              >
                Create Task
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
