const DOCUMENT_TARGET_TYPES = new Set(['page', 'iframe', 'webview', 'other']);

export function isInspectableTarget(target) {
  if (!target || typeof target.url !== 'string' || !target.url.trim()) return false;
  if (target.url.startsWith('devtools://')) return false;
  return DOCUMENT_TARGET_TYPES.has(target.type || 'other');
}
