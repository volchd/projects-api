import { useRef } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useClickOutside(containerRef, () => {
    if (!isConfirming) {
      onCancel();
    }
  }, open);
  useEscapeKey(
    () => {
      if (!isConfirming && open) {
        onCancel();
      }
    },
    open,
  );

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/40"
      role="presentation"
    >
      <div
        className="flex flex-col gap-4 p-6 bg-white rounded-2xl shadow-xl dark:bg-gray-800 w-full max-w-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        ref={containerRef}
      >
        <div
          className="inline-flex items-center justify-center w-14 h-14 bg-red-100 rounded-full dark:bg-red-900/40 text-red-700 dark:text-red-300"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" focusable="false" className="w-7 h-7">
            <path
              fill="currentColor"
              d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 14h-2v-2h2Zm0-4h-2V7h2Z"
            />
          </svg>
        </div>
        <h2 id="confirm-dialog-title" className="text-xl font-bold">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="text-gray-600 dark:text-gray-300">
          {description}
        </p>
        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            className="inline-flex items-center justify-center h-10 px-5 text-sm font-semibold text-gray-900 transition-colors bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-50 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onCancel}
            disabled={isConfirming}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center h-10 px-5 text-sm font-semibold text-white transition-colors bg-red-600 rounded-lg shadow-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
