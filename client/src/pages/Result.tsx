import type { GameState } from '../api/games.js';
import { RematchButton } from '../components/RematchButton.js';
import { ResultBanner, type ResultVariant } from '../components/ResultBanner.js';
import { ScoreTile } from '../components/ScoreTile.js';

interface ResultProps {
  game: GameState;
  scoreLeftLabel: string;
  scoreRightLabel: string;
  scoreLeftValue: number;
  scoreDrawValue: number;
  scoreRightValue: number;
  onRematch: () => void;
  onHome: () => void;
}

function resultCopy(game: GameState): { variant: ResultVariant; title: string; subtitle: string } {
  if (game.winner === 'draw') {
    return { variant: 'draw', title: "It's a Draw", subtitle: 'Evenly matched — go again?' };
  }
  if (game.mode === 'local') {
    const winnerLabel = game.winner === 'X' ? 'Player 1' : 'Player 2';
    return { variant: 'win', title: `${winnerLabel} Wins!`, subtitle: 'Great game — run it back?' };
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
}: ResultProps) {
  const { variant, title, subtitle } = resultCopy(game);

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
        <RematchButton onClick={onRematch} />
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
