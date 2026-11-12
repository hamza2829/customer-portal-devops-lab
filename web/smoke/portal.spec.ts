import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const customerId = '11111111-1111-4111-8111-111111111111';
const password = 'portal-demo-2026';
const apiBase = process.env.PORTAL_API_URL ?? '';

async function login(request: APIRequestContext, role: 'admin' | 'customer') {
  const response = await request.post(`${apiBase}/api/auth/login`, {
    data: { email: `${role}@example.test`, password },
  });
  expect(response.status()).toBe(200);
  const session = await response.json();
  expect(session.role).toBe(role);
  return { Authorization: `Bearer ${session.accessToken}` };
}

async function signIn(page: Page, role: 'admin' | 'customer') {
  await page.goto('/');
  await page.getByLabel('Email').fill(`${role}@example.test`);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('S01 signs a customer in through the web page', async ({ page }) => {
  await signIn(page, 'customer');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
  const cookie = (await page.context().cookies()).find(({ name }) => name === 'portal_session');
  expect(cookie?.httpOnly).toBe(true);
});

test('S01 signs out and redirects from the dashboard', async ({ page }) => {
  await signIn(page, 'customer');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect((await page.context().cookies()).some(({ name }) => name === 'portal_session')).toBe(false);

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('S02 filters open orders in the customer dashboard', async ({ page }) => {
  await signIn(page, 'customer');
  await expect(page.getByText('Notebook set')).toBeVisible();
  await page.getByRole('link', { name: 'Open orders' }).click();
  await expect(page.getByText('Desk organizer')).toBeVisible();
  await expect(page.getByText('Notebook set')).toHaveCount(0);
});

test('S03 downloads the January report from the dashboard', async ({ page }) => {
  await signIn(page, 'customer');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('orders-2026-01.csv');
  const path = await download.path();
  expect(await readFile(path, 'utf8')).toContain(`${customerId},2026-01,2,1,1,0,4250`);
});

test('S03 returns the monthly JSON summary through the API and report service', async ({ request }) => {
  const headers = await login(request, 'customer');
  const response = await request.get(`${apiBase}/api/customers/${customerId}/report?month=2026-01`, { headers });
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ customerId, orderCount: 2, totalAmountCents: 4250 });
});

test('S04 creates a customer from the admin page', async ({ page, request }) => {
  await signIn(page, 'admin');
  const email = `smoke-${randomUUID()}@example.test`;
  const form = page.getByRole('heading', { name: 'New customer' }).locator('..');
  await form.getByLabel('Name').fill('Smoke test customer');
  await form.getByLabel('Email').fill(email);
  await form.getByRole('button', { name: 'Create customer' }).click();
  await expect(page.getByRole('cell', { name: email })).toBeVisible();

  const headers = await login(request, 'admin');
  const response = await request.get(`${apiBase}/api/customers`, { headers });
  const row = (await response.json() as { id: string; email: string }[]).find((entry) => entry.email === email);
  expect(row).toBeDefined();
  expect((await request.delete(`${apiBase}/api/customers/${row?.id}`, { headers })).status()).toBe(204);
});

test('S05 creates and reads an order in the deployed API', async ({ request }) => {
  const headers = await login(request, 'admin');
  const response = await request.post(`${apiBase}/api/orders`, {
    headers,
    data: { customerId, item: 'Smoke test order', amountCents: 4200, orderDate: '2026-02-01' },
  });
  expect(response.status()).toBe(201);
  const order = await response.json();
  const path = `${apiBase}/api/orders/${order.id}`;
  try {
    const read = await request.get(path, { headers });
    expect(read.status()).toBe(200);
    expect(await read.json()).toMatchObject({ customerId, amountCents: 4200, status: 'open' });
  } finally {
    expect((await request.delete(path, { headers })).status()).toBe(204);
  }
});

test('S06 redirects a customer away from the admin page', async ({ page }) => {
  await signIn(page, 'customer');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('S06 rejects admin operations made with a customer token', async ({ request }) => {
  const headers = await login(request, 'customer');
  expect((await request.get(`${apiBase}/api/customers`, { headers })).status()).toBe(403);
});

test('S07 rejects an invalid order in the deployed API', async ({ request }) => {
  const headers = await login(request, 'admin');
  const response = await request.post(`${apiBase}/api/orders`, {
    headers, data: { customerId, item: 'Invalid order', amountCents: -1, orderDate: '2026-02-01' },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).message).toEqual(expect.arrayContaining([expect.stringContaining('amountCents')]));
});

test('S08 serves API health and OpenAPI through ingress', async ({ request }) => {
  const health = await request.get(`${apiBase}/api/health`);
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: 'ok' });
  const spec = await request.get(`${apiBase}/api/docs-json`);
  expect(spec.status()).toBe(200);
  expect((await spec.json()).paths['/api/auth/login']).toHaveProperty('post');
});

test('S08 serves frontend health through ingress', async ({ request }) => {
  const response = await request.get('/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});
