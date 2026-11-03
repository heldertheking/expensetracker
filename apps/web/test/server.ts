import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/** The MSW server shared by all tests; tests add handlers with `server.use(...)`. */
export const server = setupServer();

export { http, HttpResponse };

/** Responds with `body` and records each request URL, for asserting query parameters. */
export function recordGet(path: string, body: unknown | ((url: URL) => unknown)) {
  const urls: URL[] = [];
  const handler = http.get(path, ({ request }) => {
    const url = new URL(request.url);
    urls.push(url);
    return HttpResponse.json(
      typeof body === 'function' ? (body as (u: URL) => unknown)(url) : body,
    );
  });
  return { handler, urls };
}
