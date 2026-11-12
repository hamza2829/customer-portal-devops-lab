import { read, userFor } from '../../lib/api';
import type { Customer, Order } from '../../lib/portal';
import { signOut } from '../actions';
import { CustomerForm, OrderForm } from '../forms';
import { CustomersTable, OrdersTable } from '../tables';

export default async function AdminPage() {
  await userFor('admin');
  const [customers, orders] = await Promise.all([read<Customer[]>('/customers'), read<Order[]>('/orders')]);
  return (
    <main>
      <div className="page-heading">
        <div><h1>Administration</h1><p>Customers and orders</p></div>
        <form action={signOut}><button className="secondary">Sign out</button></form>
      </div>
      <div className="admin-grid">
        <section className="panel"><h2>New customer</h2><CustomerForm /></section>
        <section className="panel"><h2>New order</h2><OrderForm customers={customers} /></section>
      </div>
      <section className="panel"><h2>Customers</h2><CustomersTable customers={customers} /></section>
      <section className="panel"><h2>Orders</h2><OrdersTable orders={orders} customers={customers} /></section>
    </main>
  );
}
