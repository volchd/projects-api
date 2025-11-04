import { FormEvent, useEffect, useMemo, useState } from 'react';

type ProjectFormValues = {
  name: string;
  description: string;
};

type ProjectFormProps = {
  mode: 'create' | 'edit';
  initialValues?: { name: string; description: string | null };
  isSubmitting: boolean;
  error?: string | null;
  onSubmit: (values: { name: string; description: string }) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
};

export const ProjectForm = ({
  mode,
  initialValues,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
  submitLabel,
  cancelLabel,
}: ProjectFormProps) => {
  const isEditMode = mode === 'edit';
  const [values, setValues] = useState<ProjectFormValues>({
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
  });

  useEffect(() => {
    setValues({
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
    });
  }, [initialValues?.name, initialValues?.description]);

  const labels = useMemo(
    () => ({
      submit: submitLabel ?? (mode === 'create' ? 'Create project' : 'Save changes'),
      cancel: cancelLabel ?? 'Cancel',
    }),
    [cancelLabel, mode, submitLabel],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      name: values.name.trim(),
      description: isEditMode ? values.description.trim() : '',
    });
  };

  return (
    <form className="project-editor" onSubmit={handleSubmit}>
      <div className="project-editor__field">
        <label htmlFor={`${mode}-project-name`} className="project-editor__label">
          Project name
        </label>
        <input
          id={`${mode}-project-name`}
          type="text"
          value={values.name}
          onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
          disabled={isSubmitting}
          placeholder="Project name"
        />
      </div>
      {isEditMode ? (
        <div className="project-editor__field">
          <label htmlFor={`${mode}-project-description`} className="project-editor__label">
            Description
          </label>
          <textarea
            id={`${mode}-project-description`}
            value={values.description}
            onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
            disabled={isSubmitting}
            placeholder="Short description (optional)"
            rows={3}
          />
        </div>
      ) : null}
      {error ? <div className="board__alert board__alert--error">{error}</div> : null}
      <div className="project-editor__actions">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (mode === 'create' ? 'Creating…' : 'Saving…') : labels.submit}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={isSubmitting}>
            {labels.cancel}
          </button>
        ) : null}
      </div>
    </form>
  );
};
