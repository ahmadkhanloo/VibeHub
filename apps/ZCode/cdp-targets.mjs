/** Only main renderer pages receive chat styling; child webviews/iframes are app content. */
export function isZCodePageTarget(target) {
  return target?.type === 'page' && !String(target.url ?? '').startsWith('devtools://');
}
