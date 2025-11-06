import { useState, useMemo } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import { Modal } from './Modal';
import { TaskEditForm } from './TaskEditForm';
import type { Task } from '../types';

interface TaskBoardProps {
  projectId: string;
}

export function TaskBoard({ projectId }: TaskBoardProps) {
  const { projects, updateProjectLabels, updateProjectStatuses } = useProjects();
  const selectedProject = useMemo(() => projects.find((p) => p.id === projectId), [
    projects,
    projectId,
  ]);
  const { tasks, createTask, updateTask, isLoading, error } = useTasks(
    projectId,
    selectedProject?.statuses ?? [],
  );
  const [newColumnName, setNewColumnName] = useState('');
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [newTaskForms, setNewTaskForms] = useState<Record<string, string>>({});
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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
        setIsCreatingColumn(false);
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

  const handleUpdateTask = async (taskData: Partial<Task>, newLabels: string[]) => {
    if (editingTask) {
      try {
        await updateTask(editingTask.taskId, taskData);
        if (newLabels.length > 0 && selectedProject) {
          const updatedLabels = [...(selectedProject.labels || []), ...newLabels];
          await updateProjectLabels(selectedProject.id, updatedLabels);
        }
        setEditingTask(null);
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
    <div className="flex h-full space-x-6 overflow-x-auto">
      {columns.map((column) => (
        <div key={column.name} className="w-80 flex-shrink-0 rounded-xl bg-stone-100 p-4">
          <h3 className="text-lg font-semibold text-stone-700">{column.name}</h3>
          <ul className="mt-4 space-y-3">
            {column.tasks.map((task) => (
              <li key={task.taskId} className="group relative rounded-lg bg-white p-3 shadow-sm">
                <span>{task.name}</span>
                <button
                  onClick={() => setEditingTask(task)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 opacity-0 group-hover:opacity-100"
                  title="Edit task"
                >
                  <svg
                    className="h-5 w-5 text-stone-500"
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
          <form
            onSubmit={(e) => handleCreateTask(e, column.name)}
            className="mt-4"
          >
            <input
              type="text"
              value={newTaskForms[column.name] || ''}
              onChange={(e) => handleNewTaskNameChange(column.name, e.target.value)}
              placeholder="New task name"
              className="w-full rounded-md border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="mt-2 w-full rounded-md bg-emerald-600 px-4 py-2 text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              Create Task
            </button>
          </form>
        </div>
      ))}
      <div className="w-80 flex-shrink-0 rounded-xl bg-stone-100 p-4">
        {isCreatingColumn ? (
          <form onSubmit={handleCreateColumn} className="flex gap-2">
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="New column name"
              className="min-w-0 flex-1 rounded-md border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-4 py-2 text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              Create
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsCreatingColumn(true)}
            className="flex w-full items-center justify-center rounded-lg bg-stone-200/80 p-2 text-stone-600 hover:bg-stone-200"
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
            <span className="ml-2">Add another column</span>
          </button>
        )}
      </div>
      {editingTask && selectedProject && (
        <Modal
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          title="Edit Task"
        >
          <TaskEditForm
            task={editingTask}
            project={selectedProject}
            onSubmit={handleUpdateTask}
            onCancel={() => setEditingTask(null)}
          />
        </Modal>
      )}
    </div>
  );
}
