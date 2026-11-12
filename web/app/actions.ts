'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api, SESSION_COOKIE, userFor } from '../lib/api';
import { landingPage, type Role } from '../lib/portal';

export async function signIn(_previous: string, form: FormData) {
  let response: Response;
  try {
    response = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    });
  } catch {
    return 'The portal is temporarily unavailable.';
  }
  if (!response.ok) {
    return response.status < 500 ? 'Check your email and password.' : 'The portal is temporarily unavailable.';
  }
  const { accessToken, role }: { accessToken: string; role: Role } = await response.json();
  const requestHeaders = await headers();
  (await cookies()).set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: requestHeaders.get('x-forwarded-proto') === 'https',
    maxAge: 3600,
    path: '/',
  });
  redirect(landingPage(role));
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/');
}

async function create(path: string, input: Record<string, FormDataEntryValue | number | null>) {
  await userFor('admin');
  const response = await api(path, { method: 'POST', body: JSON.stringify(input) }).catch(() => null);
  if (!response) return 'The portal is temporarily unavailable.';
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    return Array.isArray(result.message) ? result.message.join('. ') : result.message ?? 'Could not save.';
  }
  revalidatePath('/admin');
  return 'Saved.';
}

export async function addCustomer(_previous: string, form: FormData) {
  return create('/customers', { name: form.get('name'), email: form.get('email') });
}

export async function addOrder(_previous: string, form: FormData) {
  return create('/orders', {
    customerId: form.get('customerId'),
    item: form.get('item'),
    amountCents: Number(form.get('amountCents')),
    orderDate: form.get('orderDate'),
  });
}
