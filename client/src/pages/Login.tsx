import { useState } from 'react';

export type AuthMode = 'login' | 'register';

interface LoginProps {
  mode: AuthMode;
  error: string | null;
  onToggleMode: () => void;
  onSubmit: (username: string, password: string) => void;
  onContinueAsGuest: () => void;
  onBack: () => void;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '9px',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 700,
      }}
    >
      ‹
    </button>
  );
}

function fieldInputStyle(): React.CSSProperties {
  return {
    width: '100%',
    background: 'var(--surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
    fontSize: '15px',
    color: 'var(--fg)',
    fontFamily: 'var(--font-body)',
    outline: 'none',
  };
}

export function Login({
  mode,
  error,
  onToggleMode,
  onSubmit,
  onContinueAsGuest,
  onBack,
}: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);

  const isRegisterMode = mode === 'register';
  const usernameError =
    username.length > 0 && username.length < 3 ? 'Username must be at least 3 characters.' : null;
  const passwordError =
    password.length > 0 && password.length < 8 ? 'Password must be at least 8 characters.' : null;
  const confirmError =
    isRegisterMode && confirm.length > 0 && confirm !== password ? 'Passwords must match.' : null;

  const canSubmit =
    username.length >= 3 &&
    password.length >= 8 &&
    (!isRegisterMode || confirm === password) &&
    !usernameError &&
    !passwordError;

  function handleSubmit() {
    setTouched(true);
    if (!canSubmit) return;
    onSubmit(username, password);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px' }}>
        <BackButton onClick={onBack} />
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 28px 28px',
          gap: '22px',
        }}
      >
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
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
              fontSize: '22px',
            }}
          >
            <span style={{ color: 'var(--x-color)' }}>X</span>
            <span style={{ color: 'var(--o-color)' }}>O</span>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px' }}>
            {isRegisterMode ? 'Create your account' : 'Welcome back'}
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              style={fieldInputStyle()}
            />
            {touched && usernameError && (
              <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '5px' }}>
                {usernameError}
              </div>
            )}
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              style={fieldInputStyle()}
            />
            {touched && passwordError && (
              <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '5px' }}>
                {passwordError}
              </div>
            )}
          </div>
          {isRegisterMode && (
            <div>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password"
                style={fieldInputStyle()}
              />
              {touched && confirmError && (
                <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '5px' }}>
                  {confirmError}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
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
          {isRegisterMode ? 'Create Account' : 'Log In'}
        </button>

        <div
          onClick={onContinueAsGuest}
          style={{
            fontSize: '13px',
            color: 'var(--fg-muted)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Continue as Guest
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>
          {isRegisterMode ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span
            onClick={onToggleMode}
            style={{ color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}
          >
            {isRegisterMode ? 'Log In' : 'Create Account'}
          </span>
        </div>
      </div>
    </div>
  );
}
