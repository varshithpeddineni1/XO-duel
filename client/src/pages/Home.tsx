import { ModeButton } from '../components/ModeButton.js';
import { ThemeToggle } from '../components/ThemeToggle.js';
import type { Theme } from '../theme/index.js';

interface HomeProps {
  theme: Theme;
  onToggleTheme: () => void;
  onSelectLocal: () => void;
  onSelectAi: () => void;
  onSelectOnline: () => void;
}

// Home is the only screen with the logo header + theme toggle so far — history,
// leaderboard, and account (the mockup's other `showLogoHeader` screens) don't exist yet
// (Phase 4/5), so there's no BottomNav to switch between them either.
export function Home({
  theme,
  onToggleTheme,
  onSelectLocal,
  onSelectAi,
  onSelectOnline,
}: HomeProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '15px',
            }}
          >
            <span style={{ color: 'var(--x-color)' }}>X</span>
            <span style={{ color: 'var(--o-color)' }}>O</span>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px' }}>
            XO Duel
          </div>
        </div>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>

      <div
        style={{
          padding: '36px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '14px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '26px',
          }}
        >
          <span style={{ color: 'var(--x-color)' }}>X</span>
          <span style={{ color: 'var(--o-color)' }}>O</span>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '30px' }}>
            XO Duel
          </div>
          <div
            style={{
              fontSize: '15px',
              color: 'var(--fg-muted)',
              marginTop: '6px',
              maxWidth: '260px',
            }}
          >
            Challenge anyone. Anywhere. Anytime.
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '8px 20px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <ModeButton
          onClick={onSelectLocal}
          title="Local 2-Player"
          subtitle="Pass the phone, same device"
          icon={
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '7px',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'var(--x-soft)',
                  border: '2px solid var(--x-color)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '7px',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'var(--o-soft)',
                  border: '2px solid var(--o-color)',
                }}
              />
            </div>
          }
        />
        <ModeButton
          onClick={onSelectAi}
          title="vs AI"
          subtitle="Pick a difficulty and play solo"
          icon={
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '12px',
                background: 'var(--accent-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  border: '2px solid var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '2px',
                    background: 'var(--accent)',
                  }}
                />
              </div>
            </div>
          }
        />
        <ModeButton
          onClick={onSelectOnline}
          title="Online Multiplayer"
          subtitle="Invite a friend by link or QR code"
          icon={
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'var(--o-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: '2px solid var(--o-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'var(--o-color)',
                  }}
                />
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
