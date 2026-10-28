import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchFailureKind } from '../packages/core/src/index.ts';

test('launch failures distinguish busy connections, already-open apps and unrelated errors', () => {
  assert.equal(launchFailureKind('VIBEHUB_LAUNCH_PORT_BUSY'), 'portBusy');
  assert.equal(launchFailureKind('Port 9226 is already used by another program.'), 'portBusy');
  assert.equal(launchFailureKind('VIBEHUB_LAUNCH_ALREADY_OPEN'), 'alreadyOpen');
  assert.equal(launchFailureKind('Qoder is already running without the DevTools port.'), 'alreadyOpen');
  assert.equal(launchFailureKind('Access denied'), undefined);
  assert.equal(launchFailureKind(undefined), undefined);
});
