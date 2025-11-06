import { useState, useEffect } from 'react';
import { TASK_PRIORITY_VALUES } from '../constants/taskPriorityOptions';
import type { Project, Task, TaskPriority, TaskStatus } from '../types';

interface TaskEditFormProps {
  task: Task;
  project: Project;
  onSubmit: (taskData: Partial<Task>, newLabels: string[]) => Promise<void>;
  onCancel: () => void;
}

export function TaskEditForm({ task, project, onSubmit, onCancel }: TaskEditFormProps) {
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description || '');
  const [startDate, setStartDate] = useState(task.startDate?.split('T')[0] || '');
  const [dueDate, setDueDate] = useState(task.dueDate?.split('T')[0] || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [selectedLabels, setSelectedLabels] = useState<string[]>(task.labels);
  const [newLabel, setNewLabel] = useState('');

  const [availableLabels, setAvailableLabels] = useState<string[]>(project.labels || []);
  const [createdLabels, setCreatedLabels] = useState<string[]>([]);

  useEffect(() => {
    setName(task.name);
    setDescription(task.description || '');
    setStartDate(task.startDate?.split('T')[0] || '');
    setDueDate(task.dueDate?.split('T')[0] || '');
    setStatus(task.status);
    setPriority(task.priority);
    setSelectedLabels(task.labels);
    setAvailableLabels(project.labels || []);
  }, [task, project]);

  const handleLabelToggle = (label: string) => {
    setSelectedLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleAddNewLabel = () => {
    if (newLabel.trim() && !availableLabels.includes(newLabel.trim())) {
      const trimmedLabel = newLabel.trim();
      setAvailableLabels((prev) => [...prev, trimmedLabel]);
      setSelectedLabels((prev) => [...prev, trimmedLabel]);
      setCreatedLabels((prev) => [...prev, trimmedLabel]);
      setNewLabel('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(
        {
          name: name.trim(),
          description: description.trim() ? description.trim() : null,
          startDate: startDate || null,
          dueDate: dueDate || null,
          status,
          priority,
          labels: selectedLabels,
        },
        createdLabels
      );
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Name and Description */}
      <div className="space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Task name"
          className="w-full rounded-md border-stone-300 p-2 text-lg font-semibold shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Task description (optional)"
          className="w-full rounded-md border-stone-300 p-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
          rows={4}
        />
      </div>

      {/* Two-Column Layout */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Column 1 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-md border-stone-300 p-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-md border-stone-300 p-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-md border-stone-300 p-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
            >
              {project.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Column 2 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="mt-1 w-full rounded-md border-stone-300 p-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
            >
              {TASK_PRIORITY_VALUES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Labels</label>
            <div className="mt-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                {availableLabels.map((label) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => handleLabelToggle(label)}
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      selectedLabels.includes(label)
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="New label name"
                  className="min-w-0 flex-1 rounded-md border-stone-300 p-2 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddNewLabel}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="mt-8 flex justify-end space-x-2">
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
          Save Task
        </button>
      </div>
    </form>
  );
}
