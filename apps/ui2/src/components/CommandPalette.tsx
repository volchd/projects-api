import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import clsx from 'clsx';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-10 backdrop-blur-md"
      role="presentation"
    >
      <div
        className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/90 p-4 shadow-card"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
      >
        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-white/60">
            <path
              fill="currentColor"
              d="m20.65 19.29-3.66-3.66a7 7 0 1 0-1.36 1.36l3.66 3.66a1 1 0 0 0 1.36-1.36ZM5 10a5 5 0 1 1 5 5 5 5 0 0 1-5-5Z"
            />
          </svg>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            type="text"
            placeholder="Search commands…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="rounded-full border border-white/10 px-2 py-1 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
            onClick={onClose}
          >
            Esc
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center text-sm text-white/60">No commands found</div>
          ) : (
            <ul role="listbox" className="space-y-1">
              {filteredCommands.map((command, index) => (
                <li key={command.id}>
                  <button
                    type="button"
                    className={clsx(
                      'flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition',
                      index === activeIndex ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5',
                      command.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
                    )}
                    onClick={() => handleSelect(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                    disabled={command.disabled}
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    <span className="text-sm font-semibold">{command.label}</span>
                    {command.description ? (
                      <span className="text-xs text-white/60">{command.description}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-white/10 pt-3 text-center text-xs text-white/50">
          Navigate with ↑ ↓, press Enter to run.
        </div>
      </div>
    </div>
  );
};
