interface ScoreTileProps {
  label: string;
  value: number;
  color: string;
}

export function ScoreTile({ label, value, color }: ScoreTileProps) {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', color }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--fg-muted)', marginTop: '2px' }}>{label}</div>
    </div>
  );
}
