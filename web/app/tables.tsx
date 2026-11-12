import { money, type Customer, type Order } from '../lib/portal';

export function OrdersTable({ orders, customers }: { orders: Order[]; customers?: Customer[] }) {
  if (!orders.length) return <p className="empty">No orders to show.</p>;
  const names = new Map(customers?.map(({ id, name }) => [id, name]));
  return (
    <div className="table-scroll">
      <table>
        <thead><tr><th scope="col">Item</th>{customers && <th scope="col">Customer</th>}
          <th scope="col">Date</th><th scope="col">Status</th><th scope="col">Amount</th></tr></thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <th scope="row">{order.item}</th>
              {customers && <td>{names.get(order.customerId) ?? order.customerId}</td>}
              <td>{order.orderDate}</td>
              <td><span className={`status ${order.status}`}>{order.status}</span></td>
              <td>{money(order.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CustomersTable({ customers }: { customers: Customer[] }) {
  if (!customers.length) return <p className="empty">No customers to show.</p>;
  return (
    <div className="table-scroll">
      <table>
        <thead><tr><th scope="col">Name</th><th scope="col">Email</th></tr></thead>
        <tbody>{customers.map(({ id, name, email }) => (
          <tr key={id}><th scope="row">{name}</th><td>{email}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
