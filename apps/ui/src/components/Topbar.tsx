type TopbarProps = {
  activeView: 'board' | 'list';
  onSelectView: (view: 'board' | 'list') => void;
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

export const Topbar = ({ activeView, onSelectView }: TopbarProps) => (
  <header className="topbar">
    <div className="topbar__search">
      <label htmlFor="search" className="sr-only">
        Search tasks
      </label>
      <div className="topbar__search-input">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="topbar__search-icon">
          <path
            fill="currentColor"
            d="m20.65 19.29-3.66-3.66a7 7 0 1 0-1.36 1.36l3.66 3.66a1 1 0 0 0 1.36-1.36ZM5 10a5 5 0 1 1 5 5 5 5 0 0 1-5-5Z"
          />
        </svg>
        <input id="search" type="search" placeholder="Search tasks..." />
      </div>
    </div>

    <div className="topbar__actions">
      <nav className="topbar__tabs">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            className={`topbar__tab${activeView === tab.key ? ' topbar__tab--active' : ''}`}
            type="button"
            onClick={() => onSelectView(tab.key)}
            aria-pressed={activeView === tab.key}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <button className="topbar__tab" type="button">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 3a9 9 0 0 0-7.49 13.92l-1.39 3.47a1 1 0 0 0 1.29 1.29l3.47-1.39A9 9 0 1 0 12 3Zm0 16a7 7 0 1 1 7-7 7 7 0 0 1-7 7Z"
            />
          </svg>
          Comments
        </button>
      </nav>
      <div className="topbar__spacer" aria-hidden="true" />
      <button type="button" className="topbar__command">
        <span>Command</span>
        <span className="topbar__command-key">⌘K</span>
      </button>
      <button type="button" className="topbar__icon-button" aria-label="Notifications">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-4-5.65V4a2 2 0 0 0-4 0v1.35A6 6 0 0 0 6 11v5l-2 2v1h16v-1Z"
          />
        </svg>
      </button>
      <button type="button" className="topbar__invite">
        Invite
      </button>
      <div className="topbar__avatar" aria-hidden="true">
        <span>AC</span>
      </div>
    </div>
  </header>
);
