export function Header() {
  return (
    <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white p-4">
      <div className="flex items-center">
        <div className="relative">
          <input
            type="text"
            placeholder="Search tasks..."
            className="w-96 rounded-lg border-slate-300 py-2 pl-10 pr-4 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          <svg
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <nav className="ml-8 space-x-2">
          <a
            href="#"
            className="rounded-md border-b-2 border-indigo-500 px-3 py-2 text-sm font-medium text-indigo-600"
          >
            Board
          </a>
          <a
            href="#"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            List
          </a>
          <a
            href="#"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            Comments
          </a>
        </nav>
      </div>
      <div className="flex items-center space-x-4">
        <button className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">
          Command <span className="ml-2 text-slate-400">⌘K</span>
        </button>
        <button className="rounded-full p-2 hover:bg-slate-100">
          <svg
            className="h-6 w-6 text-slate-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </button>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
          Invite
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
          <span className="font-semibold text-indigo-700">AC</span>
        </div>
      </div>
    </header>
  );
}
