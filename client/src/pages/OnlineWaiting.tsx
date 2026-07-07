import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface OnlineWaitingProps {
  inviteCode: string;
  onCancel: () => void;
}

// Unlike the mockup's generateQr() (a decorative noise pattern explicitly labeled "demo"),
// this is a real, scannable QR code encoding the actual invite link (spec §4.3.1).
export function OnlineWaiting({ inviteCode, onCancel }: OnlineWaitingProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const inviteLink = `${window.location.origin}${window.location.pathname}?join=${inviteCode}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(inviteLink, { margin: 1, width: 200 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // Not fatal — the room code text still works to join without a QR image.
      });
    return () => {
      cancelled = true;
    };
  }, [inviteLink]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(inviteLink).catch(() => {});
    setCopyState('copied');
    setTimeout(() => setCopyState('idle'), 1800);
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '28px 20px 20px',
        gap: '20px',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '4px solid var(--border)',
          borderTopColor: 'var(--accent)',
          animation: 'xo-spin 0.9s linear infinite',
        }}
      />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '17px' }}>
          Waiting for opponent…
        </div>
        <div style={{ fontSize: '13px', color: 'var(--fg-muted)', marginTop: '4px' }}>
          Share the code or QR below to invite someone
        </div>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '300px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--fg-muted)',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            Room Code
          </div>
          <div
            data-testid="invite-code"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '26px',
              letterSpacing: '2px',
              marginTop: '4px',
            }}
          >
            {inviteCode}
          </div>
        </div>

        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt={`QR code for the invite link (also shown as text: ${inviteCode})`}
            width={160}
            height={160}
            style={{ borderRadius: '12px' }}
          />
        )}

        <button
          type="button"
          onClick={handleCopy}
          style={{
            width: '100%',
            background: 'var(--surface-raised)',
            color: 'var(--fg)',
            border: '1px solid var(--border-strong)',
            borderRadius: '12px',
            padding: '12px',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          {copyState === 'copied' ? 'Copied!' : 'Copy Invite Link'}
        </button>
      </div>

      <div style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onCancel}
        style={{
          width: '100%',
          maxWidth: '300px',
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
        Cancel
      </button>
    </div>
  );
}
