export const feedIds = [
  '0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439', // BTC/USD
  '0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782', // ETH/USD
];

export const config = () => ({
  apiUrl: process.env.CHAINLINK_API_URL,
  wsUrl: process.env.CHAINLINK_WS_URL,
  clientId: process.env.CHAINLINK_CLIENT_ID,
  clientSecret: process.env.CHAINLINK_CLIENT_SECRET,
  reconnect: {
    enabled: process.env.CHAINLINK_WS_RECONNECT_ENABLED || true,
    maxReconnectAttempts:
      process.env.CHAINLINK_WS_RECONNECT_MAX_ATTEMPTS || 3000,
    reconnectInterval: process.env.CHAINLINK_WS_RECONNECT_INTERVAL || 100,
  },
});
