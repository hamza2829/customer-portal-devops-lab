import 'reflect-metadata';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { HealthController } from '../src/app';
import { AuthService, DEMO_CUSTOMER_ID } from '../src/auth';
import { CustomerDto, CustomerPatch, OrderDto, OrderFilter, OrderPatch, ReportQuery } from '../src/dto';
import { monthEnd } from '../src/portal';

const password = 'portal-demo-2026';

describe('Authentication', () => {
  const jwt = new JwtService({ secret: 'unit-only-signing-secret', signOptions: { expiresIn: '1h' } });
  const auth = new AuthService(jwt);

  test('S01 issues a JWT scoped to the seeded customer', async () => {
    const session = await auth.login({ email: 'customer@example.test', password });
    expect(session.role).toBe('customer');
    expect(jwt.verify(session.accessToken)).toMatchObject({
      sub: 'customer@example.test', role: 'customer', customerId: DEMO_CUSTOMER_ID,
    });
  });

  test('S01 signs an expiring admin session without a customer scope', async () => {
    const session = await auth.login({ email: 'ADMIN@example.test', password });
    const claims = jwt.verify(session.accessToken);
    expect(claims).toMatchObject({ role: 'admin', exp: expect.any(Number) });
    expect(claims.exp - claims.iat).toBe(3600);
    expect(claims).not.toHaveProperty('customerId');
  });

  test.each([
    ['wrong password', 'admin@example.test', 'wrong'],
    ['unknown account', 'other@example.test', password],
  ])('S01 rejects %s', async (_description, email, invalidPassword) => {
    await expect(auth.login({ email, password: invalidPassword })).rejects.toThrow(UnauthorizedException);
  });
});

test.each([
  ['2024-02', 29], ['2026-02', 28], ['2026-04', 30], ['2026-12', 31], ['0004-02', 29],
])('S03 finds the final calendar day of %s', (month, days) => {
  expect(monthEnd(month)).toBe(days);
});

test.each(['2026-00', '2026-13', '26-01', '0000-01'])('S07 rejects report month %s', async (month) => {
  expect(await validate(plainToInstance(ReportQuery, { month }))).toHaveLength(1);
});

test('S02 accepts an open-order filter', async () => {
  expect(await validate(plainToInstance(OrderFilter, { status: 'open' }))).toEqual([]);
});

test('S04 normalizes customer name and email', async () => {
  const input = plainToInstance(CustomerDto, { name: '  Avery  ', email: '  AVERY@example.test  ' });
  expect(await validate(input)).toEqual([]);
  expect(input).toMatchObject({ name: 'Avery', email: 'avery@example.test' });
});

test('S07 rejects an explicit null in a customer patch', async () => {
  expect(await validate(plainToInstance(CustomerPatch, { name: null }))).toHaveLength(1);
});

test('S07 rejects an explicit null in an order patch', async () => {
  expect(await validate(plainToInstance(OrderPatch, { status: null }))).toHaveLength(1);
});

test('S05 allows an order patch to omit untouched fields', async () => {
  expect(await validate(plainToInstance(OrderPatch, { status: 'shipped' }))).toEqual([]);
});

const order = { customerId: DEMO_CUSTOMER_ID, item: 'Paper', amountCents: 123, orderDate: '2024-02-29' };

test('S05 accepts a valid order without an explicit status', async () => {
  expect(await validate(plainToInstance(OrderDto, order))).toEqual([]);
});

test.each([
  ['fractional amount', { amountCents: 100.5 }],
  ['numeric text amount', { amountCents: '100' }],
  ['zero amount', { amountCents: 0 }],
  ['impossible date', { orderDate: '2026-02-29' }],
  ['timestamp instead of date', { orderDate: '2026-01-01T00:00:00Z' }],
  ['unknown status', { status: 'paused' }],
  ['blank item', { item: ' ' }],
])('S07 rejects an order with %s', async (_description, change) => {
  expect(await validate(plainToInstance(OrderDto, { ...order, ...change }))).toHaveLength(1);
});

test('S08 reports readiness after querying the database', async () => {
  const query = jest.fn().mockResolvedValue([{ ok: 1 }]);
  const controller = new HealthController({ query } as unknown as DataSource);
  await expect(controller.check()).resolves.toEqual({ status: 'ok' });
  expect(query).toHaveBeenCalledWith('SELECT 1');
});

test('S08 reports service unavailable when PostgreSQL is down', async () => {
  const query = jest.fn().mockRejectedValue(new Error('connection refused'));
  const controller = new HealthController({ query } as unknown as DataSource);
  await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
});
