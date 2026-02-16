export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body?.url || typeof body.url !== 'string') {
    setResponseStatus(event, 400);
    return { status: 'error', message: 'Missing required field: url' };
  }

  if (!body.url.startsWith('ws://') && !body.url.startsWith('wss://')) {
    setResponseStatus(event, 400);
    return { status: 'error', message: 'URL must start with ws:// or wss://' };
  }

  connectRemoteTap(body.url);

  return { status: 'ok' };
});
