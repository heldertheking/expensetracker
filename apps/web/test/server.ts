import { http, HttpResponse } from 'msw';
import type { JsonBodyType } from 'msw';
import { setupServer } from 'msw/node';

/** The MSW server shared by all tests; tests add handlers with `server.use(...)`. */
export const server = setupServer();

export { http, HttpResponse };

type Body = JsonBodyType | ((url: URL) => JsonBodyType);

/** Responds with `body` and records each request URL, for asserting query parameters. */
export function recordGet(path: string, body: Body) {
  const urls: URL[] = [];
  const handler = http.get(path, ({ request }) => {
    const url = new URL(request.url);
    urls.push(url);
    return HttpResponse.json(typeof body === 'function' ? body(url) : body);
  });
  return { handler, urls };
}
