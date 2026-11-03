import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const SUFFIX = 'Expense Tracker';

/** Sets the document title to `<title> · Expense Tracker`; does nothing while `title` is unset. */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    if (title !== undefined) document.title = `${title} · ${SUFFIX}`;
  }, [title]);
}

function isEditable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * Moves focus to the main region when `key` changes, so keyboard and screen reader users land at
 * the new page instead of on a link that is no longer there. It skips the first render (the
 * browser handles a page load) and never takes focus away from a field the user is typing in.
 */
export function useFocusOnNavigation(key: string, target: RefObject<HTMLElement | null>): void {
  const previous = useRef(key);
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    if (isEditable(document.activeElement)) return;
    target.current?.focus({ preventScroll: true });
  }, [key, target]);
}
