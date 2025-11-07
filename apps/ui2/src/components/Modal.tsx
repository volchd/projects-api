import clsx from 'clsx';
import { ReactNode, useEffect, useId, useRef } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';

type ModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  isDismissDisabled?: boolean;
  size?: 'default' | 'wide';
};

export const Modal = ({
  open,
  title,
  description,
  children,
  onClose,
  isDismissDisabled = false,
  size = 'default',
}: ModalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useClickOutside(
    containerRef,
    () => {
      if (!isDismissDisabled) {
        onClose();
      }
    },
    open,
  );

  useEscapeKey(
    () => {
      if (!isDismissDisabled && open) {
        onClose();
      }
    },
    open && !isDismissDisabled,
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const node = containerRef.current;
    if (!node) {
      return;
    }
    const focusable = node.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    const frame = window.requestAnimationFrame(() => {
      (focusable ?? node).focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const resolvedTitleId = title ? `${titleId}-title` : undefined;
  const resolvedDescriptionId = description ? `${descriptionId}-description` : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 px-4 py-8 backdrop-blur-md dark:bg-slate-950/80"
      role="presentation"
    >
      <div
        className={clsx(
          'w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-soft dark:border-white/10 dark:bg-slate-950/80 dark:shadow-card',
          size === 'wide' ? 'max-w-4xl' : 'max-w-2xl',
        )}
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedTitleId}
        aria-describedby={resolvedDescriptionId}
        tabIndex={-1}
      >
        {title ? (
          <h2 id={resolvedTitleId} className="text-2xl font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p id={resolvedDescriptionId} className="mt-2 text-sm text-slate-600 dark:text-white/70">
            {description}
          </p>
        ) : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
};
