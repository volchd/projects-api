import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { TaskStatus } from '../types';

const EMPTY_DESCRIPTION = '';

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
  startDate: string;
  dueDate: string;
};

type TaskEditorSubmitValues = {
  name: string;
  description: string | null;
  status: TaskStatus;
  startDate?: string | null;
  dueDate?: string | null;
};

type StatusOption = {
  key: TaskStatus;
  label: string;
};

type TaskEditorProps = {
  mode: 'create' | 'edit';
  status: TaskStatus;
  statuses: readonly StatusOption[];
  initialValues?: { name: string; description: string | null; startDate: string | null; dueDate: string | null };
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
    startDate: toDateInputValue(initialValues?.startDate),
    dueDate: toDateInputValue(initialValues?.dueDate),
  });

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setValues({
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? EMPTY_DESCRIPTION,
      status,
      startDate: toDateInputValue(initialValues?.startDate),
      dueDate: toDateInputValue(initialValues?.dueDate),
    });
  }, [initialValues?.name, initialValues?.description, initialValues?.startDate, initialValues?.dueDate, status]);

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
          <button type="submit" disabled={isSubmitting || isDeleting || !values.name.trim()}>
            {submitLabel}
          </button>
          <button type="button" onClick={onCancel} disabled={isSubmitting || isDeleting}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
};
