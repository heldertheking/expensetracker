import { useEffect, useState } from 'react';
import { HealthSchema, type Health } from '@expensetracker/schema';

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => setHealth(HealthSchema.parse(data)))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Expense Tracker</h1>
      <section style={{ marginTop: '1rem' }}>
        <h3>API Connection Status:</h3>
        {health && (
          <p style={{ color: 'green' }}>
            Connected to API: <strong>{health.status}</strong> (Uptime: {Math.round(health.uptime)}
            s)
          </p>
        )}
        {error && <p style={{ color: 'red' }}>Failed to connect to API: {error}</p>}
        {!health && !error && <p>Checking API connection...</p>}
      </section>
    </main>
  );
}
