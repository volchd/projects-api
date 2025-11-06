export function Header() {
  return (
    <header className="flex items-center justify-between bg-white p-4 shadow-md">
      <div className="flex items-center">
        <div className="relative">
          <input
            type="text"
            placeholder="Search tasks..."
            className="rounded-md border border-gray-300 py-2 pl-10 pr-4"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
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
        <nav className="ml-6 space-x-4">
          <a href="#" className="border-b-2 border-blue-500 pb-1 text-blue-500">
            Board
          </a>
          <a href="#" className="text-gray-500">
            List
          </a>
          <a href="#" className="text-gray-500">
            Comments
          </a>
        </nav>
      </div>
      <div className="flex items-center space-x-4">
        <button className="rounded-md bg-gray-100 px-4 py-2 text-gray-600">
          Command <span className="ml-2 text-gray-400">⌘K</span>
        </button>
        <button className="rounded-full p-2 hover:bg-gray-100">
          <svg
            className="h-6 w-6 text-gray-500"
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
        <button className="rounded-md bg-teal-500 px-4 py-2 text-white">
          Invite
        </button>
        <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center">
          <span className="text-blue-600">AC</span>
        </div>
      </div>
    </header>
  );
}
