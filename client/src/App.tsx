import { useEffect, useState } from 'react';
import { createGame, submitMove, type Difficulty, type GameState } from './api/games.js';
import { Difficulty as DifficultyPage } from './pages/Difficulty.js';
import { GameScreen } from './pages/GameScreen.js';
import { Home } from './pages/Home.js';
import { Result } from './pages/Result.js';
import { resolveInitialTheme, toggleTheme, THEME_STORAGE_KEY, type Theme } from './theme/index.js';

type Screen = 'home' | 'difficulty' | 'board' | 'result';
type Mode = 'local' | 'ai';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    resolveInitialTheme(
      localStorage.getItem(THEME_STORAGE_KEY),
      window.matchMedia('(prefers-color-scheme: dark)').matches,
    ),
  );
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<Mode | null>(null);
  const [difficultySelected, setDifficultySelected] = useState<Difficulty>('medium');
  const [game, setGame] = useState<GameState | null>(null);
  const [scoreX, setScoreX] = useState(0);
  const [scoreO, setScoreO] = useState(0);
  const [scoreDraws, setScoreDraws] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleTheme = () => {
    setTheme((current) => {
      const next = toggleTheme(current);
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  };

  async function startGame(newMode: Mode, difficulty: Difficulty) {
    if (isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const created =
        newMode === 'ai'
          ? await createGame({ mode: 'ai', aiDifficulty: difficulty })
          : await createGame({ mode: 'local' });
      setMode(newMode);
      setGame(created);
      setScreen('board');
    } catch {
      setError('Could not start the game — please try again.');
    } finally {
      setIsBusy(false);
    }
  }

  const handleSelectAi = () => setScreen('difficulty');

  async function handleCellClick(cell: number) {
    if (!game || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const updated = await submitMove(game.id, cell, game.currentPlayer);
      setGame(updated);
      if (updated.status === 'complete') {
        if (updated.winner === 'X') setScoreX((s) => s + 1);
        else if (updated.winner === 'O') setScoreO((s) => s + 1);
        else setScoreDraws((s) => s + 1);
        setTimeout(() => setScreen('result'), 500);
      }
    } catch {
      setError('That move was rejected — please try again.');
    } finally {
      setIsBusy(false);
    }
  }

  const handleQuit = () => {
    setGame(null);
    setScreen('home');
  };

  const opponentLabel =
    mode === 'local' ? 'Local Match' : `vs AI · ${capitalize(difficultySelected)}`;
  const scoreLeftLabel = mode === 'local' ? 'Player 1' : 'You';
  const scoreRightLabel = mode === 'local' ? 'Player 2' : 'AI';

  return (
    <div
      style={{
        height: '100vh',
        maxWidth: '480px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        color: 'var(--fg)',
      }}
    >
      {error && (
        <div
          role="alert"
          style={{
            padding: '10px 20px',
            background: 'var(--danger-soft)',
            color: 'var(--danger)',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {screen === 'home' && (
        <Home
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onSelectLocal={() => void startGame('local', difficultySelected)}
          onSelectAi={handleSelectAi}
        />
      )}

      {screen === 'difficulty' && (
        <DifficultyPage
          selected={difficultySelected}
          onSelect={setDifficultySelected}
          onStart={() => void startGame('ai', difficultySelected)}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'board' && game && (
        <GameScreen
          game={game}
          opponentLabel={opponentLabel}
          scoreLeftLabel={scoreLeftLabel}
          scoreRightLabel={scoreRightLabel}
          scoreLeftValue={scoreX}
          scoreDrawValue={scoreDraws}
          scoreRightValue={scoreO}
          onCellClick={(cell) => void handleCellClick(cell)}
          onQuit={handleQuit}
        />
      )}

      {screen === 'result' && game && mode && (
        <Result
          game={game}
          scoreLeftLabel={scoreLeftLabel}
          scoreRightLabel={scoreRightLabel}
          scoreLeftValue={scoreX}
          scoreDrawValue={scoreDraws}
          scoreRightValue={scoreO}
          onRematch={() => void startGame(mode, difficultySelected)}
          onHome={handleQuit}
        />
      )}
    </div>
  );
}
