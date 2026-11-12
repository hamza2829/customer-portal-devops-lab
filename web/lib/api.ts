import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { landingPage, type Role, type User } from './portal';

export const SESSION_COOKIE = 'portal_session';

export async function api(path: string, options: RequestInit = {}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${process.env.API_URL ?? 'http://127.0.0.1:3001'}/api${path}`, {
    ...options,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
}

export async function userFor(role: Role): Promise<User> {
  const response = await api('/auth/me');
  if (response.status === 401) redirect('/');
  if (!response.ok) throw new Error('Could not verify session');
  const user: User = await response.json();
  if (user.role !== role) redirect(landingPage(user.role));
  return user;
}

export async function read<T>(path: string): Promise<T> {
  const response = await api(path);
  if (!response.ok) throw new Error('Could not load portal data');
  return response.json();
}
