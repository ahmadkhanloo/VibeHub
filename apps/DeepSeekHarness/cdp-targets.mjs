/** Only the app's own renderer pages receive chat and composer styling. */
export function isDeepSeekHarnessPageTarget(target) {
  return target?.type === 'page'
    && typeof target.url === 'string'
    && target.url.startsWith('dsh-app://app/');
}
