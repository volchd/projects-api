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

  return (
    <form className="task-editor" onSubmit={handleSubmit}>
      <input
        type="text"
        ref={nameInputRef}
        value={values.name}
        onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
        placeholder="Task title"
        disabled={isSubmitting || isDeleting}
      />
      {showDateFields ? (
      <div className="task-editor__dates">
        <label className="task-editor__date-field">
          <span>Start date</span>
          <input
            type="date"
            value={values.startDate}
            max={values.dueDate || undefined}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, startDate: event.target.value }))
            }
            disabled={isSubmitting || isDeleting}
          />
        </label>
        <label className="task-editor__date-field">
          <span>Due date</span>
          <input
            type="date"
            value={values.dueDate}
            min={values.startDate || undefined}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, dueDate: event.target.value }))
            }
            disabled={isSubmitting || isDeleting}
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
          rows={3}
        />
      ) : null}
      {error ? (
        <div className="task-editor__error" role="alert">
          {error}
        </div>
      ) : null}
      {showStatusSelector ? (
        <label className="task-editor__status">
          <span>Status</span>
          <select
            value={values.status}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, status: event.target.value as TaskStatus }))
            }
            disabled={isSubmitting || isDeleting}
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
        <label className="task-editor__status">
          <span>Priority</span>
          <select
            value={values.priority}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, priority: event.target.value as TaskPriority }))
            }
            disabled={isSubmitting || isDeleting}
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
        <div className="task-editor__labels">
          <span className="task-editor__labels-title">Labels</span>
          {labelOptions.length ? (
            <div className="task-editor__label-options">
              {labelOptions.map((label) => {
                const isActive = isLabelSelected(label);
                return (
                  <button
                    type="button"
                    key={label.toLowerCase()}
                    className={`task-editor__label-option${
                      isActive ? ' task-editor__label-option--active' : ''
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
            <p className="task-editor__label-placeholder">No labels yet. Create one below.</p>
          )}
          <div className="task-editor__label-add">
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
            />
            <button
              type="button"
              onClick={handleAddLabel}
              disabled={!canAddLabel}
            >
              Add
            </button>
          </div>
          {values.labels.length ? (
            <div className="task-editor__selected-labels">
              {values.labels.map((label) => (
                <span key={label.toLowerCase()} className="task-editor__selected-label">
                  {label}
                  <button
                    type="button"
                    onClick={() => handleToggleLabel(label)}
                    disabled={isSubmitting || isDeleting}
                    aria-label={`Remove ${label}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {labelError ? (
            <div className="task-editor__label-error" role="alert">
              {labelError}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="task-editor__actions">
        {mode === 'edit' && onDelete ? (
          <button
            type="button"
            className="task-editor__delete"
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
        <div className="task-editor__buttons">
          <button
            className="btn btn-primary"
            type="submit"
            disabled={isSubmitting || isDeleting || !values.name.trim()}
          >
            {submitLabel}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={isSubmitting || isDeleting}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
};
