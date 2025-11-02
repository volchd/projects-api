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
    <div className="command-palette__backdrop" role="presentation">
      <div
        className="command-palette"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
      >
        <div className="command-palette__header">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="command-palette__icon">
            <path
              fill="currentColor"
              d="m20.65 19.29-3.66-3.66a7 7 0 1 0-1.36 1.36l3.66 3.66a1 1 0 0 0 1.36-1.36ZM5 10a5 5 0 1 1 5 5 5 5 0 0 1-5-5Z"
            />
          </svg>
          <input
            ref={inputRef}
            className="command-palette__input"
            type="text"
            placeholder="Search commands…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="button" className="command-palette__close" onClick={onClose}>
            <span className="sr-only">Close command menu</span>
            ×
          </button>
        </div>
        <div className="command-palette__body">
          {filteredCommands.length === 0 ? (
            <div className="command-palette__empty">No commands found</div>
          ) : (
            <ul className="command-palette__list" role="listbox">
              {filteredCommands.map((command, index) => (
                <li key={command.id}>
                  <button
                    type="button"
                    className={`command-palette__item${
                      index === activeIndex ? ' command-palette__item--active' : ''
                    }${command.disabled ? ' command-palette__item--disabled' : ''}`}
                    onClick={() => handleSelect(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                    disabled={command.disabled}
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    <span className="command-palette__item-label">{command.label}</span>
                    {command.description ? (
                      <span className="command-palette__item-description">{command.description}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="command-palette__footer">
          <span>Navigate with ↑ ↓, press Enter to run.</span>
        </div>
      </div>
    </div>
  );
};
