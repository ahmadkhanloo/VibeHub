export function claudeLaunchPreferences(): { connectionId?: string; authHeader: 'api-key' | 'bearer' } {
  try {
    const connectionId = localStorage.getItem('vibehub.claude.connection') || undefined;
    return { connectionId, authHeader: localStorage.getItem('vibehub.claude.auth') === 'bearer' ? 'bearer' : 'api-key' };
  } catch { return { authHeader: 'api-key' }; }
}
