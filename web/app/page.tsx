import { LoginForm } from './forms';

export default function LoginPage() {
  return (
    <main className="login">
      <section className="panel">
        <h1>Sign in</h1>
        <LoginForm />
        <details>
          <summary>Demo credentials</summary>
          <p>Customer <code>customer@example.test</code></p>
          <p>Admin <code>admin@example.test</code></p>
          <p>Password <code>portal-demo-2026</code></p>
        </details>
      </section>
    </main>
  );
}
