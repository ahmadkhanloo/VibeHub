import type { AccountsSnapshot, DesktopAccountsSnapshot } from '@/services/ipc';

export type AccountSummaryStatus = 'loading' | 'ready' | 'empty' | 'unsupported' | 'reauthRequired' | 'error';
export type QuotaSummaryStatus = 'loading' | 'ready' | 'empty' | 'unsupported' | 'unknown' | 'error';

export interface SummaryQuotaItem {
  label: string;
  remaining: number | null;
  granted?: number | string | null;
  unit: string;
}

export interface AccountSummary {
  appId: string;
  accountId: string | null;
  status: AccountSummaryStatus;
  quotaStatus: QuotaSummaryStatus;
  accountName: string;
  quotaItems: SummaryQuotaItem[];
  checkedAt: number | null;
  stale: boolean;
  showingPrevious: boolean;
  errorCode: string | null;
  quotaErrorCode: string | null;
  canRefresh: boolean;
  canAdd: boolean;
}

type SummarySnapshot = (AccountsSnapshot | DesktopAccountsSnapshot) & { errorCode?: string | null };

export function accountSummaryFromSnapshot(
  appId: string,
  snapshot: SummarySnapshot,
  now = Math.floor(Date.now() / 1000),
): AccountSummary {
  if (!['chatgpt', 'qoder', 'zcode'].includes(appId)) {
    return {
      appId, accountId: null, status: 'unsupported', quotaStatus: 'unsupported', accountName: '', quotaItems: [],
      checkedAt: null, stale: false, showingPrevious: false, errorCode: null, quotaErrorCode: null,
      canRefresh: false, canAdd: false,
    };
  }

  const account = snapshot.accounts.find(item => item.id === snapshot.activeId);
  const errorCode = snapshot.errorCode ?? account?.errorCode ?? null;
  const quotaErrorCode = 'quotaErrorCode' in (account ?? {}) ? account?.quotaErrorCode ?? null : null;
  const isCodex = 'cliReady' in snapshot;
  const canRefresh = isCodex ? (snapshot as AccountsSnapshot).cliReady : (snapshot as DesktopAccountsSnapshot).capabilities.canRefresh;
  const canAdd = isCodex
    ? (snapshot as AccountsSnapshot).cliReady && !(snapshot as AccountsSnapshot).nativePreview
    : (snapshot as DesktopAccountsSnapshot).capabilities.canImport || (snapshot as DesktopAccountsSnapshot).capabilities.canLogin;
  const rawQuota = isCodex
    ? (account as AccountsSnapshot['accounts'][number] | undefined)?.windows.map(window => ({
        label: window.bucket,
        remaining: window.remaining,
        unit: 'percent',
      })) ?? []
    : (account as DesktopAccountsSnapshot['accounts'][number] | undefined)?.usage.map(item => ({
        label: item.label,
        remaining: item.remaining ?? null,
        granted: item.granted,
        unit: item.unit,
      })) ?? [];
  const checkedAt = account?.checkedAt ?? null;
  const hasQuota = rawQuota.some(item => item.remaining != null);
  const hasPrevious = !!account && (!!account.name || checkedAt != null);
  const status: AccountSummaryStatus = errorCode === 'loginRequired'
    ? 'reauthRequired'
    : errorCode
      ? 'error'
      : !account
        ? 'empty'
        : 'ready';

  return {
    appId,
    accountId: account?.id ?? null,
    status,
    quotaStatus: errorCode === 'loginRequired'
      ? quotaErrorCode ? 'error' : hasQuota ? 'ready' : 'unknown'
      : quotaErrorCode
        ? 'error'
        : !account
          ? 'empty'
          : hasQuota
            ? 'ready'
            : 'unknown',
    accountName: account?.name ?? '',
    quotaItems: rawQuota,
    checkedAt,
    stale: checkedAt != null && (now < checkedAt || now - checkedAt > 300),
    showingPrevious: hasPrevious && (!!errorCode || !!quotaErrorCode),
    errorCode,
    quotaErrorCode,
    canRefresh,
    canAdd,
  };
}

export function accountSummaryError(appId: string, previous?: AccountSummary): AccountSummary {
  if (previous) return { ...previous, showingPrevious: true };
  return {
    appId,
    accountId: null,
    status: 'error',
    quotaStatus: 'error',
    accountName: '',
    quotaItems: [],
    checkedAt: null,
    stale: false,
    showingPrevious: false,
    errorCode: 'requestFailed',
    quotaErrorCode: 'requestFailed',
    canRefresh: true,
    canAdd: true,
  };
}
