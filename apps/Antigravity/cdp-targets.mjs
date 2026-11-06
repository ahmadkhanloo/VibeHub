/** Identify the standalone Antigravity renderer; its login route is not chat content. */
export function isAntigravityPageTarget(target) {
  if (target?.type !== 'page') return false;
  try {
    const url = new URL(target.url);
    return url.protocol === 'https:'
      && ['127.0.0.1', 'localhost'].includes(url.hostname);
  } catch {
    return false;
  }
}
