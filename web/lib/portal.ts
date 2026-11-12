export type Role = 'customer' | 'admin';

export type User =
  | { sub: string; role: 'admin' }
  | { sub: string; role: 'customer'; customerId: string };

export type Status = 'open' | 'shipped' | 'cancelled';

export type Order = {
  id: string;
  customerId: string;
  item: string;
  amountCents: number;
  status: Status;
  orderDate: string;
};

export type Customer = { id: string; name: string; email: string };

export function landingPage(role: Role) {
  return role === 'admin' ? '/admin' : '/dashboard';
}

export function validMonth(month: string) {
  return /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function money(cents: number) {
  return currency.format(cents / 100);
}
