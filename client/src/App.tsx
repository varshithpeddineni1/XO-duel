import { useEffect, useRef, useState } from 'react';
import { AdminApiError, adminLogin, adminLogout } from './api/admin.js';
import {
  AuthApiError,
  createOrResumeSession,
  getCurrentPlayer,
  login,
  logout,
  register,
  type PlayerState,
} from './api/auth.js';
import { acceptFriendInvite } from './api/friends.js';
import { createGame, submitMove, type Difficulty, type GameState } from './api/games.js';
import { BottomNav, type NavDestination } from './components/BottomNav.js';
import { Account } from './pages/Account.js';
import { AdminDashboard } from './pages/AdminDashboard.js';
import { AdminLogin } from './pages/AdminLogin.js';
import { Difficulty as DifficultyPage } from './pages/Difficulty.js';
import { Friends } from './pages/Friends.js';
import { GameScreen } from './pages/GameScreen.js';
import { History } from './pages/History.js';
import { Home } from './pages/Home.js';
import { Leaderboard } from './pages/Leaderboard.js';
import { Login, type AuthMode } from './pages/Login.js';
import { OnlineWaiting } from './pages/OnlineWaiting.js';
import { Result } from './pages/Result.js';
import { resolveInitialTheme, toggleTheme, THEME_STORAGE_KEY, type Theme } from './theme/index.js';
import { useOnlineGame } from './hooks/useOnlineGame.js';

type Screen =
  | 'home'
  | 'difficulty'
  | 'online-waiting'
  | 'board'
  | 'result'
  | 'account'
  | 'login'
  | 'history'
  | 'leaderboard'
  | 'friends'
  | 'admin-login'
  | 'admin-dashboard';
type Mode = 'local' | 'ai' | 'online';
const NAV_SCREENS: Screen[] = ['home', 'history', 'leaderboard', 'account'];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function inviteCodeFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('join');
}

function friendInviteCodeFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('friend');
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
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const friendInviteHandled = useRef(false);

  const onlineGame = useOnlineGame(onlineInviteCode ?? '');

  async function refreshPlayer() {
    const current = await getCurrentPlayer();
    setPlayer(current);
  }

  // Silently establishes (or resumes) a guest session on first load — no login required
  // for any mode (API-7). Failure here (e.g. the API is unreachable) isn't fatal: the app
  // still works, it just falls back to treating the current session as an unauthenticated
  // guest (player stays null) rather than leaving an unhandled rejection.
  useEffect(() => {
    void (async () => {
      try {
        await createOrResumeSession();
        await refreshPlayer();
      } catch {
        setPlayer(null);
      }
    })();
  }, []);

  // A shared invite link (?join=CODE) skips Home entirely and jumps straight into joining.
  useEffect(() => {
    const joinCode = inviteCodeFromUrl();
    if (joinCode) {
      setMode('online');
      setOnlineInviteCode(joinCode);
    }
  }, []);

  // A shared friend invite link (?friend=CODE) — only actionable once we know whether this
  // session is registered, so it waits on `player` rather than running on mount like the
  // game join-link effect above (which doesn't need an account to make sense).
  useEffect(() => {
    const friendCode = friendInviteCodeFromUrl();
    if (!friendCode || friendInviteHandled.current || player === null) return;
    friendInviteHandled.current = true;
    clearJoinParam();
    if (!player.isRegistered) {
      setError('Log in or create an account first, then open that invite link again.');
      return;
    }
    void acceptFriendInvite(friendCode)
      .then(() => setScreen('friends'))
      .catch(() => setError('That invite link is not valid.'));
  }, [player]);

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
      // Unconditional: a rematch produces a new game, also 'in_progress', while the screen
      // is still showing the *previous* game's result — it must transition to the board
      // regardless. There's no legitimate case where an 'in_progress' update should leave
      // the result screen showing (once a game is 'complete' server-side, every later
      // broadcast for that same id stays 'complete' — it never regresses).
      setScreen('board');
      return undefined;
    }
    if (state.status === 'complete' && scoredOnlineGameId.current !== state.id) {
      // The ref guard (not a cleanup-cancelled timeout) is what makes this idempotent: a
      // completed game is announced by both `move_made` and `game_over` in quick
      // succession, each producing a new `game` object and re-running this effect. If the
      // timeout were cancelled and rescheduled on that second run the way an effect
      // cleanup normally would, the guard below would already be true by then and no
      // timeout would ever fire — the result screen would never appear.
      scoredOnlineGameId.current = state.id;
      if (state.winner === 'X') setScoreX((s) => s + 1);
      else if (state.winner === 'O') setScoreO((s) => s + 1);
      else setScoreDraws((s) => s + 1);
      setTimeout(() => setScreen('result'), 500);
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

  const handleNavigate = (destination: NavDestination) => setScreen(destination);

  const handleGoLogin = () => {
    setAuthMode('login');
    setAuthError(null);
    setScreen('login');
  };

  const handleGoRegister = () => {
    setAuthMode('register');
    setAuthError(null);
    setScreen('login');
  };

  async function handleAuthSubmit(username: string, password: string) {
    setAuthError(null);
    try {
      if (authMode === 'register') {
        await register(username, password);
      } else {
        await login(username, password);
      }
      await refreshPlayer();
      setScreen('account');
    } catch (err) {
      setAuthError(err instanceof AuthApiError ? err.message : 'Something went wrong.');
    }
  }

  async function handleLogout() {
    try {
      await logout();
      await createOrResumeSession(); // a guest session resumes immediately (API-7)
      await refreshPlayer();
    } catch {
      setError('Could not log out — please try again.');
    }
  }

  async function handleAdminSubmit(username: string, password: string) {
    setAdminError(null);
    try {
      await adminLogin(username, password);
      setScreen('admin-dashboard');
    } catch (err) {
      setAdminError(err instanceof AdminApiError ? err.message : 'Something went wrong.');
    }
  }

  async function handleAdminLogout() {
    await adminLogout();
    setScreen('account');
  }

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
        // dvh (not vh) tracks the browser's actual visible viewport as chrome (address bar,
        // etc.) shows/hides — vh is fixed to the largest possible viewport, so on mobile the
        // shell renders taller than what's currently visible and the bottom nav sits below
        // the fold until the page is scrolled and the chrome collapses.
        height: '100dvh',
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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

        {screen === 'account' && (
          <Account
            theme={theme}
            onToggleTheme={handleToggleTheme}
            player={player}
            onGoLogin={handleGoLogin}
            onGoRegister={handleGoRegister}
            onLogout={() => void handleLogout()}
            onGoAdmin={() => {
              setAdminError(null);
              setScreen('admin-login');
            }}
          />
        )}

        {screen === 'login' && (
          <Login
            mode={authMode}
            error={authError}
            onToggleMode={() => setAuthMode((m) => (m === 'login' ? 'register' : 'login'))}
            onSubmit={(username, password) => void handleAuthSubmit(username, password)}
            onContinueAsGuest={() => setScreen('account')}
            onBack={() => setScreen('account')}
          />
        )}

        {screen === 'history' && <History theme={theme} onToggleTheme={handleToggleTheme} />}

        {screen === 'leaderboard' && (
          <Leaderboard
            theme={theme}
            onToggleTheme={handleToggleTheme}
            myPlayerId={player?.id ?? null}
            onManageFriends={() => setScreen('friends')}
          />
        )}

        {screen === 'friends' && (
          <Friends
            myInviteCode={player?.inviteCode ?? null}
            onBack={() => setScreen('leaderboard')}
          />
        )}

        {screen === 'admin-login' && (
          <AdminLogin
            error={adminError}
            onSubmit={(username, password) => void handleAdminSubmit(username, password)}
            onBack={() => setScreen('account')}
          />
        )}

        {screen === 'admin-dashboard' && (
          <AdminDashboard
            onBack={() => setScreen('account')}
            onLogout={() => void handleAdminLogout()}
          />
        )}
      </div>

      {NAV_SCREENS.includes(screen) && (
        <BottomNav active={screen as NavDestination} onNavigate={handleNavigate} />
      )}
    </div>
  );
}
