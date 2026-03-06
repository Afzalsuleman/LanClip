import React, { useState, useCallback } from 'react';

interface SetupWizardProps {
  onComplete?: () => void;
}

type Step = 1 | 2 | 3;

// ─── Styles ──────────────────────────────────────────────────────────────────

const stepDot = (active: boolean, done: boolean): React.CSSProperties => ({
  width: active ? 28 : 22,
  height: active ? 28 : 22,
  borderRadius: '50%',
  backgroundColor: done ? '#22c55e' : active ? '#7c3aed' : '#27272a',
  color: done || active ? '#fff' : '#71717a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 700,
  transition: 'all 0.2s',
  flexShrink: 0,
});

const s: Record<string, React.CSSProperties> = {
  container: {
    width: 360,
    minHeight: 420,
    backgroundColor: '#0f0f11',
    color: '#e2e2e5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 14,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '16px 16px 12px',
    borderBottom: '1px solid #1e1e24',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    fontWeight: 700,
    fontSize: 18,
    color: '#a78bfa',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  body: {
    padding: '20px 20px 16px',
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  stepLine: {
    width: 36,
    height: 2,
    backgroundColor: '#27272a',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e2e2e5',
    textAlign: 'center' as const,
  },
  stepDesc: {
    fontSize: 13,
    color: '#71717a',
    textAlign: 'center' as const,
    lineHeight: 1.6,
  },
  codeBlock: {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 8,
    padding: '10px 12px',
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#a78bfa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    cursor: 'pointer',
  },
  copyBtn: {
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 5,
    border: '1px solid #3f3f46',
    backgroundColor: 'transparent',
    color: '#a1a1aa',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  keyInput: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid #27272a',
    backgroundColor: '#18181b',
    color: '#e2e2e5',
    fontFamily: 'monospace',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  note: {
    fontSize: 12,
    color: '#52525b',
    textAlign: 'center' as const,
    lineHeight: 1.5,
  },
  waiting: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 13,
    color: '#71717a',
    padding: '8px 0',
  },
  footer: {
    padding: '0 20px 20px',
    display: 'flex',
    gap: 8,
  },
  btnPrimary: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#7c3aed',
    color: '#fff',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #27272a',
    backgroundColor: 'transparent',
    color: '#a1a1aa',
    fontWeight: 500,
    fontSize: 13,
    cursor: 'pointer',
  },
  successBox: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 8,
    padding: '16px 0',
  },
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={s.codeBlock} onClick={copy}>
      <span>{text}</span>
      <button style={s.copyBtn}>{copied ? '✅ Copied!' : '📋 Copy'}</button>
    </div>
  );
}

// ─── Step Content ─────────────────────────────────────────────────────────────

function Step1() {
  return (
    <>
      <div style={s.stepTitle}>Install LANClip Service</div>
      <div style={s.stepDesc}>
        Run this command in your terminal to install the LANClip background service globally:
      </div>
      <CopyBlock text="npm install -g lanclip" />
      <div style={s.note}>
        Requires Node.js 18+.{' '}
        <a
          href="https://nodejs.org"
          target="_blank"
          rel="noreferrer"
          style={{ color: '#a78bfa' }}
        >
          Download Node.js
        </a>
      </div>
    </>
  );
}

function Step2({ roomKey, setRoomKey }: { roomKey: string; setRoomKey: (k: string) => void }) {
  const command = roomKey.length >= 6 ? `lanclip set-key ${roomKey}` : 'lanclip set-key <your-key>';
  return (
    <>
      <div style={s.stepTitle}>Set Encryption Key</div>
      <div style={s.stepDesc}>
        Choose a secret room code. Both devices must use the <strong style={{ color: '#e2e2e5' }}>same key</strong> to sync clipboard data securely.
      </div>
      <input
        style={s.keyInput}
        type="text"
        placeholder="e.g. my-secret-room-code"
        value={roomKey}
        onChange={(e) => setRoomKey(e.target.value)}
        autoFocus
      />
      {roomKey.length >= 6 && (
        <>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: -8 }}>Now run this in terminal:</div>
          <CopyBlock text={command} />
        </>
      )}
      {roomKey.length > 0 && roomKey.length < 6 && (
        <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center' }}>Key must be at least 6 characters</div>
      )}
      <div style={s.note}>
        ⚠️ Use the same key on all devices. Without a key, clipboard data is sent unencrypted.
      </div>
    </>
  );
}

function Step3({ isConnected }: { isConnected: boolean }) {
  return (
    <>
      <div style={s.stepTitle}>Start the Service</div>
      <div style={s.stepDesc}>
        Run this command to start LANClip. The extension will connect automatically.
      </div>
      <CopyBlock text="lanclip start" />
      <div style={s.waiting}>
        {isConnected ? (
          <span style={{ color: '#22c55e' }}>✅ Service detected!</span>
        ) : (
          <>
            <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
            <span>Waiting for service to start...</span>
          </>
        )}
      </div>
      <div style={s.note}>
        Keep this terminal window open. The extension connects automatically once the service starts.
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [roomKey, setRoomKey] = useState('');
  const [isConnected] = useState(false);

  const saveKey = useCallback(() => {
    if (roomKey.length >= 6) {
      chrome.storage.local.set({ encryptionKey: roomKey });
    }
    setStep(3);
  }, [roomKey]);

  const canNext =
    step === 1 ||
    (step === 2 && (roomKey.length === 0 || roomKey.length >= 6));

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>
          <span>📋</span>
          <span>LANClip</span>
        </div>
        <span style={{ color: '#52525b', fontSize: 12, marginLeft: 'auto' }}>Setup</span>
      </div>

      {/* Step indicator */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={s.stepIndicator}>
          <div style={stepDot(step === 1, step > 1)}>
            {step > 1 ? '✓' : '1'}
          </div>
          <div style={s.stepLine} />
          <div style={stepDot(step === 2, step > 2)}>
            {step > 2 ? '✓' : '2'}
          </div>
          <div style={s.stepLine} />
          <div style={stepDot(step === 3, isConnected)}>
            {isConnected ? '✓' : '3'}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={s.body}>
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 roomKey={roomKey} setRoomKey={setRoomKey} />}
        {step === 3 && <Step3 isConnected={isConnected} />}
      </div>

      {/* Footer nav */}
      <div style={s.footer}>
        {step > 1 && (
          <button
            style={s.btnSecondary}
            onClick={() => setStep((s) => (s - 1) as Step)}
          >
            ← Back
          </button>
        )}
        {step === 1 && (
          <button style={s.btnPrimary} onClick={() => setStep(2)}>
            Next →
          </button>
        )}
        {step === 2 && (
          <button
            style={{
              ...s.btnPrimary,
              opacity: canNext ? 1 : 0.5,
              cursor: canNext ? 'pointer' : 'not-allowed',
            }}
            onClick={saveKey}
            disabled={!canNext}
          >
            {roomKey.length >= 6 ? 'Save Key & Continue →' : 'Skip (no encryption) →'}
          </button>
        )}
        {step === 3 && !isConnected && (
          <button style={{ ...s.btnSecondary, flex: 1 }} onClick={onComplete}>
            I'll set up later
          </button>
        )}
      </div>
    </div>
  );
}
