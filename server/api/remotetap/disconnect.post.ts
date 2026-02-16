export default defineEventHandler(() => {
  disconnectRemoteTap();
  return { status: 'ok' };
});
