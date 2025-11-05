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
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <label
          htmlFor={`${mode}-project-name`}
          className="text-sm font-medium text-gray-600 dark:text-gray-300"
        >
          Project name
        </label>
        <input
          id={`${mode}-project-name`}
          type="text"
          value={values.name}
          onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
          disabled={isSubmitting}
          placeholder="Project name"
          className="w-full px-3 py-2 text-base bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
        />
      </div>
      {isEditMode ? (
        <div className="flex flex-col gap-2">
          <label
            htmlFor={`${mode}-project-description`}
            className="text-sm font-medium text-gray-600 dark:text-gray-300"
          >
            Description
          </label>
          <textarea
            id={`${mode}-project-description`}
            value={values.description}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, description: event.target.value }))
            }
            disabled={isSubmitting}
            placeholder="Short description (optional)"
            rows={3}
            className="w-full px-3 py-2 text-base bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:ring-indigo-600 focus:border-indigo-600"
          />
        </div>
      ) : null}
      {error ? (
        <div className="px-3 py-2 text-sm font-medium text-red-800 bg-red-100 rounded-lg dark:bg-red-900/40 dark:text-red-300">
          {error}
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          className="inline-flex items-center justify-center h-10 px-5 text-sm font-semibold text-white transition-colors bg-indigo-600 rounded-lg shadow-lg dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (mode === 'create' ? 'Creating…' : 'Saving…') : labels.submit}
        </button>
        {onCancel ? (
          <button
            className="inline-flex items-center justify-center h-10 px-5 text-sm font-semibold text-gray-900 transition-colors bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-50 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-60 disabled:cursor-not-allowed"
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
