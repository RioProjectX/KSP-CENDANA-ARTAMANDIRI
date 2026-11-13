import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/app';

const app = createApiApp();

interface VercelLikeRequest extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  _body?: boolean;
}

export default function handler(req: VercelLikeRequest, res: ServerResponse) {
  // Normalize rewritten URL from vercel.json (?__path=...)
  const rawUrl = req.url || '/api';
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const queryPath = req.query?.__path;
  const pathFromObj = Array.isArray(queryPath) ? queryPath[0] : queryPath;
  const pathParam = parsedUrl.searchParams.get('__path') ?? pathFromObj ?? null;

  if (pathParam !== null) {
    parsedUrl.searchParams.delete('__path');
    const cleanPath = String(pathParam).replace(/^\/+/, '');
    const remainingQs = parsedUrl.searchParams.toString();
    req.url = `/api/${cleanPath}${remainingQs ? `?${remainingQs}` : ''}`;
  } else if (rawUrl.startsWith('/api/index')) {
    req.url = rawUrl.replace(/^\/api\/index/, '/api') || '/api';
  }

  // If Vercel runtime already pre-parsed req.body, tell body-parser not to re-read stream
  if (req.body !== undefined && !req._body) {
    req._body = true;
  }

  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
