import type { RemoteTapState, RemoteTapStatus } from '@types';
import WebSocket from 'ws';

let ws: WebSocket | null = null;
let shouldReconnect = false;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let currentUrl: string | null = null;
let currentStatus: RemoteTapStatus = 'disconnected';
let currentError: string | null = null;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_CAP_MS = 30000;

function setState(status: RemoteTapStatus, error: string | null = null) {
  currentStatus = status;
  currentError = error;
  broadcastRemoteTapStatus(getRemoteTapStatus());
}

function scheduleReconnect() {
  if (!shouldReconnect || !currentUrl) return;

  const delay = Math.min(
    RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts),
    RECONNECT_CAP_MS,
  );
  reconnectAttempts++;

  console.log(`[RemoteTap] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
  setState('connecting');

  reconnectTimeout = setTimeout(() => {
    if (shouldReconnect && currentUrl) {
      openWebSocket(currentUrl);
    }
  }, delay);
}

function openWebSocket(url: string) {
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[RemoteTap] Connected to', url);
    reconnectAttempts = 0;
    setState('connected');
  };

  ws.on('message', async (data: WebSocket.RawData) => {
    try {
      const payload = JSON.parse(data.toString());

      if (!payload.resourceLogs) return;

      const logIds = await processOTLPLogs(payload);

      for (const logId of logIds) {
        const logs = await getLogs(1);
        if (logs.length > 0) {
          broadcastLogUpdate({ log: logs[0] });
        }
      }
    } catch (err: any) {
      console.error('[RemoteTap] Error processing message:', err.message);
    }
  });

  ws.on('error', (err: Error) => {
    console.error('[RemoteTap] WebSocket error:', err.message);
    setState('error', err.message || 'Connection error');
  });

  ws.on('close', () => {
    console.log('[RemoteTap] Connection closed');
    ws = null;

    if (shouldReconnect) {
      scheduleReconnect();
    } else {
      setState('disconnected');
    }
  });
}

export function connectRemoteTap(url: string) {
  // Clean up any existing connection
  disconnectRemoteTap();

  currentUrl = url;
  shouldReconnect = true;
  reconnectAttempts = 0;
  setState('connecting');

  openWebSocket(url);
}

export function disconnectRemoteTap() {
  shouldReconnect = false;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (ws) {
    ws.removeAllListeners();
    ws.close();
    ws = null;
  }

  currentUrl = null;
  currentError = null;
  reconnectAttempts = 0;
  setState('disconnected');
}

export function getRemoteTapStatus(): RemoteTapState {
  return {
    status: currentStatus,
    url: currentUrl,
    error: currentError,
  };
}
