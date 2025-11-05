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
      className="fixed inset-0 z-40 flex items-start justify-center p-6 bg-gray-900/40"
      role="presentation"
    >
      <div
        className={`flex flex-col gap-4 p-7 bg-white rounded-2xl shadow-xl dark:bg-gray-800 w-full ${
          size === 'wide' ? 'max-w-3xl' : 'max-w-md'
        }`}
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedTitleId}
        aria-describedby={resolvedDescriptionId}
        tabIndex={-1}
      >
        {title ? (
          <h2 id={resolvedTitleId} className="text-xl font-bold">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p id={resolvedDescriptionId} className="text-gray-600 dark:text-gray-300">
            {description}
          </p>
        ) : null}
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
};
