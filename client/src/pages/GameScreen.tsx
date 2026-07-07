import type { GameState, Mark } from '../api/games.js';
import { Board } from '../components/Board.js';
import { ScoreTile } from '../components/ScoreTile.js';

interface GameScreenProps {
  game: GameState;
  opponentLabel: string;
  scoreLeftLabel: string;
  scoreRightLabel: string;
  scoreLeftValue: number;
  scoreDrawValue: number;
  scoreRightValue: number;
  onCellClick: (cell: number) => void;
  onQuit: () => void;
  opponentDisconnected?: boolean;
  /** Which mark the local player controls. Only meaningful (and required) for online mode. */
  role?: Mark | null;
}

export function GameScreen({
  game,
  opponentLabel,
  scoreLeftLabel,
  scoreRightLabel,
  scoreLeftValue,
  scoreDrawValue,
  scoreRightValue,
  onCellClick,
  onQuit,
  opponentDisconnected = false,
  role = null,
}: GameScreenProps) {
  const turnText = turnTextFor(game, role);
  const turnColor = game.currentPlayer === 'X' ? 'var(--x-color)' : 'var(--o-color)';
  const localPlayersTurn =
    game.mode === 'online' ? game.currentPlayer === role : game.currentPlayer === 'X';
  // Server is authoritative (ARC-5): the board is disabled whenever it isn't the local
  // player's turn to act, purely so the UI doesn't invite a click the server would reject
  // anyway (vs AI's turn, or an online opponent who's currently disconnected).
  const boardDisabled =
    game.status !== 'in_progress' ||
    opponentDisconnected ||
    (game.mode !== 'local' && !localPlayersTurn);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {opponentDisconnected && (
        <div
          role="status"
          style={{
            padding: '10px 20px',
            background: 'var(--warning-soft)',
            color: 'var(--warning)',
            fontSize: '13px',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          Opponent disconnected — waiting for them to reconnect…
        </div>
      )}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          onClick={onQuit}
          aria-label="Quit"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--fg-muted)',
          }}
        >
          ×
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>
            {opponentLabel}
          </div>
          <div style={{ fontSize: '12px', marginTop: '2px', color: turnColor, fontWeight: 600 }}>
            {turnText}
          </div>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 20px',
          gap: '24px',
        }}
      >
        <Board
          board={game.board}
          winLine={game.winLine}
          disabled={boardDisabled}
          onCellClick={onCellClick}
        />
        <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '300px' }}>
          <ScoreTile label={scoreLeftLabel} value={scoreLeftValue} color="var(--x-color)" />
          <ScoreTile label="Draws" value={scoreDrawValue} color="var(--warning)" />
          <ScoreTile label={scoreRightLabel} value={scoreRightValue} color="var(--o-color)" />
        </div>
      </div>
    </div>
  );
}

function turnTextFor(game: GameState, role: Mark | null): string {
  if (game.status !== 'in_progress') return '';
  if (game.mode === 'local') {
    return game.currentPlayer === 'X' ? "Player 1's turn · X" : "Player 2's turn · O";
  }
  if (game.mode === 'online') {
    return game.currentPlayer === role ? 'Your turn' : "Opponent's turn";
  }
  return game.currentPlayer === 'X' ? 'Your turn' : 'AI is thinking…';
}
