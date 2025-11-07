import { RefObject, useEffect } from 'react';

export const useClickOutside = <T extends HTMLElement>(
  ref: RefObject<T>,
  handler: () => void,
  active = true,
) => {
  useEffect(() => {
    if (!active) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const node = ref.current;
      if (!node) {
        return;
      }
      if (!node.contains(event.target as Node)) {
        handler();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [ref, handler, active]);
};
