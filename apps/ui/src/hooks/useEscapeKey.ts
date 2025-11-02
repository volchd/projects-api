import { useEffect } from 'react';

export const useEscapeKey = (handler: () => void, active = true) => {
  useEffect(() => {
    if (!active) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handler();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [handler, active]);
};
