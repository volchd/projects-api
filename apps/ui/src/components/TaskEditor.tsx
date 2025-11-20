import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { TaskLabel, TaskPriority, TaskStatus } from '../types';
import { TASK_PRIORITY_VALUES, toPriorityOptions } from '../constants/taskPriorityOptions';
import { Select } from './Select';
import { DatePicker } from './DatePicker';
import { useAuth } from '../hooks/useAuth';

const EMPTY_DESCRIPTION = '';
const DEFAULT_PRIORITY: TaskPriority = 'None';
const MAX_LABEL_LENGTH = 40;

const toDateInputValue = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  return value.slice(0, 10);
};

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-sky-500',
  'from-emerald-500 to-teal-400',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-slate-700 to-slate-900',
  'from-cyan-500 to-blue-600',
] as const;

const initialsFromLabel = (value: string): string => {
  if (!value.trim()) {
    return '??';
  }
  const parts = value
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase());

  if (parts.length === 0) {
    return value.slice(0, 2).toUpperCase();
  }

  return parts.join('');
};

const gradientForValue = (value: string) => {
  const hash = Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
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

type UserIdentity = {
  userId: string;
  displayName: string;
  secondaryLabel?: string;
  isCurrentUser: boolean;
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
  createdBy?: string;
  assigneeId?: string;
  isSubmitting: boolean;
  isDeleting?: boolean;
  error?: string | null;
  onSubmit: (values: TaskEditorSubmitValues) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => Promise<void> | void;
};

const UserIdentityBadge = ({
  title,
  identity,
}: {
  title: string;
  identity: UserIdentity;
}) => {
  const avatarKey = identity.userId || identity.displayName || 'unknown';
  const avatarGradient = gradientForValue(avatarKey);
  const initials = initialsFromLabel(identity.displayName || 'Unknown');

  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-soft dark:border-white/10 dark:bg-white/5 dark:shadow-card',
        identity.isCurrentUser && 'ring-1 ring-indigo-300/60 dark:ring-indigo-500/30',
      )}
    >
      <div
        aria-hidden="true"
        className={clsx(
          'flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-semibold uppercase text-white shadow-sm ring-1 ring-white/60 dark:ring-white/15',
          avatarGradient,
        )}
      >
        {initials}
      </div>
      <div className="leading-tight">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60">
          {title}
        </p>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {identity.displayName}
          {identity.isCurrentUser ? ' (You)' : ''}
        </p>
        {identity.secondaryLabel ? (
          <p className="text-[11px] text-slate-500 dark:text-white/60">{identity.secondaryLabel}</p>
        ) : null}
      </div>
    </div>
  );
};

