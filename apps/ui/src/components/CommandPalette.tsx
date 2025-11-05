import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';

export type CommandPaletteItem = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type CommandPaletteProps = {
  open: boolean;
  commands: CommandPaletteItem[];
  onClose: () => void;
  onSelect: (commandId: string) => void;
};

export const CommandPalette = ({ open, commands, onClose, onSelect }: CommandPaletteProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useClickOutside(
    containerRef,
    () => {
      if (open) {
        onClose();
      }
    },
    open,
  );

  useEscapeKey(
    () => {
      if (open) {
        onClose();
      }
    },
    open,
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredCommands = useMemo(() => {
    if (!normalizedQuery) {
      return commands;
    }
    return commands.filter((command) => {
      const label = command.label.toLowerCase();
      const description = command.description?.toLowerCase() ?? '';
      return label.includes(normalizedQuery) || description.includes(normalizedQuery);
    });
  }, [commands, normalizedQuery]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveIndex(0);
  }, [open, normalizedQuery]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveIndex((current) => {
      if (!filteredCommands.length) {
        return 0;
      }
      return Math.min(current, filteredCommands.length - 1);
    });
  }, [filteredCommands.length, open]);

  const handleSelect = (index: number) => {
    const command = filteredCommands[index];
    if (!command || command.disabled) {
      return;
    }
    onSelect(command.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!filteredCommands.length) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % filteredCommands.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleSelect(activeIndex);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center p-6 bg-gray-900/40"
      role="presentation"
    >
      <div
        className="flex flex-col w-full max-w-md overflow-hidden bg-gray-900 border border-gray-700 rounded-2xl shadow-xl text-gray-50"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="w-5 h-5 text-gray-400"
          >
            <path
              fill="currentColor"
              d="m20.65 19.29-3.66-3.66a7 7 0 1 0-1.36 1.36l3.66 3.66a1 1 0 0 0 1.36-1.36ZM5 10a5 5 0 1 1 5 5 5 5 0 0 1-5-5Z"
            />
          </svg>
          <input
            ref={inputRef}
            className="flex-1 text-base bg-transparent border-none focus:ring-0"
            type="text"
            placeholder="Search commands…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="inline-flex items-center justify-center w-8 h-8 text-xl text-indigo-400 bg-gray-800 rounded-full hover:bg-gray-700"
            onClick={onClose}
          >
            <span className="sr-only">Close command menu</span>
            &times;
          </button>
        </div>
        <div className="max-h-xs overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-gray-400">No commands found</div>
          ) : (
            <ul className="flex flex-col gap-1 p-2" role="listbox">
              {filteredCommands.map((command, index) => (
                <li key={command.id}>
                  <button
                    type="button"
                    className={`flex flex-col w-full gap-1 p-3 text-left transition-colors rounded-lg ${
                      index === activeIndex
                        ? 'bg-indigo-900/60'
                        : 'hover:bg-indigo-900/20'
                    }${command.disabled ? ' opacity-40 cursor-not-allowed' : ''}`}
                    onClick={() => handleSelect(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                    disabled={command.disabled}
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    <span className="text-base font-semibold">{command.label}</span>
                    {command.description ? (
                      <span className="text-sm text-gray-300">
                        {command.description}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-4 py-3 text-sm text-gray-400 border-t border-gray-700">
          <span>Navigate with ↑ ↓, press Enter to run.</span>
        </div>
      </div>
    </div>
  );
};
