import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule, configure } from '../src/app';
import { DEMO_CUSTOMER_ID } from '../src/auth';
import { PortalService } from '../src/portal';

const otherCustomer = '22222222-2222-4222-8222-222222222222';
const missing = '00000000-0000-4000-8000-000000000000';
const demoOrder = '33333333-3333-4333-8333-333333333333';
const password = 'portal-demo-2026';
let app: INestApplication;
let admin: string;
let customer: string;

const get = (path: string, token = admin) => request(app.getHttpServer()).get('/api' + path)
  .set('Authorization', `Bearer ${token}`);
const post = (path: string, token = admin) => request(app.getHttpServer()).post('/api' + path)
  .set('Authorization', `Bearer ${token}`);
const patch = (path: string, token = admin) => request(app.getHttpServer()).patch('/api' + path)
  .set('Authorization', `Bearer ${token}`);
const remove = (path: string) => request(app.getHttpServer()).delete('/api' + path)
  .set('Authorization', `Bearer ${admin}`);
const order = {
  customerId: otherCustomer, item: 'Synthetic pen', amountCents: 700, orderDate: '2026-01-31',
};
const login = (email: string, secret = password) => request(app.getHttpServer()).post('/api/auth/login')
  .send({ email, password: secret });

beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  configure(app);
  await app.init();
  await app.get(PortalService).seed();
  admin = (await login('admin@example.test').expect(200)).body.accessToken;
  customer = (await login('customer@example.test').expect(200)).body.accessToken;
}, 50000);

afterAll(async () => {
  await app?.close();
});

test('S01 verifies an authenticated customer profile', async () => {
  const response = await get('/auth/me', customer).expect(200);
  expect(response.body).toMatchObject({ customerId: DEMO_CUSTOMER_ID, role: 'customer' });
});

test('S01 refuses invalid credentials', async () => {
  await login('customer@example.test', 'wrong').expect(401);
});

test('S01 requires a token for the profile', async () => {
  await request(app.getHttpServer()).get('/api/auth/me').expect(401);
});

test('S01 rejects an invalid token', async () => {
  await get('/auth/me', 'invalid').expect(401);
});

test('S02 lists only open orders for the current customer', async () => {
  const foreign = await post('/orders').send(order).expect(201);
  try {
    const { body } = await get('/orders?status=open', customer).expect(200);
    expect(body).toEqual([expect.objectContaining({ id: demoOrder, status: 'open' })]);
  } finally {
    await remove(`/orders/${foreign.body.id}`).expect(204);
  }
});

test('S02 returns a customer-owned order by ID', async () => {
  const { body } = await get(`/orders/${demoOrder}`, customer).expect(200);
  expect(body.customerId).toBe(DEMO_CUSTOMER_ID);
});

test('S02 hides an order belonging to another customer', async () => {
  const { body } = await post('/orders').send(order).expect(201);
  try {
    await get(`/orders/${body.id}`, customer).expect(404);
  } finally {
    await remove(`/orders/${body.id}`).expect(204);
  }
});

test('S03 refuses reports for another customer', async () => {
  await get(`/customers/${otherCustomer}/report?month=2026-01`, customer).expect(404);
});

test('S03 reports a missing customer to an administrator', async () => {
  await get(`/customers/${missing}/report?month=2026-01`).expect(404);
});

test('S03 sends only the requested month and customer rows to the report service', async () => {
  const foreign = await post('/orders').send(order).expect(201);
  const later = await post('/orders').send({ ...order, customerId: DEMO_CUSTOMER_ID, orderDate: '2026-02-01' }).expect(201);
  const lastDay = await post('/orders').send({ ...order, customerId: DEMO_CUSTOMER_ID }).expect(201);
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{"orderCount":3}'));
  try {
    const { body } = await get(`/customers/${DEMO_CUSTOMER_ID}/report?month=2026-01`, customer).expect(200);
    expect(body).toEqual({ orderCount: 3 });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining(`/reports/${DEMO_CUSTOMER_ID}/2026-01?format=json`),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer lab-report-token' }) }));
    const payload = JSON.parse(String(spy.mock.calls[0][1]?.body));
    expect(payload.orders).toHaveLength(3);
    expect(payload.orders).toEqual(expect.arrayContaining([
      { amountCents: 2450, status: 'open' }, { amountCents: 1800, status: 'shipped' },
      { amountCents: 700, status: 'open' },
    ]));
  } finally {
    spy.mockRestore();
    for (const response of [foreign, later, lastDay]) await remove(`/orders/${response.body.id}`).expect(204);
  }
});

