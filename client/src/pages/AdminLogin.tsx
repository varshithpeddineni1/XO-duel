import { useState } from 'react';
import { BackButton } from '../components/BackButton.js';

interface AdminLoginProps {
  error: string | null;
  onSubmit: (username: string, password: string) => void;
  onBack: () => void;
}

export function AdminLogin({ error, onSubmit, onBack }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px' }}>
        <BackButton onClick={onBack} />
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px' }}>
          Admin Dashboard
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '32px 28px',
          gap: '18px',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '20px',
          }}
        >
          ••
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px' }}>
            Admin Access
          </div>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--fg-muted)',
              marginTop: '6px',
              maxWidth: '260px',
            }}
          >
            Restricted to staff. Sign in to view the analytics dashboard.
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Admin ID"
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              fontSize: '15px',
              color: 'var(--fg)',
              fontFamily: 'var(--font-body)',
              outline: 'none',
            }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passcode"
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              fontSize: '15px',
              color: 'var(--fg)',
              fontFamily: 'var(--font-body)',
              outline: 'none',
            }}
          />
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button
          onClick={() => onSubmit(username, password)}
          style={{
            width: '100%',
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          Enter Dashboard
        </button>
      </div>
    </div>
  );
}
