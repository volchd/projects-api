import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useUserProfile } from '../hooks/useUserProfile';

type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
  email: string | null;
  suggestedFirstName?: string;
  suggestedLastName?: string;
};

const NAME_MAX_LENGTH = 100;

export const ProfileModal = ({ open, onClose, email, suggestedFirstName, suggestedLastName }: ProfileModalProps) => {
  const { profile, error, isLoading, isSaving, refresh, save } = useUserProfile({
    enabled: open,
    initialProfile: {
      firstName: suggestedFirstName,
      lastName: suggestedLastName,
      email: email ?? undefined,
    },
  });

  const [firstName, setFirstName] = useState(suggestedFirstName ?? '');
  const [lastName, setLastName] = useState(suggestedLastName ?? '');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
      return;
    }
    setFirstName(suggestedFirstName ?? '');
    setLastName(suggestedLastName ?? '');
  }, [open, profile, suggestedFirstName, suggestedLastName]);

  const profileEmail = useMemo(() => {
    return profile?.email ?? email ?? null;
  }, [profile?.email, email]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFeedback(null);

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst || !trimmedLast) {
      setFormError('First and last name are required.');
      return;
    }

    if (trimmedFirst.length > NAME_MAX_LENGTH || trimmedLast.length > NAME_MAX_LENGTH) {
      setFormError(`Names must be ${NAME_MAX_LENGTH} characters or fewer.`);
      return;
    }

    try {
      await save({ firstName: trimmedFirst, lastName: trimmedLast });
      setFeedback('Profile saved');
    } catch {
      // Error already surfaced through hook
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Your profile"
      description="Update the details we keep in DynamoDB. They’re also sent to Cognito during sign-in."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-first-name" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              First name
            </label>
            <input
              id="profile-first-name"
              name="firstName"
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              maxLength={NAME_MAX_LENGTH}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner transition focus:border-slate-400 focus:outline-none focus:ring-0 dark:border-white/10 dark:bg-white/10 dark:text-white"
              placeholder="Ada"
              required
            />
          </div>
          <div>
            <label htmlFor="profile-last-name" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Last name
            </label>
            <input
              id="profile-last-name"
              name="lastName"
              type="text"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              maxLength={NAME_MAX_LENGTH}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner transition focus:border-slate-400 focus:outline-none focus:ring-0 dark:border-white/10 dark:bg-white/10 dark:text-white"
              placeholder="Lovelace"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60">Email</p>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{profileEmail ?? 'Unknown'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60">
              Last updated
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-white/70">
              {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : 'Not saved yet'}
            </p>
          </div>
        </div>

        {formError ? <p className="text-sm font-medium text-rose-500">{formError}</p> : null}
        {error ? <p className="text-sm font-medium text-rose-500">{error}</p> : null}
        {feedback ? <p className="text-sm font-medium text-emerald-600">{feedback}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-indigo-600 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? 'Saving…' : 'Save profile'}
          </button>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-white dark:hover:border-white/30 sm:w-auto"
            onClick={() => refresh()}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-white dark:hover:border-white/30 sm:w-auto"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </form>
    </Modal>
  );
};