export const TaskEditor = ({
  mode,
  status,
  statuses,
  availableLabels,
  initialValues,
  createdBy,
  assigneeId,
  isSubmitting,
  isDeleting,
  error,
  onSubmit,
  onCancel,
  onDelete,
}: TaskEditorProps) => {
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.username?.trim();
  const currentUserLabel =
    (authUser?.firstName || authUser?.lastName
      ? [authUser?.firstName, authUser?.lastName].filter(Boolean).join(' ')
      : undefined) ??
    authUser?.email ??
    authUser?.username ??
    'You';

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
  const [labelQuery, setLabelQuery] = useState('');

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
  const createdByIdentity = useMemo<UserIdentity>(() => {
    const normalized = createdBy?.trim();
    if (!normalized) {
      return { userId: 'unknown', displayName: 'Unknown user', isCurrentUser: false };
    }
    const isCurrentUser = Boolean(currentUserId) && normalized === currentUserId;
    const displayName = isCurrentUser ? currentUserLabel : normalized;
    const secondaryLabel =
      isCurrentUser && displayName !== normalized ? normalized : undefined;
    return { userId: normalized, displayName, secondaryLabel, isCurrentUser };
  }, [createdBy, currentUserId, currentUserLabel]);

  const assigneeIdentity = useMemo<UserIdentity>(() => {
    const normalized = (assigneeId ?? createdBy)?.trim();
    if (!normalized) {
      return { userId: 'unknown', displayName: 'Unassigned', isCurrentUser: false };
    }
    const isCurrentUser = Boolean(currentUserId) && normalized === currentUserId;
    const displayName = isCurrentUser ? currentUserLabel : normalized;
    const secondaryLabel =
      isCurrentUser && displayName !== normalized ? normalized : undefined;
    return { userId: normalized, displayName, secondaryLabel, isCurrentUser };
  }, [assigneeId, createdBy, currentUserId, currentUserLabel]);

  const sortLabels = (labels: TaskLabel[]) =>
    [...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const allLabelOptions = useMemo(() => {
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

  const labelOptions = useMemo(() => {
    const query = labelQuery.trim().toLowerCase();
    if (!query) {
      return allLabelOptions;
    }
    return allLabelOptions.filter((label) => label.toLowerCase().includes(query));
  }, [allLabelOptions, labelQuery]);

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

  const handleAddLabel = (sourceValue?: string) => {
    if (isSubmitting || isDeleting) {
      return;
    }

    const raw = sourceValue ?? labelQuery;
    const normalized = raw.trim().replace(/\s+/g, ' ');
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
      allLabelOptions.find((option) => option.toLowerCase() === key) ?? normalized;

    setValues((prev) => ({
      ...prev,
      labels: sortLabels([...prev.labels, existing]),
    }));
    setLabelError(null);
    setLabelQuery('');
  };

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
      {mode === 'edit' ? (
        <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-white to-slate-50 p-4 shadow-soft dark:border-white/10 dark:bg-gradient-to-r dark:from-white/5 dark:via-white/0 dark:to-white/0 dark:shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60">
              People
            </span>
            <span className="rounded-xl bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm dark:bg-white/20 dark:text-white">
              Ownership
            </span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <UserIdentityBadge title="Created by" identity={createdByIdentity} />
            <UserIdentityBadge title="Assigned to" identity={assigneeIdentity} />
          </div>
        </div>
      ) : null}
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
                  <div className="flex flex-col gap-3">
                    <div className="relative">
                      <input
                        type="search"
                        placeholder="Search or create labels (press Enter)"
                        value={labelQuery}
                        onChange={(event) => {
                          setLabelQuery(event.target.value);
                          if (labelError) {
                            setLabelError(null);
                          }
                        }}
                        disabled={isSubmitting || isDeleting}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && labelQuery.trim()) {
                            event.preventDefault();
                            handleAddLabel(labelQuery);
                          } else if (event.key === 'Escape') {
                            setLabelQuery('');
                          }
                        }}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 pr-16 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40 dark:focus:border-white/40"
                      />
                      {labelQuery ? (
                        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                          <button
                            type="button"
                            className="text-xs text-slate-400 transition hover:text-slate-600 dark:text-white/50 dark:hover:text-white/70"
                            onClick={() => setLabelQuery('')}
                            aria-label="Clear label search"
                          >
                            ×
                          </button>
                          <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500 dark:border-white/20 dark:text-white/70">
                            Enter
                          </span>
                        </div>
                      ) : null}
                    </div>
                    {labelQuery.trim() && labelOptions.length ? (
                      <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-white/15 dark:bg-white/5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/50">
                          Select existing label
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {labelOptions.slice(0, 8).map((label) => (
                            <button
                              type="button"
                              key={label.toLowerCase()}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-white/20 dark:text-white/80 dark:hover:border-white/40"
                              onClick={() => handleToggleLabel(label)}
                              disabled={isSubmitting || isDeleting}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="text-xs text-slate-500 dark:text-white/50">
                      {labelQuery.trim() ? (
                        <>
                          Press <span className="font-semibold">Enter</span> to create{' '}
                          <span className="font-semibold">{labelQuery.trim()}</span>
                        </>
                      ) : (
                        'Type a label name to search existing labels or press Enter to create a new one.'
                      )}
                    </div>
                  </div>
                  {labelError ? (
                    <p className="text-xs text-rose-500 dark:text-rose-300" role="alert">
                      {labelError}
                    </p>
                  ) : null}
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