test('S03 returns a CSV attachment from the report service', async () => {
  const spy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('orderCount\r\n2\r\n'));
  try {
    const response = await get(`/customers/${DEMO_CUSTOMER_ID}/report?month=2026-01&format=csv`, customer)
      .expect('Content-Type', /text\/csv/).expect('Content-Disposition', /orders-2026-01.csv/).expect(200);
    expect(response.text).toBe('orderCount\r\n2\r\n');
  } finally {
    spy.mockRestore();
  }
});

test('S03 returns a gateway error when the report service is unavailable', async () => {
  const spy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('connection refused'));
  try {
    await get(`/customers/${DEMO_CUSTOMER_ID}/report?month=2026-01`, customer).expect(502);
  } finally {
    spy.mockRestore();
  }
});

test('S04 persists customer create, read, update and delete operations', async () => {
  const email = 'integration@example.test';
  const { body } = await post('/customers').send({ name: 'Synthetic customer', email }).expect(201);
  const path = `/customers/${body.id}`;
  expect((await get(path).expect(200)).body.email).toBe(email);
  await patch(path).send({ name: 'Renamed customer' }).expect(200);
  const list = await get('/customers').expect(200);
  expect(list.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: body.id, name: 'Renamed customer' })]));
  await remove(path).expect(204);
  await get(path).expect(404);
});

test('S04 rejects duplicate email addresses', async () => {
  await post('/customers').send({ name: 'Duplicate', email: 'CUSTOMER@example.test' }).expect(409);
});

test('S05 persists order create, read, update and delete operations', async () => {
  const { body } = await post('/orders').send(order).expect(201);
  expect(body.status).toBe('open');
  const path = `/orders/${body.id}`;
  await patch(path).send({ status: 'shipped' }).expect(200);
  expect((await get(path).expect(200)).body.status).toBe('shipped');
  await remove(path).expect(204);
  await get(path).expect(404);
});

test('S05 rejects an order assigned to a missing customer', async () => {
  await post('/orders').send({ ...order, customerId: missing }).expect(404);
});

test('S04 removes the deleted customer’s orders', async () => {
  const { body: row } = await post('/customers').send({ name: 'Cascade', email: 'cascade@example.test' }).expect(201);
  const { body: linkedOrder } = await post('/orders').send({ ...order, customerId: row.id }).expect(201);
  await remove(`/customers/${row.id}`).expect(204);
  await get(`/orders/${linkedOrder.id}`).expect(404);
});

test('S06 refuses a customer access to the admin customer list', async () => {
  await get('/customers', customer).expect(403);
});

test('S06 refuses a customer creating an order', async () => {
  await post('/orders', customer).send(order).expect(403);
});

test('S06 refuses a customer changing even their own order', async () => {
  await patch(`/orders/${demoOrder}`, customer).send({ status: 'cancelled' }).expect(403);
});

test('S07 refuses unknown request fields', async () => {
  await post('/orders').send({ ...order, notes: 'unexpected' }).expect(400);
});

test('S07 rejects malformed UUIDs', async () => {
  await get('/orders/malformed').expect(400);
});

test('S07 rejects invalid status filters', async () => {
  await get('/orders?status=sent').expect(400);
});

test('S07 rejects unsupported report formats', async () => {
  await get(`/customers/${DEMO_CUSTOMER_ID}/report?month=2026-01&format=pdf`, customer).expect(400);
});

test('S08 reports health over HTTP with PostgreSQL connected', async () => {
  const { body } = await request(app.getHttpServer()).get('/api/health').expect(200);
  expect(body).toEqual({ status: 'ok' });
});

test('S08 publishes the OpenAPI paths and bearer scheme', async () => {
  const { body } = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
  expect(body.paths['/api/orders'].post).toBeDefined();
  expect(body.paths['/api/customers/{id}/report'].get).toBeDefined();
  expect(body.components.securitySchemes.bearer.scheme).toBe('bearer');
});
