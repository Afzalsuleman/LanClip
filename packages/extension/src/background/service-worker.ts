// LANClip Background Service Worker
// Manages WebSocket connection to local service and clipboard sync

const LOCAL_SERVICE_URL = 'ws://localhost:8765';
const RECONNECT_DELAY_MS = 3000;

interface ServiceState {
  ws: WebSocket | null;
  isConnected: boolean;
  connectedPeers: string[];
  lastClipboard: string;
}

const state: ServiceState = {
  ws: null,
  isConnected: false,
  connectedPeers: [],
  lastClipboard: '',
};

// ─── WebSocket Connection ────────────────────────────────────────────────────

function connect() {
  try {
    const ws = new WebSocket(LOCAL_SERVICE_URL);

    ws.onopen = () => {
      console.log('[LANClip] Connected to local service');
      state.ws = ws;
      state.isConnected = true;
      broadcastStatus();

      // Ask for current state
      ws.send(JSON.stringify({ type: 'get_status' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch {
        console.error('[LANClip] Failed to parse message:', event.data);
      }
    };

    ws.onclose = () => {
      console.log('[LANClip] Disconnected from local service, retrying...');
      state.ws = null;
      state.isConnected = false;
      state.connectedPeers = [];
      broadcastStatus();
      setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = (err) => {
      console.error('[LANClip] WebSocket error:', err);
      ws.close();
    };
  } catch (err) {
    console.error('[LANClip] Failed to connect:', err);
    setTimeout(connect, RECONNECT_DELAY_MS);
  }
}

function handleMessage(msg: Record<string, unknown>) {
  switch (msg.type) {
    case 'clipboard.update': {
      const payload = msg.payload as { data: string; sourceDeviceId: string };
      if (payload?.data && payload.data !== state.lastClipboard) {
        state.lastClipboard = payload.data;
        // Notify popup
        chrome.runtime.sendMessage({
          type: 'clipboard.received',
          text: payload.data,
          from: payload.sourceDeviceId,
        }).catch(() => {/* popup may not be open */});
        // Show notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'LANClip',
          message: `Clipboard synced: "${payload.data.substring(0, 60)}${payload.data.length > 60 ? '...' : ''}"`,
          priority: 0,
        });
      }
      break;
    }
    case 'peer.connected': {
      const payload = msg.payload as { deviceName: string };
      if (payload?.deviceName && !state.connectedPeers.includes(payload.deviceName)) {
        state.connectedPeers.push(payload.deviceName);
        broadcastStatus();
      }
      break;
    }
    case 'peer.disconnected': {
      const payload = msg.payload as { deviceName: string };
      state.connectedPeers = state.connectedPeers.filter(p => p !== payload?.deviceName);
      broadcastStatus();
      break;
    }
    case 'status': {
      const payload = msg.payload as { peers?: string[] };
      state.connectedPeers = payload?.peers ?? [];
      broadcastStatus();
      break;
    }
  }
}

function broadcastStatus() {
  chrome.runtime.sendMessage({
    type: 'status',
    isConnected: state.isConnected,
    peers: state.connectedPeers,
  }).catch(() => {/* popup may not be open */});
}

// ─── Messages from Popup ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'get_status':
      sendResponse({
        isConnected: state.isConnected,
        peers: state.connectedPeers,
      });
      break;
    case 'send_clipboard':
      if (state.ws?.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({
          type: 'clipboard.update',
          payload: {
            id: `clip-${Date.now()}`,
            data: msg.text,
            contentType: 'text',
            timestamp: Date.now(),
            sourceDeviceId: 'extension',
          },
        }));
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: 'Not connected to local service' });
      }
      break;
  }
  return true; // Keep message channel open for async response
});

// ─── Startup ─────────────────────────────────────────────────────────────────

connect();
console.log('[LANClip] Background service worker started');
