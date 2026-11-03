import { useSyncExternalStore } from 'react';
import type { AnchorHTMLAttributes, MouseEvent, Ref } from 'react';

/**
 * A small router over the History API. The app has five routes and no nested layouts, so a
 * library would add more than it saves (see ADR 0013).
 */
export type Route =
  | { name: 'dashboard' }
  | { name: 'transactions' }
  | { name: 'projects' }
  | { name: 'project'; id: string }
  | { name: 'activity' }
  | { name: 'notFound' };

export function matchRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { name: 'dashboard' };
  if (path === '/transactions') return { name: 'transactions' };
  if (path === '/projects') return { name: 'projects' };
  if (path === '/activity') return { name: 'activity' };
  const project = /^\/projects\/([^/]+)$/.exec(path);
  if (project) {
    try {
      return { name: 'project', id: decodeURIComponent(project[1]!) };
    } catch {
      // a malformed escape such as %E0%A4%A is not a project
      return { name: 'notFound' };
    }
  }
  return { name: 'notFound' };
}

const NAVIGATE_EVENT = 'app:navigate';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
  window.scrollTo?.({ top: 0 });
}

export function usePathname(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => '/',
  );
}

export function useRoute(): Route {
  return matchRoute(usePathname());
}

type RouterLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  ref?: Ref<HTMLAnchorElement>;
};

/**
 * An anchor that navigates in-app on a plain left click and behaves normally otherwise. The theme
 * makes it the link component of MUI, so `<Link href>` and `<Button href>` use the router.
 */
export function RouterLink({ href, onClick, ref, ...rest }: RouterLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      !href.startsWith('/') ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(href);
  };
  return <a ref={ref} href={href} onClick={handleClick} {...rest} />;
}
