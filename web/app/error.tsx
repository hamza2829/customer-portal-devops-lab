'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="login"><section className="panel">
      <h1>Portal unavailable</h1>
      <p>We could not load this page.</p>
      <button onClick={reset}>Try again</button>
    </section></main>
  );
}
