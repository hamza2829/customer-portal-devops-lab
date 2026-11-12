import { api } from '../../lib/api';
import { validMonth, type User } from '../../lib/portal';

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get('month') ?? '';
  if (!validMonth(month)) return new Response('Choose a valid month.', { status: 400 });
  const me = await api('/auth/me');
  if (!me.ok) return new Response('Could not verify session.', { status: me.status });
  const user: User = await me.json();
  if (user.role !== 'customer') return new Response('Customer account required.', { status: 403 });
  const response = await api(`/customers/${user.customerId}/report?month=${month}&format=csv`);
  if (!response.ok) return new Response('Could not download report.', { status: response.status });
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
