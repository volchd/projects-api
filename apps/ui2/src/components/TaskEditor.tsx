import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { TaskLabel, TaskPriority, TaskStatus } from '../types';
import { TASK_PRIORITY_VALUES, toPriorityOptions } from '../constants/taskPriorityOptions';
import { Select } from './Select';
import { DatePicker } from './DatePicker';

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
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error ? (
        <div
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <div>
        <input
          type="text"
          ref={nameInputRef}
          value={values.name}
          onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Task title"
          disabled={isSubmitting || isDeleting}
          className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-0 disabled:opacity-60 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-white/40 dark:focus:border-white/40 dark:focus:bg-transparent"
        />
      </div>
      {shouldRenderGrid ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {hasPrimaryExtras ? (
            <div className="space-y-4">
              {showDateFields ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-white/70">
                    <span>Start date</span>
                    <DatePicker
                      value={values.startDate}
                      onChange={(newValue) => setValues((prev) => ({ ...prev, startDate: newValue }))}
                      disabled={isSubmitting || isDeleting}
                      placeholder="mm/dd/yyyy"
                      ariaLabel="Select start date"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-white/70">
                    <span>Due date</span>
                    <DatePicker
                      value={values.dueDate}
                      onChange={(newValue) => setValues((prev) => ({ ...prev, dueDate: newValue }))}
                      disabled={isSubmitting || isDeleting}
                      placeholder="mm/dd/yyyy"
                      ariaLabel="Select due date"
                    />
                  </label>
                </div>
              ) : null}
              {showDescriptionField ? (
                <textarea
                  value={values.description}
                  onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Description (optional)"
                  disabled={isSubmitting || isDeleting}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40 dark:focus:border-white/40"
                />
              ) : null}
            </div>
          ) : null}
          {showSecondaryColumn ? (
            <div className="space-y-4">
              {showStatusSelector ? (
                <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-white/80">
                  <span>Status</span>
                  <Select<TaskStatus>
                    value={values.status}
                    options={statuses}
                    disabled={isSubmitting || isDeleting}
                    ariaLabel="Select status"
                    onChange={(selected) => setValues((prev) => ({ ...prev, status: selected }))}
                  />
                </label>
              ) : null}
              {showPrioritySelector ? (
                <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-white/80">
                  <span>Priority</span>
                  <Select<TaskPriority>
                    value={values.priority}
                    options={priorityOptions}
                    disabled={isSubmitting || isDeleting}
                    ariaLabel="Select priority"
                    onChange={(selected) => setValues((prev) => ({ ...prev, priority: selected }))}
                  />
                </label>
              ) : null}
              {showLabelSelector ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/0">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-800 dark:text-white">Labels</span>
                    <span className="text-slate-500 dark:text-white/50">{values.labels.length} selected</span>
                  </div>
                  {labelOptions.length ? (
                    <div className="flex flex-wrap gap-2">
                      {labelOptions.map((label) => {
                        const isActive = isLabelSelected(label);
                        return (
                          <button
                            type="button"
                            key={label.toLowerCase()}
                            className={clsx(
                              'rounded-full border px-3 py-1 text-xs font-semibold transition',
                              isActive
                                ? 'border-slate-300 bg-slate-100 text-slate-800 dark:border-white dark:bg-white dark:text-slate-900'
                                : 'border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-white/15 dark:text-white/70 dark:hover:border-white/40 dark:hover:text-white',
                            )}
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
                    <p className="text-xs text-slate-500 dark:text-white/50">No labels yet. Create one below.</p>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
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
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40 dark:focus:border-white/40"
                    />
                    <button
                      type="button"
                      onClick={handleAddLabel}
                      disabled={!canAddLabel}
                      className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60 dark:bg-white/10 dark:hover:bg-white/20"
                    >
                      Add
                    </button>
                  </div>
                  {values.labels.length ? (
                    <div className="flex flex-wrap gap-2">
                      {values.labels.map((label) => (
                        <span
                          key={label.toLowerCase()}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 dark:bg-white/10 dark:text-white"
                        >
                          {label}
                          <button
                            type="button"
                            onClick={() => handleToggleLabel(label)}
                            disabled={isSubmitting || isDeleting}
                            aria-label={`Remove ${label}`}
                            className="text-slate-500 transition hover:text-slate-900 disabled:opacity-50 dark:text-white/70 dark:hover:text-white"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {labelError ? (
                    <p className="text-xs text-rose-500 dark:text-rose-300" role="alert">
                      {labelError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/0">
        {mode === 'edit' && onDelete ? (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-semibold text-rose-600 transition hover:text-rose-500 disabled:opacity-60 dark:text-rose-300 dark:hover:text-rose-200"
            onClick={async () => {
              await onDelete();
            }}
            disabled={isSubmitting || isDeleting}
          >
            {deleteLabel}
          </button>
        ) : (
          <span className="text-xs text-slate-500 dark:text-white/50">Draft changes are saved automatically</span>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-60 dark:border-white/20 dark:text-white/80 dark:hover:border-white/40 dark:hover:text-white"
            type="button"
            onClick={onCancel}
            disabled={isSubmitting || isDeleting}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            type="submit"
            disabled={isSubmitting || isDeleting || !values.name.trim()}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
};
