import clsx from 'clsx';

type TopbarProps = {
  activeView: 'board' | 'list' | 'comments';
  onSelectView: (view: 'board' | 'list' | 'comments') => void;
  onOpenCommandPalette: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  userLabel?: string;
  onSignOut?: () => void;
};

const initialsFromLabel = (value?: string) => {
  if (!value) {
    return '??';
  }
  const parts = value
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase());
  if (parts.length === 0) {
    return value.slice(0, 2).toUpperCase();
  }
  return parts.join('');
};

const TAB_OPTIONS = [
  {
    key: 'board',
    label: 'Board',
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M4 5h16a1 1 0 0 1 1 1v12.5a.5.5 0 0 1-.85.35L15 15H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
        />
      </svg>
    ),
  },
  {
    key: 'list',
    label: 'List',
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M5 6h14a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Zm0 5h14a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Zm0 5h14a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Z"
        />
      </svg>
    ),
  },
  {
    key: 'comments',
    label: 'Comments',
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M5 3a2 2 0 0 0-2 2v10.59L5.29 13.3A1 1 0 0 1 6 13h13a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"
        />
      </svg>
    ),
  },
] as const;

export const Topbar = ({
  activeView,
  onSelectView,
  onOpenCommandPalette,
  theme,
  onToggleTheme,
  userLabel,
  onSignOut,
}: TopbarProps) => {
  const userInitials = initialsFromLabel(userLabel);

  return (
  <header className="glass-panel flex flex-col gap-4 rounded-none p-4 shadow-none ring-1 ring-slate-100 dark:ring-white/10 lg:flex-row lg:items-center lg:gap-6">
    <div className="w-full flex-1">
      <label htmlFor="task-search" className="sr-only">
        Search tasks
      </label>
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-white/40"
        >
          <path
            fill="currentColor"
            d="m20.65 19.29-3.66-3.66a7 7 0 1 0-1.36 1.36l3.66 3.66a1 1 0 0 0 1.36-1.36ZM5 10a5 5 0 1 1 5 5 5 5 0 0 1-5-5Z"
          />
        </svg>
        <input
          id="task-search"
          type="search"
          placeholder="Search tasks..."
          className="w-full rounded-2xl border border-slate-200 bg-white px-12 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-0 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40 dark:focus:border-white/40 dark:focus:bg-transparent"
        />
      </div>
    </div>

    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
      <nav className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 p-1 dark:border-white/10 dark:bg-white/5">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            className={clsx(
              'inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-wide transition',
              activeView === tab.key
                ? 'bg-gradient-to-r from-slate-900 to-slate-700 text-white shadow-inner dark:text-slate-900 dark:from-white dark:to-slate-200 dark:text-slate-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10',
            )}
            type="button"
            onClick={() => onSelectView(tab.key)}
            aria-pressed={activeView === tab.key}
          >
            <span className="sr-only">{tab.label}</span>
            <span className="hidden items-center gap-1 sm:flex">
              <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center">
                {tab.icon}
              </span>
              {tab.label}
            </span>
            <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center sm:hidden">
              {tab.icon}
            </span>
          </button>
        ))}
      </nav>
      <button
        type="button"
        className="inline-flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-white/20 dark:text-white/80 dark:hover:border-white/40 dark:hover:text-white"
        onClick={onOpenCommandPalette}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <span>Command</span>
        <span className="rounded-xl bg-white/10 px-2 py-1 text-xs font-semibold">⌘K</span>
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-white/20 dark:text-white/80 dark:hover:border-white/40 dark:hover:text-white"
        onClick={onToggleTheme}
        aria-pressed={theme === 'dark'}
      >
        <span className="flex h-5 w-5 items-center justify-center">
          {theme === 'dark' ? (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
              <path
                fill="currentColor"
                d="M6.76 4.84 5.35 3.43a1 1 0 1 0-1.41 1.41l1.41 1.42a1 1 0 0 0 1.41-1.42Zm10.49 0a1 1 0 0 0 1.41 1.42l1.41-1.42a1 1 0 0 0-1.41-1.41Zm2.83 6.42a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2ZM11 5V3a1 1 0 0 0-2 0v2a1 1 0 0 0 2 0Zm7 7a6 6 0 1 1-6-6 6 6 0 0 1 6 6Zm-6 8a1 1 0 0 0-1 1v2a1 1 0 1 0 2 0v-2a1 1 0 0 0-1-1ZM4 11H2a1 1 0 0 0 0 2h2a1 1 0 1 0 0-2Zm-.66 7.07a1 1 0 0 0 1.41 1.41l1.42-1.41a1 1 0 0 0-1.42-1.42Zm15.56 0-1.42 1.41a1 1 0 0 0 1.42 1.41l1.41-1.41a1 1 0 1 0-1.41-1.41Z"
              />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
              <path
                fill="currentColor"
                d="M21.64 13a1 1 0 0 0-1-.27 8 8 0 0 1-2.82.51A8.15 8.15 0 0 1 9.66 5 8 8 0 0 1 10.18 2.1a1 1 0 0 0-.78-1.16 1 1 0 0 0-.91.28A10.14 10.14 0 1 0 22 13.91a1 1 0 0 0-.36-.91Z"
              />
            </svg>
          )}
        </span>
        <span>{theme === 'dark' ? 'Night' : 'Day'}</span>
      </button>
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-300 text-slate-500 transition hover:border-slate-400 hover:text-slate-900 dark:border-white/10 dark:text-white/70 dark:hover:border-white/40 dark:hover:text-white"
        aria-label="Notifications"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
          <path
            fill="currentColor"
          d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-4-5.65V4a2 2 0 0 0-4 0v1.35A6 6 0 0 0 6 11v5l-2 2v1h16v-1Z"
        />
      </svg>
      </button>
      {onSignOut ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white dark:bg-white/20 dark:text-slate-900">
            {userInitials}
          </div>
          <div className="min-w-[120px]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-white/50">
              Signed in as
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{userLabel ?? 'Account'}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-white/20 dark:text-white/70 dark:hover:border-white/40 dark:hover:text-white"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  </header>
  );
};
