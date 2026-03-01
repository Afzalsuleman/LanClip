import React, { useEffect, useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClipboardEntry {
  id: string;
  text: string;
  from: string;
  timestamp: number;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 360,
    minHeight: 400,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0f0f11',
    color: '#e2e2e5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 14,
  },
  header: {
    padding: '16px 16px 12px',
    borderBottom: '1px solid #1e1e24',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f0f11',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 700,
    fontSize: 18,
    color: '#a78bfa',
  },
  statusDot: (connected: boolean): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: connected ? '#22c55e' : '#ef4444',
    boxShadow: connected ? '0 0 6px #22c55e80' : '0 0 6px #ef444480',
  }),
  statusBadge: (connected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: connected ? '#22c55e' : '#ef4444',
    padding: '4px 8px',
    borderRadius: 12,
    backgroundColor: connected ? '#22c55e15' : '#ef444415',
  }),
  section: {
    padding: '12px 16px',
    borderBottom: '1px solid #1e1e24',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: '#71717a',
    marginBottom: 8,
  },
  peerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  peerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 8,
    backgroundColor: '#1a1a22',
    fontSize: 13,
  },
  peerIcon: {
    fontSize: 16,
  },
  emptyState: {
    color: '#52525b',
    fontSize: 13,
    fontStyle: 'italic' as const,
    padding: '4px 0',
  },
  clipboardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 200,
    overflowY: 'auto' as const,
  },
  clipEntry: {
    padding: '8px 10px',
    borderRadius: 8,
    backgroundColor: '#1a1a22',
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'border-color 0.15s',
  },
  clipText: {
    fontSize: 13,
    color: '#d4d4d8',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  clipMeta: {
    fontSize: 11,
    color: '#52525b',
    marginTop: 2,
    display: 'flex',
    justifyContent: 'space-between',
  },
  footer: {
    padding: '12px 16px',
    marginTop: 'auto' as const,
  },
  button: {
    width: '100%',
    padding: '9px 16px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#7c3aed',
    color: '#fff',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  toastBar: (visible: boolean): React.CSSProperties => ({
    position: 'fixed' as const,
    bottom: 56,
    left: 16,
    right: 16,
    padding: '8px 12px',
    borderRadius: 8,
    backgroundColor: '#22c55e',
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
    textAlign: 'center' as const,
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.3s',
    pointerEvents: 'none' as const,
  }),
  noServiceBox: {
    margin: 16,
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#1a1a22',
    border: '1px solid #ef444430',
    textAlign: 'center' as const,
    color: '#71717a',
    fontSize: 13,
    lineHeight: 1.6,
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState<string[]>([]);
  const [history, setHistory] = useState<ClipboardEntry[]>([]);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  }, []);

  // Fetch initial status
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
      if (response) {
        setIsConnected(response.isConnected);
        setPeers(response.peers ?? []);
      }
    });
  }, []);

  // Listen for live updates from background
  useEffect(() => {
    const handler = (msg: Record<string, unknown>) => {
      if (msg.type === 'status') {
        setIsConnected(msg.isConnected as boolean);
        setPeers((msg.peers as string[]) ?? []);
      }
      if (msg.type === 'clipboard.received') {
        setHistory((prev) => [
          {
            id: `h-${Date.now()}`,
            text: msg.text as string,
            from: (msg.from as string) ?? 'peer',
            timestamp: Date.now(),
          },
          ...prev.slice(0, 19), // keep last 20
        ]);
        showToast('📋 Clipboard synced!');
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [showToast]);

  // Copy entry back to clipboard on click
  const copyEntry = useCallback(async (entry: ClipboardEntry) => {
    await navigator.clipboard.writeText(entry.text);
    showToast('✅ Copied!');
  }, [showToast]);

  // Sync current clipboard to peers
  const syncClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { showToast('⚠️ Clipboard is empty'); return; }
      chrome.runtime.sendMessage({ type: 'send_clipboard', text }, (res) => {
        if (res?.ok) showToast('📤 Sent to peers!');
        else showToast('❌ ' + (res?.error ?? 'Failed'));
      });
    } catch {
      showToast('❌ Cannot read clipboard');
    }
  }, [showToast]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <span>📋</span>
          <span>LANClip</span>
        </div>
        <div style={styles.statusBadge(isConnected)}>
          <div style={styles.statusDot(isConnected)} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Not connected to local service */}
      {!isConnected && (
        <div style={styles.noServiceBox}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔌</div>
          <strong style={{ color: '#e2e2e5' }}>Local service not running</strong>
          <p style={{ marginTop: 6 }}>
            Start the LANClip service to enable sync:
          </p>
          <code style={{ display: 'block', marginTop: 8, color: '#a78bfa', fontSize: 12 }}>
            pnpm dev:service
          </code>
        </div>
      )}

      {isConnected && (
        <>
          {/* Connected Peers */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Connected Devices ({peers.length})</div>
            <div style={styles.peerList}>
              {peers.length === 0 ? (
                <div style={styles.emptyState}>No peers found yet…</div>
              ) : (
                peers.map((peer) => (
                  <div key={peer} style={styles.peerItem}>
                    <span style={styles.peerIcon}>💻</span>
                    <span>{peer}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Clipboard History */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Received Clipboard ({history.length})</div>
            <div style={styles.clipboardList}>
              {history.length === 0 ? (
                <div style={styles.emptyState}>Nothing synced yet…</div>
              ) : (
                history.map((entry) => (
                  <div
                    key={entry.id}
                    style={styles.clipEntry}
                    onClick={() => copyEntry(entry)}
                    title="Click to copy"
                  >
                    <div style={styles.clipText}>{entry.text}</div>
                    <div style={styles.clipMeta}>
                      <span>from {entry.from.split('-')[1] ?? entry.from}</span>
                      <span>{formatTime(entry.timestamp)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={styles.footer}>
        <button
          style={styles.button}
          onClick={syncClipboard}
          disabled={!isConnected}
        >
          📤 Sync Clipboard to Peers
        </button>
      </div>

      {/* Toast */}
      <div style={styles.toastBar(toastVisible)}>{toast}</div>
    </div>
  );
}
