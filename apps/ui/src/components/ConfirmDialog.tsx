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
    <div className="confirm-dialog__backdrop" role="presentation">
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        ref={containerRef}
      >
        <div className="confirm-dialog__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              fill="currentColor"
              d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 14h-2v-2h2Zm0-4h-2V7h2Z"
            />
          </svg>
        </div>
        <h2 id="confirm-dialog-title" className="confirm-dialog__title">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="confirm-dialog__description">
          {description}
        </p>
        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="confirm-dialog__button btn btn-secondary"
            onClick={onCancel}
            disabled={isConfirming}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="confirm-dialog__button btn btn-danger"
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
