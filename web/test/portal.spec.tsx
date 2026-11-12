import { renderToStaticMarkup } from 'react-dom/server';
import { CustomersTable, OrdersTable } from '../app/tables';
import { landingPage, money, validMonth, type Order } from '../lib/portal';

const customer = { id: 'customer-1', name: 'Avery Morgan', email: 'customer@example.test' };
const order: Order = {
  id: 'order-1', customerId: customer.id, item: 'Desk organizer', amountCents: 2450,
  status: 'open', orderDate: '2026-01-08',
};

test('S01 sends customers to the order dashboard', () => {
  expect(landingPage('customer')).toBe('/dashboard');
});

test('S06 sends administrators to their workspace', () => {
  expect(landingPage('admin')).toBe('/admin');
});

test('S02 renders the customer order, date, status and formatted price', () => {
  const html = renderToStaticMarkup(<OrdersTable orders={[order]} />);
  for (const value of ['Desk organizer', '2026-01-08', 'open', '$24.50']) {
    expect(html).toContain(value);
  }
  expect(html).not.toContain('customer-1');
});

test('S02 renders the empty orders message', () => {
  expect(renderToStaticMarkup(<OrdersTable orders={[]} />)).toContain('No orders to show.');
});

test('S05 renders a customer name in the admin order table', () => {
  const html = renderToStaticMarkup(<OrdersTable orders={[order]} customers={[customer]} />);
  expect(html).toContain('Avery Morgan');
});

test('S05 formats integer cents as USD', () => {
  expect(money(123456)).toBe('$1,234.56');
});

test('S04 renders the customer name and email in the admin list', () => {
  const html = renderToStaticMarkup(<CustomersTable customers={[customer]} />);
  expect(html).toContain('Avery Morgan');
  expect(html).toContain('customer@example.test');
});

test('S04 renders the empty customer list message', () => {
  expect(renderToStaticMarkup(<CustomersTable customers={[]} />)).toContain('No customers to show.');
});

test('S03 accepts the first and last calendar months for downloads', () => {
  expect(validMonth('2026-01')).toBe(true);
  expect(validMonth('2026-12')).toBe(true);
});

test.each(['0000-01', '2026-00', '2026-13', '2026-1'])('S07 rejects download month %s', (month) => {
  expect(validMonth(month)).toBe(false);
});
