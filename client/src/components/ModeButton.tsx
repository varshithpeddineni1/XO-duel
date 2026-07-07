import type { ReactNode } from 'react';

interface ModeButtonProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}

export function ModeButton({ icon, title, subtitle, onClick }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <div style={{ width: '44px', height: '44px', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px' }}>
          {title}
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--fg-muted)', marginTop: '2px' }}>
          {subtitle}
        </div>
      </div>
      <div style={{ fontSize: '20px', color: 'var(--fg-faint)', fontWeight: 700 }}>›</div>
    </button>
  );
}
