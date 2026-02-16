import type { RemoteTapState, WebSocketMessage } from '@types';

export function useRemoteTap() {
  const state = useState<RemoteTapState>('remotetap-state', () => ({
    status: 'disconnected',
    url: null,
    error: null,
  }));
  const loading = useState<boolean>('remotetap-loading', () => false);

  const { data: wsData } = useWebSocket();

  // Watch for WebSocket remotetap_status messages
  watch(wsData, (newData) => {
    if (!newData || newData === 'pong') return;

    try {
      const message = JSON.parse(newData) as WebSocketMessage;
      if (message.type === 'remotetap_status') {
        state.value = message.data;
      }
    } catch {
      // ignore parse errors
    }
  });

  async function connect(url: string) {
    loading.value = true;
    try {
      await $fetch('/api/remotetap/connect', {
        method: 'POST',
        body: { url },
      });
    } catch (err: any) {
      console.error('[RemoteTap] Connect error:', err);
    } finally {
      loading.value = false;
    }
  }

  async function disconnect() {
    loading.value = true;
    try {
      await $fetch('/api/remotetap/disconnect', { method: 'POST' });
    } catch (err: any) {
      console.error('[RemoteTap] Disconnect error:', err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchStatus() {
    try {
      const result = await $fetch<RemoteTapState>('/api/remotetap/status');
      state.value = result;
    } catch (err: any) {
      console.error('[RemoteTap] Status fetch error:', err);
    }
  }

  return {
    state: readonly(state),
    loading: readonly(loading),
    connect,
    disconnect,
    fetchStatus,
  };
}
