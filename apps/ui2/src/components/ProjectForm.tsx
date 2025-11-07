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
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label htmlFor={`${mode}-project-name`} className="text-sm font-medium text-white/80">
          Project name
        </label>
        <input
          id={`${mode}-project-name`}
          type="text"
          value={values.name}
          onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
          disabled={isSubmitting}
          placeholder="Project name"
          className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-base text-white/90 placeholder:text-white/40 focus:border-white/40 focus:bg-white/5 focus:outline-none focus:ring-0 disabled:opacity-60"
        />
      </div>
      {isEditMode ? (
        <div className="space-y-2">
          <label htmlFor={`${mode}-project-description`} className="text-sm font-medium text-white/80">
            Description
          </label>
          <textarea
            id={`${mode}-project-description`}
            value={values.description}
            onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
            disabled={isSubmitting}
            placeholder="Short description (optional)"
            rows={3}
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white/90 placeholder:text-white/40 focus:border-white/40 focus:bg-white/5 focus:outline-none focus:ring-0 disabled:opacity-60"
          />
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="inline-flex items-center rounded-2xl bg-white text-slate-900 px-5 py-2 text-sm font-semibold transition hover:bg-slate-100 disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (mode === 'create' ? 'Creating…' : 'Saving…') : labels.submit}
        </button>
        {onCancel ? (
          <button
            className="inline-flex items-center rounded-2xl border border-white/30 px-5 py-2 text-sm font-semibold text-white/80 transition hover:border-white/50 hover:text-white disabled:opacity-60"
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {labels.cancel}
          </button>
        ) : null}
      </div>
    </form>
  );
};
