import { useEffect, useState } from 'react';
import {
  FriendsApiError,
  listFriends,
  listPendingRequests,
  respondToFriendRequest,
  searchPlayers,
  sendFriendRequest,
  type FriendSummary,
  type PendingRequest,
} from '../api/friends.js';
import { BackButton } from '../components/BackButton.js';

interface FriendsProps {
  myInviteCode: string | null;
  onBack: () => void;
}

function sectionTitleStyle(): React.CSSProperties {
  return { fontSize: '13px', fontWeight: 700, color: 'var(--fg-muted)', marginBottom: '8px' };
}

function rowStyle(): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
  };
}

function smallButtonStyle(kind: 'accent' | 'muted'): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    border: kind === 'muted' ? '1px solid var(--border)' : 'none',
    background: kind === 'accent' ? 'var(--accent)' : 'transparent',
    color: kind === 'accent' ? 'var(--accent-fg)' : 'var(--fg-muted)',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  };
}

export function Friends({ myInviteCode, onBack }: FriendsProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendSummary[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState('Copy Invite Link');

  async function refreshLists() {
    const [friendsList, pendingList] = await Promise.all([listFriends(), listPendingRequests()]);
    setFriends(friendsList);
    setPending(pendingList);
  }

  useEffect(() => {
    void refreshLists();
  }, []);

  async function handleSearch() {
    setMessage(null);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    try {
      setResults(await searchPlayers(query.trim()));
    } catch {
      setMessage('Search failed — please try again.');
    }
  }

  async function handleAdd(username: string) {
    setMessage(null);
    try {
      await sendFriendRequest(username);
      setMessage(`Friend request sent to ${username}.`);
      await refreshLists();
    } catch (err) {
      setMessage(err instanceof FriendsApiError ? err.message : 'Something went wrong.');
    }
  }

  async function handleRespond(requestId: number, accept: boolean) {
    await respondToFriendRequest(requestId, accept);
    await refreshLists();
  }

  const inviteLink = myInviteCode
    ? `${window.location.origin}${window.location.pathname}?friend=${myInviteCode}`
    : null;

  async function handleCopyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy Invite Link'), 2000);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px' }}>
        <BackButton onClick={onBack} />
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px' }}>
          Friends
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {inviteLink && (
          <div>
            <div style={sectionTitleStyle()}>Your Invite Link</div>
            <div style={rowStyle()}>
              <div
                style={{
                  flex: 1,
                  fontSize: '13px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {inviteLink}
              </div>
              <button onClick={() => void handleCopyLink()} style={smallButtonStyle('accent')}>
                {copyLabel}
              </button>
            </div>
          </div>
        )}

        <div>
          <div style={sectionTitleStyle()}>Add a Friend</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSearch();
              }}
              placeholder="Search by username"
              style={{
                flex: 1,
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                fontSize: '14px',
                color: 'var(--fg)',
                outline: 'none',
              }}
            />
            <button onClick={() => void handleSearch()} style={smallButtonStyle('accent')}>
              Search
            </button>
          </div>
          {message && (
            <div style={{ fontSize: '13px', color: 'var(--fg-muted)', marginTop: '8px' }}>
              {message}
            </div>
          )}
          {results.length > 0 && (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}
            >
              {results.map((r) => (
                <div key={r.playerId} style={rowStyle()}>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: '14px' }}>{r.displayName}</div>
                  {/* Search only ever returns registered players, so displayName here is
                      always their real username — the identifier sendFriendRequest needs. */}
                  <button
                    onClick={() => void handleAdd(r.displayName)}
                    style={smallButtonStyle('accent')}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {pending.length > 0 && (
          <div>
            <div style={sectionTitleStyle()}>Requests</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pending.map((r) => (
                <div key={r.requestId} style={rowStyle()}>
                  <div style={{ flex: 1, fontWeight: 700, fontSize: '14px' }}>{r.displayName}</div>
                  {r.direction === 'incoming' ? (
                    <>
                      <button
                        onClick={() => void handleRespond(r.requestId, true)}
                        style={smallButtonStyle('accent')}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => void handleRespond(r.requestId, false)}
                        style={smallButtonStyle('muted')}
                      >
                        Decline
                      </button>
                    </>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>Pending</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div style={sectionTitleStyle()}>Friends ({friends.length})</div>
          {friends.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>
              No friends yet — search above or share your invite link.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {friends.map((f) => (
              <div key={f.playerId} style={rowStyle()}>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{f.displayName}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
