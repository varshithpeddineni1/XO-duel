export type ResultVariant = 'win' | 'loss' | 'draw';

const VARIANT_STYLE: Record<ResultVariant, { color: string; softBg: string; letter: string }> = {
  win: { color: 'var(--success)', softBg: 'var(--success-soft)', letter: 'W' },
  loss: { color: 'var(--danger)', softBg: 'var(--danger-soft)', letter: 'L' },
  draw: { color: 'var(--warning)', softBg: 'var(--warning-soft)', letter: 'D' },
};

interface ResultBannerProps {
  variant: ResultVariant;
  title: string;
  subtitle: string;
}

export function ResultBanner({ variant, title, subtitle }: ResultBannerProps) {
  const { color, softBg, letter } = VARIANT_STYLE[variant];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '18px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '84px',
          height: '84px',
          borderRadius: '50%',
          background: softBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '34px', color }}
        >
          {letter}
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '26px' }}>
          {title}
        </div>
        <div style={{ fontSize: '13.5px', color: 'var(--fg-muted)', marginTop: '6px' }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}
