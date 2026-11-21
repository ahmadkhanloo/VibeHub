/**
 * Match only the MiniMax Code application renderer documents.
 * MiniMax Code 3.1.15 serves its own pages from the privileged `app://./`
 * scheme; the Archon chat window is `app://./archon`, sometimes with an
 * `initialUrl` query. Embedded browser webviews (https), preview artifacts
 * (`mavis-preview:`), PPT previews and devtools must never match, and the
 * prefix check must not swallow the separate `/archon-mini-chat` window.
 */
const APPLICATION_ROUTES = new Set(['/archon', '/login', '/onboarding']);

export function isMiniMaxPageTarget(target) {
  if (target?.type !== 'page') return false;
  try {
    const url = new URL(target.url);
    if (url.protocol !== 'app:' || url.hostname !== '.') return false;
    const path = url.pathname.replace(/\/+$/, '').toLowerCase() || '/';
    return APPLICATION_ROUTES.has(path);
  } catch {
    return false;
  }
}
