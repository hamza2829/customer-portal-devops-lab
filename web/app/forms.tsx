'use client';

import { useActionState } from 'react';
import { addCustomer, addOrder, signIn } from './actions';
import type { Customer } from '../lib/portal';

export function LoginForm() {
  const [message, action, pending] = useActionState(signIn, '');
  return (
    <form action={action}>
      <label>Email<input type="email" name="email" autoComplete="username" required /></label>
      <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
      {message && <p role="alert">{message}</p>}
      <button disabled={pending}>Sign in</button>
    </form>
  );
}

export function CustomerForm() {
  const [message, action, pending] = useActionState(addCustomer, '');
  return (
    <form action={action}>
      <label>Name<input name="name" required maxLength={100} /></label>
      <label>Email<input name="email" type="email" required maxLength={254} /></label>
      <button disabled={pending}>Create customer</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}

export function OrderForm({ customers }: { customers: Customer[] }) {
  const [message, action, pending] = useActionState(addOrder, '');
  return (
    <form action={action}>
      <label>Customer
        <select name="customerId" required defaultValue="">
          <option value="" disabled>Select a customer</option>
          {customers.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label>Item<input name="item" required maxLength={120} /></label>
      <label>Amount in cents<input name="amountCents" type="number" required min={1} max={100000000} /></label>
      <label>Order date<input name="orderDate" type="date" required /></label>
      <button disabled={pending || customers.length === 0}>Create order</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
