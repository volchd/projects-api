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
};

export const Modal = ({
  open,
  title,
  description,
  children,
  onClose,
  isDismissDisabled = false,
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
    <div className="modal__backdrop" role="presentation">
      <div
        className="modal"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedTitleId}
        aria-describedby={resolvedDescriptionId}
        tabIndex={-1}
      >
        {title ? (
          <h2 id={resolvedTitleId} className="modal__title">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p id={resolvedDescriptionId} className="modal__description">
            {description}
          </p>
        ) : null}
        <div className="modal__content">{children}</div>
      </div>
    </div>
  );
};
