/** Claude Desktop 2.42304.2 hosts its signed-in UI at claude.ai. */
export function isClaudePageTarget(target) {
  if (target?.type !== 'page') return false;
  try {
    const url = new URL(target.url);
    return url.protocol === 'https:' && url.hostname === 'claude.ai';
  } catch {
    return false;
  }
}
