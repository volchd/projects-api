import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { TaskStatus } from '../types';

const EMPTY_DESCRIPTION = '';

type TaskEditorValues = {
  name: string;
  description: string;
  status: TaskStatus;
};

type StatusOption = {
  key: TaskStatus;
  label: string;
};

type TaskEditorProps = {
  mode: 'create' | 'edit';
  status: TaskStatus;
  statuses: readonly StatusOption[];
  initialValues?: { name: string; description: string | null };
  isSubmitting: boolean;
  isDeleting?: boolean;
  error?: string | null;
  onSubmit: (values: { name: string; description: string | null; status: TaskStatus }) => Promise<void> | void;
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
  const [values, setValues] = useState<TaskEditorValues>({
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? EMPTY_DESCRIPTION,
    status,
  });

  useEffect(() => {
    setValues({
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? EMPTY_DESCRIPTION,
      status,
    });
  }, [initialValues?.name, initialValues?.description, status]);

  const submitLabel = useMemo(() => {
    if (isSubmitting) {
      return mode === 'create' ? 'Saving…' : 'Saving…';
    }
    return 'Save';
  }, [isSubmitting, mode]);

  const deleteLabel = isDeleting ? 'Deleting…' : 'Delete';
  const showDescriptionField = mode === 'edit';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = values.name.trim();
    const trimmedDescription = values.description.trim();
    if (!trimmedName) {
      return;
    }

    await onSubmit({
      name: trimmedName,
      description: trimmedDescription ? trimmedDescription : null,
      status: values.status,
    });
  };

  const showStatusSelector = mode === 'edit' && statuses.length > 0;

  return (
    <form className="task-editor" onSubmit={handleSubmit}>
      <input
        type="text"
        value={values.name}
        onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
        placeholder="Task title"
        disabled={isSubmitting || isDeleting}
      />
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
