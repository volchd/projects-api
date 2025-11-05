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
  <header className="sticky top-0 z-10 flex items-center justify-between gap-6 px-6 py-4 bg-white border-b border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
    <div className="flex-1 w-full max-w-xs">
      <label htmlFor="search" className="sr-only">
        Search tasks
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="w-5 h-5 text-gray-500 dark:text-gray-400"
          >
            <path
              fill="currentColor"
              d="m20.65 19.29-3.66-3.66a7 7 0 1 0-1.36 1.36l3.66 3.66a1 1 0 0 0 1.36-1.36ZM5 10a5 5 0 1 1 5 5 5 5 0 0 1-5-5Z"
            />
          </svg>
        </div>
        <input
          id="search"
          type="search"
          placeholder="Search tasks..."
          className="block w-full h-10 pl-10 pr-4 text-sm bg-white border border-gray-200 rounded-full dark:bg-gray-800 dark:border-gray-700 focus:ring-indigo-600 focus:border-indigo-600"
        />
      </div>
    </div>

    <div className="flex items-center gap-6">
      <nav className="flex items-center gap-6">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${
              activeView === tab.key
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400'
            }`}
            type="button"
            onClick={() => onSelectView(tab.key)}
            aria-pressed={activeView === tab.key}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <button
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5">
            <path
              fill="currentColor"
              d="M12 3a9 9 0 0 0-7.49 13.92l-1.39 3.47a1 1 0 0 0 1.29 1.29l3.47-1.39A9 9 0 1 0 12 3Zm0 16a7 7 0 1 1 7-7 7 7 0 0 1-7 7Z"
            />
          </svg>
          Comments
        </button>
      </nav>
      <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
      <button
        type="button"
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-900 transition-colors bg-white border border-gray-200 rounded-full shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-50 hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={onOpenCommandPalette}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <span>Command</span>
        <span className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400">
          ⌘K
        </span>
      </button>
      <button
        type="button"
        className="inline-flex items-center justify-center w-10 h-10 text-gray-500 transition-colors bg-white border border-gray-200 rounded-full dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400"
        aria-label="Notifications"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5">
          <path
            fill="currentColor"
            d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-4-5.65V4a2 2 0 0 0-4 0v1.35A6 6 0 0 0 6 11v5l-2 2v1h16v-1Z"
          />
        </svg>
      </button>
      <button
        type="button"
        className="inline-flex items-center justify-center h-10 px-5 text-sm font-semibold text-white transition-colors bg-teal-600 rounded-full shadow-lg dark:bg-teal-500 hover:bg-teal-700 dark:hover:bg-teal-600"
      >
        Invite
      </button>
      <div
        className="inline-flex items-center justify-center w-10 h-10 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-full dark:bg-indigo-900/40 dark:text-indigo-400"
        aria-hidden="true"
      >
        <span>AC</span>
      </div>
    </div>
  </header>
);
