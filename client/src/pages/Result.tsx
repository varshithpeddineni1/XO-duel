import type { GameState, Mark } from '../api/games.js';
import { RematchButton } from '../components/RematchButton.js';
import { ResultBanner, type ResultVariant } from '../components/ResultBanner.js';
import { ScoreTile } from '../components/ScoreTile.js';
import type { RematchState } from '../hooks/useOnlineGame.js';

interface ResultProps {
  game: GameState;
  scoreLeftLabel: string;
  scoreRightLabel: string;
  scoreLeftValue: number;
  scoreDrawValue: number;
  scoreRightValue: number;
  onRematch: () => void;
  onHome: () => void;
  /** Local player's mark in online mode; ignored for local/AI. */
  role?: Mark | null;
  /** Online mode only — local/AI rematch is a single immediate button (no handshake). */
  rematchState?: RematchState;
  onAcceptRematch?: () => void;
  onDeclineRematch?: () => void;
}

function resultCopy(
  game: GameState,
  role: Mark | null,
): { variant: ResultVariant; title: string; subtitle: string } {
  if (game.winner === 'draw') {
    return { variant: 'draw', title: "It's a Draw", subtitle: 'Evenly matched — go again?' };
  }
  if (game.mode === 'local') {
    const winnerLabel = game.winner === 'X' ? 'Player 1' : 'Player 2';
    return { variant: 'win', title: `${winnerLabel} Wins!`, subtitle: 'Great game — run it back?' };
  }
  if (game.mode === 'online') {
    const youWon = game.winner === role;
    return youWon
      ? { variant: 'win', title: 'You Win!', subtitle: 'Nice one. Ready for a rematch?' }
      : { variant: 'loss', title: 'You Lose', subtitle: "Don't sweat it — try again." };
  }
  const youWon = game.winner === 'X';
  return youWon
    ? { variant: 'win', title: 'You Win!', subtitle: 'Nice one. Ready for a rematch?' }
    : { variant: 'loss', title: 'AI Wins', subtitle: "Don't sweat it — try again." };
}

export function Result({
  game,
  scoreLeftLabel,
  scoreRightLabel,
  scoreLeftValue,
  scoreDrawValue,
  scoreRightValue,
  onRematch,
  onHome,
  role = null,
  rematchState = 'idle',
  onAcceptRematch,
  onDeclineRematch,
}: ResultProps) {
  const { variant, title, subtitle } = resultCopy(game, role);
  const isOnline = game.mode === 'online';

  return (
    <div
      style={{
        padding: '40px 24px 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '18px',
      }}
    >
      <ResultBanner variant={variant} title={title} subtitle={subtitle} />

      <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '300px' }}>
        <ScoreTile label={scoreLeftLabel} value={scoreLeftValue} color="var(--x-color)" />
        <ScoreTile label="Draws" value={scoreDrawValue} color="var(--warning)" />
        <ScoreTile label={scoreRightLabel} value={scoreRightValue} color="var(--o-color)" />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
          maxWidth: '300px',
          marginTop: '6px',
        }}
      >
        {isOnline ? (
          <OnlineRematchControls
            rematchState={rematchState}
            onRematch={onRematch}
            onAccept={onAcceptRematch}
            onDecline={onDeclineRematch}
          />
        ) : (
          <RematchButton onClick={onRematch} />
        )}
        <button
          type="button"
          onClick={onHome}
          style={{
            background: 'transparent',
            color: 'var(--fg-muted)',
            border: 'none',
            padding: '8px',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

interface OnlineRematchControlsProps {
  rematchState: RematchState;
  onRematch: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
}

// Mutual accept required (spec §4.3.6): requesting a rematch doesn't start a new board
// until the other player explicitly confirms.
function OnlineRematchControls({
  rematchState,
  onRematch,
  onAccept,
  onDecline,
}: OnlineRematchControlsProps) {
  if (rematchState === 'requested-by-opponent') {
    return (
      <>
        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--fg-muted)' }}>
          Your opponent wants a rematch
        </div>
        <RematchButton onClick={() => onAccept?.()} label="Accept Rematch" />
        <button
          type="button"
          onClick={() => onDecline?.()}
          style={{
            background: 'transparent',
            color: 'var(--fg-muted)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Decline
        </button>
      </>
    );
  }

  if (rematchState === 'requested-by-me') {
    return <RematchButton onClick={() => {}} label="Waiting for opponent to accept…" disabled />;
  }

  return <RematchButton onClick={onRematch} label="Request Rematch" />;
}
