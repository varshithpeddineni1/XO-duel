import { useEffect, useRef, useState } from 'react';
import { createGame, submitMove, type Difficulty, type GameState } from './api/games.js';
import { Difficulty as DifficultyPage } from './pages/Difficulty.js';
import { GameScreen } from './pages/GameScreen.js';
import { Home } from './pages/Home.js';
import { OnlineWaiting } from './pages/OnlineWaiting.js';
import { Result } from './pages/Result.js';
import { resolveInitialTheme, toggleTheme, THEME_STORAGE_KEY, type Theme } from './theme/index.js';
import { useOnlineGame } from './hooks/useOnlineGame.js';

type Screen = 'home' | 'difficulty' | 'online-waiting' | 'board' | 'result';
type Mode = 'local' | 'ai' | 'online';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function inviteCodeFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('join');
}

function clearJoinParam(): void {
  if (window.location.search) {
    window.history.replaceState(null, '', window.location.pathname);
  }
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
  const [onlineInviteCode, setOnlineInviteCode] = useState<string | null>(null);
  const scoredOnlineGameId = useRef<number | null>(null);

  const onlineGame = useOnlineGame(onlineInviteCode ?? '');

  // A shared invite link (?join=CODE) skips Home entirely and jumps straight into joining.
  useEffect(() => {
    const joinCode = inviteCodeFromUrl();
    if (joinCode) {
      setMode('online');
      setOnlineInviteCode(joinCode);
    }
  }, []);

  // Drives screen transitions from the online game's live server-pushed status —
  // mirrors the 500ms "let the winning move render" pause the local/AI paths use below.
  useEffect(() => {
    const state = onlineGame.game;
    if (!onlineInviteCode || !state) return undefined;

    if (state.status === 'waiting') {
      setScreen('online-waiting');
      return undefined;
    }
    if (state.status === 'in_progress') {
      setScreen((s) => (s === 'result' ? s : 'board'));
      return undefined;
    }
    if (state.status === 'complete' && scoredOnlineGameId.current !== state.id) {
      scoredOnlineGameId.current = state.id;
      if (state.winner === 'X') setScoreX((s) => s + 1);
      else if (state.winner === 'O') setScoreO((s) => s + 1);
      else setScoreDraws((s) => s + 1);
      const timeout = setTimeout(() => setScreen('result'), 500);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [onlineGame.game, onlineInviteCode]);

  const handleToggleTheme = () => {
    setTheme((current) => {
      const next = toggleTheme(current);
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  };

  async function startGame(newMode: 'local' | 'ai', difficulty: Difficulty) {
    if (isBusy) return;
    setOnlineInviteCode(null);
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

  async function startOnlineGame() {
    if (isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const created = await createGame({ mode: 'online' });
      if (!created.inviteCode) throw new Error('online game has no invite code');
      setMode('online');
      setGame(null);
      setOnlineInviteCode(created.inviteCode);
    } catch {
      setError('Could not start an online game — please try again.');
    } finally {
      setIsBusy(false);
    }
  }

  const handleSelectAi = () => setScreen('difficulty');

  async function handleCellClick(cell: number) {
    if (mode === 'online') {
      onlineGame.submitMove(cell);
      return;
    }
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
    setOnlineInviteCode(null);
    clearJoinParam();
    setGame(null);
    setMode(null);
    setScreen('home');
  };

  const handleCancelOnlineWait = () => {
    setOnlineInviteCode(null);
    clearJoinParam();
    setMode(null);
    setScreen('home');
  };

  const handleRematch = () => {
    if (mode === 'online') {
      onlineGame.requestRematch();
      return;
    }
    if (mode) void startGame(mode, difficultySelected);
  };

  const activeGame = mode === 'online' ? onlineGame.game : game;
  const opponentLabel =
    mode === 'local'
      ? 'Local Match'
      : mode === 'online'
        ? 'Online Match'
        : `vs AI · ${capitalize(difficultySelected)}`;
  const scoreLeftLabel = mode === 'local' ? 'Player 1' : 'You';
  const scoreRightLabel = mode === 'local' ? 'Player 2' : mode === 'online' ? 'Opponent' : 'AI';

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
          onSelectOnline={() => void startOnlineGame()}
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

      {screen === 'online-waiting' && onlineInviteCode && (
        <OnlineWaiting inviteCode={onlineInviteCode} onCancel={handleCancelOnlineWait} />
      )}

      {screen === 'board' && activeGame && (
        <GameScreen
          game={activeGame}
          opponentLabel={opponentLabel}
          scoreLeftLabel={scoreLeftLabel}
          scoreRightLabel={scoreRightLabel}
          scoreLeftValue={scoreX}
          scoreDrawValue={scoreDraws}
          scoreRightValue={scoreO}
          onCellClick={(cell) => void handleCellClick(cell)}
          onQuit={handleQuit}
          role={mode === 'online' ? onlineGame.role : null}
          opponentDisconnected={mode === 'online' && onlineGame.opponentStatus === 'disconnected'}
        />
      )}

      {screen === 'result' && activeGame && mode && (
        <Result
          game={activeGame}
          scoreLeftLabel={scoreLeftLabel}
          scoreRightLabel={scoreRightLabel}
          scoreLeftValue={scoreX}
          scoreDrawValue={scoreDraws}
          scoreRightValue={scoreO}
          onRematch={handleRematch}
          onHome={handleQuit}
          role={mode === 'online' ? onlineGame.role : null}
          rematchState={mode === 'online' ? onlineGame.rematchState : 'idle'}
          onAcceptRematch={onlineGame.acceptRematch}
          onDeclineRematch={onlineGame.declineRematch}
        />
      )}
    </div>
  );
}
