import Link from 'next/link';
import { read, userFor } from '../../lib/api';
import { type Order } from '../../lib/portal';
import { signOut } from '../actions';
import { OrdersTable } from '../tables';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await userFor('customer');
  const openOnly = (await searchParams).status === 'open';
  const orders = await read<Order[]>(openOnly ? '/orders?status=open' : '/orders');
  return (
    <main>
      <div className="page-heading">
        <div><h1>Your orders</h1><p>{user.sub}</p></div>
        <form action={signOut}><button className="secondary">Sign out</button></form>
      </div>
      <section className="panel">
        <nav className="filters" aria-label="Filter orders">
          <Link href="/dashboard" aria-current={openOnly ? undefined : 'page'}>All orders</Link>
          <Link href="/dashboard?status=open" aria-current={openOnly ? 'page' : undefined}>Open orders</Link>
        </nav>
        <OrdersTable orders={orders} />
      </section>
      <section className="panel report-panel">
        <h2>Monthly report</h2>
        <form action="/report">
          <label>Month<input type="month" name="month" defaultValue="2026-01" required /></label>
          <button>Download CSV</button>
        </form>
      </section>
    </main>
  );
}
