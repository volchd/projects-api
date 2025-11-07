import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useClickOutside } from '../hooks/useClickOutside';

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
};

const DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
};

const formatDisplay = (value: string, placeholder?: string) => {
  if (!value) {
    return placeholder ?? 'mm/dd/yyyy';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return placeholder ?? 'mm/dd/yyyy';
  }
  return date.toLocaleDateString('en-US', DISPLAY_OPTIONS);
};

const toISODate = (date: Date) => date.toISOString().slice(0, 10);

const addMonths = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setMonth(date.getMonth() + amount);
  return next;
};

const getMonthMatrix = (viewDate: Date) => {
  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return {
      date: current,
      inCurrentMonth: current.getMonth() === viewDate.getMonth(),
    };
  });
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const DatePicker = ({ value, onChange, disabled = false, placeholder, ariaLabel }: DatePickerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => (value ? new Date(value) : new Date()));
  const selectedDate = value ? new Date(value) : null;

  useClickOutside(
    containerRef,
    () => {
      setIsOpen(false);
    },
    isOpen,
  );

  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        setViewDate(parsed);
      }
    }
  }, [value]);

  const days = useMemo(() => getMonthMatrix(viewDate), [viewDate]);

  const handleSelectDate = (date: Date) => {
    if (disabled) {
      return;
    }
    onChange(toISODate(date));
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const handleToday = () => {
    const today = new Date();
    onChange(toISODate(today));
    setViewDate(today);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const handleToggle = () => {
    if (disabled) {
      return;
    }
    setIsOpen((current) => !current);
  };

  const isSameDay = (a: Date | null, b: Date) => {
    if (!a) {
      return false;
    }
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={clsx(
          'flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm font-medium transition',
          disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/50'
            : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/30',
        )}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={handleToggle}
        ref={buttonRef}
        disabled={disabled}
      >
        <span>{formatDisplay(value, placeholder)}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-slate-500 dark:text-white/70">
          <path
            fill="currentColor"
            d="M19 4h-1V2h-2v2H8V2H6v2H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm1 15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10h16Zm0-11H4V7a1 1 0 0 1 1-1h1v1h2V6h8v1h2V6h1a1 1 0 0 1 1 1Z"
          />
        </svg>
      </button>
      {isOpen ? (
        <div className="absolute z-30 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-slate-900 dark:shadow-card">
          <div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-white">
            <button
              type="button"
              className="rounded-xl border border-slate-200 p-1 text-slate-700 transition hover:border-slate-400 dark:border-white/20 dark:text-white/80 dark:hover:border-white/40"
              onClick={() => setViewDate((current) => addMonths(current, -1))}
            >
              <span aria-hidden="true">‹</span>
              <span className="sr-only">Previous month</span>
            </button>
            <span className="text-sm font-semibold">
              {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              type="button"
              className="rounded-xl border border-slate-200 p-1 text-slate-700 transition hover:border-slate-400 dark:border-white/20 dark:text-white/80 dark:hover:border-white/40"
              onClick={() => setViewDate((current) => addMonths(current, 1))}
            >
              <span aria-hidden="true">›</span>
              <span className="sr-only">Next month</span>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500 dark:text-white/60">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
            {days.map(({ date, inCurrentMonth }) => {
              const isSelected = isSameDay(selectedDate, date);
              return (
                <button
                  type="button"
                  key={date.toISOString()}
                  className={clsx(
                    'h-9 rounded-xl text-center transition',
                    inCurrentMonth
                      ? 'text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10'
                      : 'text-slate-300 dark:text-white/30',
                    isSelected && 'bg-indigo-600 text-white hover:bg-indigo-500',
                  )}
                  onClick={() => handleSelectDate(date)}
                  disabled={disabled}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-semibold">
            <button
              type="button"
              className="text-rose-500 hover:text-rose-600"
              onClick={handleClear}
            >
              Clear
            </button>
            <button
              type="button"
              className="text-indigo-600 hover:text-indigo-500"
              onClick={handleToday}
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
