export async function createMockServer () {
  throw new Error('Mock-based testing is not implemeted yet.')
  console.debug('Setting up mock server.')
  const { WebSocketServer } = await import('ws');
  const { freePort } = await import('@hackbg/port');
  const port = await freePort();
  const mockServer = new WebSocketServer({ port })
  const sockets = new Set()
  mockServer.on('connection', ws => {
    console.debug('Mock server received connection')
    sockets.add(ws)
    ws.on('close', () => sockets.delete(ws))
    ws.on('error', () => sockets.delete(ws))
  })
  process.env.CHAINLINK_WS_URL = `ws://localhost:${port}`
  console.debug('Mock server listening on', process.env.CHAINLINK_WS_URL)
  return mockServer
}
