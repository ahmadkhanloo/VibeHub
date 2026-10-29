import type { Page } from '@playwright/test';
import { installMockNative } from '../../apps/desktop/src/dev/mock-native';
export async function mockNative(page: Page, scenario = 'ready', language = 'en', onboardingDone = true) {
  await page.addInitScript(installMockNative, { scenario, language, onboardingDone });
}
