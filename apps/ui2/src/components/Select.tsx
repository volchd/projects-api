import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useClickOutside } from '../hooks/useClickOutside';

type SelectOption<T extends string> = {
  key: T;
  label: string;
};

type SelectProps<T extends string> = {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
};

export const Select = <T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
}: SelectProps<T>) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => option.key === value),
    ),
  );

  const selected = useMemo(() => options.find((option) => option.key === value), [options, value]);

  useClickOutside(
    containerRef,
    () => {
      setIsOpen(false);
    },
    isOpen,
  );

  useEffect(() => {
    if (isOpen) {
      setHighlightIndex(Math.max(0, options.findIndex((option) => option.key === value)));
    }
  }, [isOpen, options, value]);

  const handleSelect = useCallback(
    (option: SelectOption<T>) => {
      if (disabled) {
        return;
      }
      onChange(option.key);
      setIsOpen(false);
      buttonRef.current?.focus();
    },
    [disabled, onChange],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightIndex((current) => {
        if (event.key === 'ArrowDown') {
          return (current + 1) % options.length;
        }
        return (current - 1 + options.length) % options.length;
      });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const option = options[highlightIndex];
      if (option) {
        handleSelect(option);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  };

  const handleButtonClick = () => {
    if (disabled) {
      return;
    }
    setIsOpen((current) => !current);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        ref={buttonRef}
        className={clsx(
          'flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm font-medium transition',
          disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/50'
            : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/30',
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={handleButtonClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      >
        <span>{selected?.label ?? ''}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-slate-500 dark:text-white/70">
          <path
            fill="currentColor"
            d="M12 15.5 6 9.5l1.41-1.41L12 12.67l4.59-4.58L18 9.5Z"
          />
        </svg>
      </button>
      {isOpen ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-soft dark:border-white/10 dark:bg-slate-900 dark:shadow-card"
        >
          {options.map((option, index) => {
            const isSelected = option.key === value;
            const isHighlighted = index === highlightIndex;
            return (
              <li key={option.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={clsx(
                    'flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition',
                    isSelected && 'font-semibold text-indigo-600 dark:text-indigo-300',
                    isHighlighted && !isSelected && 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white',
                    !isSelected && !isHighlighted && 'text-slate-700 hover:bg-slate-100 dark:text-white/80 dark:hover:bg-white/10',
                  )}
                  onClick={() => handleSelect(option)}
                >
                  <span>{option.label}</span>
                  {isSelected ? (
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-indigo-600 dark:text-indigo-300">
                      <path
                        fill="currentColor"
                        d="m10.6 15.8-3.6-3.6L8.4 10l2.2 2.2 5-5L17.6 9Z"
                      />
                    </svg>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
