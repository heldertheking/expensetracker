import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';

/** Renders the whole app at `path`, with a user-event instance for interactions. */
export function renderApp(path = '/') {
  window.history.replaceState(null, '', path);
  const user = userEvent.setup();
  return { user, ...render(<App />) };
}
