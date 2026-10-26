import assert from 'node:assert/strict';
import test from 'node:test';
import { findUnregisteredCommands } from '../scripts/check-native-command-coverage.mjs';

test('native release guard compares every UI invoke name with the Tauri handler list', () => {
  const ipc = `
    invoke('app_version')
    invoke<{ ok: boolean }>('launch_app', { req })
    invoke<{ globalProfileId: string; perApp: Record<string, string> }>('proxy_config')
    invoke('proxy_save', { profile })
  `;
  const rust = '#[tauri::command] fn app_version() {}\n.invoke_handler(tauri::generate_handler![app_version, launch_app]);';

  assert.deepEqual(findUnregisteredCommands(ipc, rust), ['proxy_config', 'proxy_save']);
  const completeRust = rust.replace('app_version, launch_app', 'app_version, launch_app, proxy_config, proxy_save');
  assert.deepEqual(findUnregisteredCommands(ipc, completeRust), []);
});
