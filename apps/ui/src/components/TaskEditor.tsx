import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { TaskLabel, TaskPriority, TaskStatus } from '../types';
import { TASK_PRIORITY_VALUES, toPriorityOptions } from '../constants/taskPriorityOptions';

const EMPTY_DESCRIPTION = '';
const DEFAULT_PRIORITY: TaskPriority = 'None';
const MAX_LABEL_LENGTH = 40;

const toDateInputValue = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  return value.slice(0, 10);
};

type TaskEditorFormState = {
  name: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
  labels: TaskLabel[];
};

type TaskEditorSubmitValues = {
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
  labels: TaskLabel[];
};

type StatusOption = {
  key: TaskStatus;
  label: string;
};

type TaskEditorProps = {
  mode: 'create' | 'edit';
  status: TaskStatus;
  statuses: readonly StatusOption[];
  availableLabels: readonly TaskLabel[];
  initialValues?: {
    name: string;
    description: string | null;
    priority: TaskPriority;
    startDate: string | null;
    dueDate: string | null;
    labels: TaskLabel[];
  };
  isSubmitting: boolean;
  isDeleting?: boolean;
  error?: string | null;
  onSubmit: (values: TaskEditorSubmitValues) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => Promise<void> | void;
};

export const TaskEditor = ({
  mode,
  status,
  statuses,
  availableLabels,
  initialValues,
  isSubmitting,
  isDeleting,
  error,
  onSubmit,
  onCancel,
  onDelete,
}: TaskEditorProps) => {
  const [values, setValues] = useState<TaskEditorFormState>({
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? EMPTY_DESCRIPTION,
    status,
    priority: initialValues?.priority ?? DEFAULT_PRIORITY,
    startDate: toDateInputValue(initialValues?.startDate),
    dueDate: toDateInputValue(initialValues?.dueDate),
    labels: initialValues?.labels ?? [],
  });

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [labelError, setLabelError] = useState<string | null>(null);

  useEffect(() => {
    setValues({
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? EMPTY_DESCRIPTION,
      status,
      priority: initialValues?.priority ?? DEFAULT_PRIORITY,
      startDate: toDateInputValue(initialValues?.startDate),
      dueDate: toDateInputValue(initialValues?.dueDate),
      labels: initialValues?.labels ?? [],
    });
    setLabelInput('');
    setLabelError(null);
  }, [
    initialValues?.name,
    initialValues?.description,
    initialValues?.priority,
    initialValues?.startDate,
    initialValues?.dueDate,
    initialValues?.labels,
    status,
  ]);

  useEffect(() => {
    if (mode === 'create' && !isSubmitting && !isDeleting) {
      nameInputRef.current?.focus();
    }
  }, [mode, isSubmitting, isDeleting]);

  const submitLabel = useMemo(() => {
    if (isSubmitting) {
      return mode === 'create' ? 'Saving…' : 'Saving…';
    }
    return 'Save';
  }, [isSubmitting, mode]);

  const deleteLabel = isDeleting ? 'Deleting…' : 'Delete';
  const showDescriptionField = mode === 'edit';
  const showDateFields = mode === 'edit';
  const priorityOptions = useMemo(() => toPriorityOptions(TASK_PRIORITY_VALUES), []);
  const showPrioritySelector = mode === 'edit';
  const showLabelSelector = mode === 'edit';

  const sortLabels = (labels: TaskLabel[]) =>
    [...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const labelOptions = useMemo(() => {
    const seen = new Set<string>();
    const merged: TaskLabel[] = [];

    for (const label of availableLabels) {
      const key = label.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(label);
    }

    for (const label of values.labels) {
      const key = label.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(label);
    }

    return sortLabels(merged);
  }, [availableLabels, values.labels]);

  const isLabelSelected = (label: TaskLabel) =>
    values.labels.some((value) => value.toLowerCase() === label.toLowerCase());

  const handleToggleLabel = (label: TaskLabel) => {
    setValues((prev) => {
      const key = label.toLowerCase();
      const exists = prev.labels.some((value) => value.toLowerCase() === key);
      if (exists) {
        return {
          ...prev,
          labels: prev.labels.filter((value) => value.toLowerCase() !== key),
        };
      }
      return {
        ...prev,
        labels: sortLabels([...prev.labels, label]),
      };
    });
    setLabelError(null);
  };

  const handleAddLabel = () => {
    if (isSubmitting || isDeleting) {
      return;
    }

    const normalized = labelInput.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      setLabelError('Enter a label name');
      return;
    }

    if (normalized.length > MAX_LABEL_LENGTH) {
      setLabelError(`Labels must be ${MAX_LABEL_LENGTH} characters or fewer`);
      return;
    }

    const key = normalized.toLowerCase();
    if (values.labels.some((value) => value.toLowerCase() === key)) {
      setLabelError('That label is already selected');
      return;
    }

    const existing =
      labelOptions.find((option) => option.toLowerCase() === key) ?? normalized;

    setValues((prev) => ({
      ...prev,
      labels: sortLabels([...prev.labels, existing]),
    }));
    setLabelInput('');
    setLabelError(null);
  };

  const canAddLabel = Boolean(labelInput.trim()) && !isSubmitting && !isDeleting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = values.name.trim();
    const trimmedDescription = values.description.trim();
    if (!trimmedName) {
      return;
    }

    const startDateValue = values.startDate ? values.startDate : null;
    const dueDateValue = values.dueDate ? values.dueDate : null;

    await onSubmit({
      name: trimmedName,
      description: trimmedDescription ? trimmedDescription : null,
      status: values.status,
      priority: values.priority,
      labels: values.labels,
      ...(showDateFields
        ? {
            startDate: startDateValue,
            dueDate: dueDateValue,
          }
        : {}),
    });
  };

  const showStatusSelector = mode === 'edit' && statuses.length > 0;

  const showSecondaryColumn = showStatusSelector || showPrioritySelector || showLabelSelector;
  const hasPrimaryExtras = showDateFields || showDescriptionField;
  const shouldRenderGrid = hasPrimaryExtras || showSecondaryColumn;

  return (
    <form
      className="flex flex-col gap-4 p-4 overflow-hidden bg-white border border-gray-200 rounded-2xl dark:bg-gray-800 dark:border-gray-700"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col flex-1 gap-4 pr-1 -mr-1 overflow-y-auto">
        {error ? (
          <div
            className="px-3 py-2 text-sm font-medium text-red-800 bg-red-100 rounded-lg dark:bg-red-900/40 dark:text-red-300"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <input
            type="text"
            ref={nameInputRef}
            value={values.name}
            onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Task title"
            disabled={isSubmitting || isDeleting}
            className="w-full px-3 py-2 text-base bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
          />
        </div>
        {shouldRenderGrid ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {hasPrimaryExtras ? (
              <div className="flex flex-col col-span-1 gap-3">
                {showDateFields ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300">
                      <span>Start date</span>
                      <input
                        type="date"
                        value={values.startDate}
                        max={values.dueDate || undefined}
                        onChange={(event) =>
                          setValues((prev) => ({ ...prev, startDate: event.target.value }))
                        }
                        disabled={isSubmitting || isDeleting}
                        className="w-full px-3 py-2 text-base bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300">
                      <span>Due date</span>
                      <input
                        type="date"
                        value={values.dueDate}
                        min={values.startDate || undefined}
                        onChange={(event) =>
                          setValues((prev) => ({ ...prev, dueDate: event.target.value }))
                        }
                        disabled={isSubmitting || isDeleting}
                        className="w-full px-3 py-2 text-base bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                    </label>
                  </div>
                ) : null}
                {showDescriptionField ? (
                  <textarea
                    value={values.description}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Description (optional)"
                    disabled={isSubmitting || isDeleting}
                    rows={3}
                    className="w-full px-3 py-2 text-base bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                  />
                ) : null}
              </div>
            ) : null}
            {showSecondaryColumn ? (
              <div className="flex flex-col col-span-1 gap-3">
                {showStatusSelector ? (
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300">
                    <span>Status</span>
                    <select
                      value={values.status}
                      onChange={(event) =>
                        setValues((prev) => ({ ...prev, status: event.target.value as TaskStatus }))
                      }
                      disabled={isSubmitting || isDeleting}
                      className="w-full px-3 py-2 text-base bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                    >
                      {statuses.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {showPrioritySelector ? (
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300">
                    <span>Priority</span>
                    <select
                      value={values.priority}
                      onChange={(event) =>
                        setValues((prev) => ({
                          ...prev,
                          priority: event.target.value as TaskPriority,
                        }))
                      }
                      disabled={isSubmitting || isDeleting}
                      className="w-full px-3 py-2 text-base bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                    >
                      {priorityOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {showLabelSelector ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Labels</span>
                    {labelOptions.length ? (
                      <div className="flex flex-wrap gap-2">
                        {labelOptions.map((label) => {
                          const isActive = isLabelSelected(label);
                          return (
                            <button
                              type="button"
                              key={label.toLowerCase()}
                              className={`px-3 py-1 text-xs font-semibold border rounded-full ${
                                isActive
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-500/60 dark:bg-indigo-900/40 dark:text-indigo-300'
                              }`}
                              onClick={() => handleToggleLabel(label)}
                              disabled={isSubmitting || isDeleting}
                              aria-pressed={isActive}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        No labels yet. Create one below.
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={labelInput}
                        onChange={(event) => {
                          setLabelInput(event.target.value);
                          if (labelError) {
                            setLabelError(null);
                          }
                        }}
                        placeholder="New label"
                        disabled={isSubmitting || isDeleting}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddLabel();
                          }
                        }}
                        className="w-full px-3 py-2 text-base bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
                      />
                      <button
                        type="button"
                        onClick={handleAddLabel}
                        disabled={!canAddLabel}
                        className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg dark:bg-indigo-500 disabled:opacity-60"
                      >
                        Add
                      </button>
                    </div>
                    {values.labels.length ? (
                      <div className="flex flex-wrap gap-2">
                        {values.labels.map((label) => (
                          <span
                            key={label.toLowerCase()}
                            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full dark:bg-indigo-900/40 dark:text-indigo-300"
                          >
                            {label}
                            <button
                              type="button"
                              onClick={() => handleToggleLabel(label)}
                              disabled={isSubmitting || isDeleting}
                              aria-label={`Remove ${label}`}
                              className="text-sm leading-none"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {labelError ? (
                      <div
                        className="text-xs text-red-700 dark:text-red-400"
                        role="alert"
                      >
                        {labelError}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3">
        {mode === 'edit' && onDelete ? (
          <button
            type="button"
            className="font-semibold text-red-600 transition-colors dark:text-red-400 hover:text-red-700 dark:hover:text-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={async () => {
              await onDelete();
            }}
            disabled={isSubmitting || isDeleting}
          >
            {deleteLabel}
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center justify-center h-10 px-5 text-sm font-semibold text-white transition-colors bg-indigo-600 rounded-lg shadow-lg dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed"
            type="submit"
            disabled={isSubmitting || isDeleting || !values.name.trim()}
          >
            {submitLabel}
          </button>
          <button
            className="inline-flex items-center justify-center h-10 px-5 text-sm font-semibold text-gray-900 transition-colors bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-50 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-60 disabled:cursor-not-allowed"
            type="button"
            onClick={onCancel}
            disabled={isSubmitting || isDeleting}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
};
