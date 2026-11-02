/** Match only the installed OpenCode desktop renderer document. */
export function isOpenCodePageTarget(target) {
  if (target?.type !== 'page') return false;
  try {
    const url = new URL(target.url);
    return url.protocol === 'oc:' && url.hostname === 'renderer' && url.pathname === '/index.html';
  } catch {
    return false;
  }
}
