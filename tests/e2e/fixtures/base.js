import { test as baseTest, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { TestApi } from '../helpers/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const statePath = join(__dirname, '..', '.state', 'setup.json');

function loadState() {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    throw new Error('E2E setup state not found. Run global setup first or check E2E_SUPABASE_* env vars.');
  }
}

export const test = baseTest.extend({
  // eslint-disable-next-line no-empty-pattern
  tenantId: async ({}, use) => {
    const state = loadState();
    await use(state.tenantId);
  },

  // eslint-disable-next-line no-empty-pattern
  adminUser: async ({}, use) => {
    const state = loadState();
    await use({ username: state.username, password: state.password, email: state.email, userId: state.userId });
  },

  api: async ({ tenantId }, use) => {
    const state = loadState();
    const url = process.env.E2E_SUPABASE_URL || state.supabaseUrl;
    const key = process.env.E2E_SUPABASE_SERVICE_KEY || state.serviceKey;
    if (!url || !key) {
      throw new Error('E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_KEY are required');
    }
    const api = new TestApi(url, key, tenantId);
    await use(api);
  }
});

export { expect };
