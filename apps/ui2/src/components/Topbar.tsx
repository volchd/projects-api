import clsx from 'clsx';

type TopbarProps = {
  activeView: 'board' | 'list';
  onSelectView: (view: 'board' | 'list') => void;
  onOpenCommandPalette: () => void;
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
] as const;

export const Topbar = ({ activeView, onSelectView, onOpenCommandPalette }: TopbarProps) => (
  <header className="glass-panel flex flex-col gap-4 rounded-3xl p-4 lg:flex-row lg:items-center lg:gap-6">
    <div className="w-full flex-1">
      <label htmlFor="task-search" className="sr-only">
        Search tasks
      </label>
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
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
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-12 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:bg-transparent focus:outline-none focus:ring-0"
        />
      </div>
    </div>

    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
      <nav className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            className={clsx(
              'inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-wide transition',
              activeView === tab.key
                ? 'bg-white text-slate-900'
                : 'text-white/70 hover:text-white hover:bg-white/10',
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
        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <path
            fill="currentColor"
            d="M12 3a9 9 0 0 0-7.49 13.92l-1.39 3.47a1 1 0 0 0 1.29 1.29l3.47-1.39A9 9 0 1 0 12 3Zm0 16a7 7 0 1 1 7-7 7 7 0 0 1-7 7Z"
          />
        </svg>
        Comments
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-3 rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
        onClick={onOpenCommandPalette}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <span>Command</span>
        <span className="rounded-xl bg-white/10 px-2 py-1 text-xs font-semibold">⌘K</span>
      </button>
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-white/70 transition hover:border-white/40 hover:text-white"
        aria-label="Notifications"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
          <path
            fill="currentColor"
            d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-4-5.65V4a2 2 0 0 0-4 0v1.35A6 6 0 0 0 6 11v5l-2 2v1h16v-1Z"
          />
        </svg>
      </button>
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-1">
        <div className="text-sm font-semibold text-white/80">Invite</div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-sm font-semibold text-white shadow-lg"
        >
          AC
        </button>
      </div>
    </div>
  </header>
);
