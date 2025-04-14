import ChainlinkDataStreamsConsumer, { Report } from './index.js';
import assert from 'node:assert';
import 'dotenv/config';

const DEBUG = false;

let config
let mockServer
before(async()=>{
  if (process.env.CHAINLINK_WS_MOCK_SERVER) {
    throw new Error('Mock-based testing is not implemeted yet.')
    console.debug('Setting up mock server.')
    const { WebSocketServer } = await import('ws');
    const { freePort } = await import('@hackbg/port');
    const port = await freePort();
    mockServer = new WebSocketServer({ port })
    const sockets = new Set()
    mockServer.on('connection', ws => {
      console.debug('Mock server received connection')
      sockets.add(ws)
      ws.on('close', () => sockets.delete(ws))
      ws.on('error', () => sockets.delete(ws))
    })
    process.env.CHAINLINK_WS_URL = `ws://localhost:${port}`
    console.debug('Mock server listening on', process.env.CHAINLINK_WS_URL)
  } else {
    console.debug('Using real server from .env config.')
  }
  config = () => ({
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
});
after(async()=>{
  if (process.env.CHAINLINK_WS_MOCK_SERVER) {
    console.debug('Tearing down mock server.');
    mockServer.close();
  }
});

const feedIds = [
  '0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439', // BTC/USD
  '0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782', // ETH/USD
];

describe('ChainlinkDataStreamsConsumer', function () {

  it('rejects deprecated config', function () {
    assert.throws(() => new ChainlinkDataStreamsConsumer({ clientID: 'x' }), {
      name: 'Error',
    });
    assert.throws(() => new ChainlinkDataStreamsConsumer({ hostname: 'x' }), {
      name: 'Error',
    });
    assert.throws(() => new ChainlinkDataStreamsConsumer({ wsHostname: 'x' }), {
      name: 'Error',
    });
  });

  it('initializes client correctly', function () {
    const clientConfig = {
      ...config(),
      feedIds,
    };

    console.log({clientConfig});
    // Assert that client init does not throw on correct config
    assert.doesNotThrow(() => {
      new ChainlinkDataStreamsConsumer(clientConfig);
    });
  });

  it('allows clientSecret to be updated', function () {
    const client = new ChainlinkDataStreamsConsumer(config());
    assert.equal(client.clientSecret, config().clientSecret);
    const newSecret = 'something';
    client.clientSecret = newSecret;
    assert.equal(client.clientSecret, newSecret);
  });

  it('should generate headers correctly', function () {
    const path = '/api/v1/ws';
    const search = new URLSearchParams({
      feedIDs: [...feedIds].join(','),
    }).toString();
    const method = 'GET';

    const headers = new ChainlinkDataStreamsConsumer(config()).generateHeaders(
      method,
      path,
      search,
    );

    // Check that the returned data is an object
    assert.strictEqual(
      typeof headers,
      'object',
      'Returned data is not an object',
    );

    // Check that all required keys are present
    assert.ok(headers.Authorization, 'Missing Authorization');
    assert.ok(
      headers['X-Authorization-Timestamp'],
      'Missing X-Authorization-Timestamp',
    );
    assert.ok(
      headers['X-Authorization-Signature-SHA256'],
      'Missing X-Authorization-Signature-SHA256',
    );

    // Validate the types of each key
    assert.strictEqual(
      typeof headers.Authorization,
      'string',
      'Authorization is not a string',
    );
    assert.strictEqual(
      typeof headers['X-Authorization-Timestamp'],
      'string',
      'X-Authorization-Timestamp is not a string',
    );
    assert.strictEqual(
      typeof headers['X-Authorization-Signature-SHA256'],
      'string',
      'X-Authorization-Signature-SHA256 is not a string',
    );
  });

  it('should throw if no client Id is provided on generate headers', function () {
    const path = '/api/v1/ws';
    const search = new URLSearchParams({
      feedIDs: [...feedIds].join(','),
    }).toString();
    const method = 'GET';

    const wrongClientConfigMissingClientId = {
      apiUrl: process.env.CHAINLINK_API_URL,
      wsUrl: process.env.CHAINLINK_WS_URL,
      clientSecret: process.env.CHAINLINK_CLIENT_SECRET,
      reconnect: {
        enabled: false,
      },
    };
    // Assert that client init throws an error when no client id is provided
    assert.throws(
      () => {
        new ChainlinkDataStreamsConsumer(
          wrongClientConfigMissingClientId,
        ).generateHeaders(method, path, search);
      },
      {
        name: 'Error',
      },
    );
  });

  it('should throw if no client secret is provided on generate headers', function () {
    const path = '/api/v1/ws';
    const search = new URLSearchParams({
      feedIDs: [...feedIds].join(','),
    }).toString();
    const method = 'GET';

    const wrongClientConfigMissingClientSecret = {
      apiUrl: process.env.CHAINLINK_API_URL,
      wsUrl: process.env.CHAINLINK_WS_URL,
      clientId: process.env.CHAINLINK_CLIENT_ID,
      reconnect: {
        enabled: false,
      },
    };
    // Assert that client init throws an error when no client secret is provided
    assert.throws(
      () => {
        new ChainlinkDataStreamsConsumer(
          wrongClientConfigMissingClientSecret,
        ).generateHeaders(method, path, search);
      },
      {
        name: 'Error',
      },
    );
  });

  it('should throw if wrong method parameter is provided on generateHeaders', function () {
    const path = 1230123;
    const search = new URLSearchParams({
      feedIDs: [...feedIds].join(','),
    }).toString();

    const wrongMethod = 'RANDOM';

    // Assert that generateHeaders throws an error when provided with invalid method parameter type
    assert.throws(
      () => {
        new ChainlinkDataStreamsConsumer(config()).generateHeaders(
          wrongMethod,
          path,
          search,
        );
      },
      {
        name: 'Error',
        message: /Invalid HTTP method provided/,
      },
    );
  });

  it('should throw if wrong path parameter is provided on generateHeaders', function () {
    const path = 1230123;
    const search = new URLSearchParams({
      feedIDs: [...feedIds].join(','),
    }).toString();
    const method = 'GET';

    // Assert that generateHeaders throws an error when provided with invalid path parameter type
    assert.throws(
      () => {
        new ChainlinkDataStreamsConsumer(config()).generateHeaders(
          method,
          path,
          search,
        );
      },
      {
        name: 'Error',
        message: /Invalid path provided/,
      },
    );
  });

  it('should throw if wrong timestamp is provided on generateHeaders', function () {
    const path = '/api/v1/ws';
    const search = new URLSearchParams({
      feedIDs: [...feedIds].join(','),
    }).toString();
    const method = 'GET';

    // Wrong timestamp (string instead of a valid number)
    const invalidTimestamp = 'WRONGTIMESTAMP';

    // Assert that generateHeaders throws an error when provided with invalid timestamp
    assert.throws(
      () => {
        new ChainlinkDataStreamsConsumer(config()).generateHeaders(
          method,
          path,
          search,
          invalidTimestamp,
        );
      },
      {
        name: 'Error',
        message: /Invalid timestamp/,
      },
    );
  });

  it('should throw if search is not a string on genarateHeaders', function () {
    const path = '/api/v1/ws';
    const method = 'GET';

    // Wrong search parameter type
    const search = 123;

    // Assert that generateHeaders throws an error when provided with invalid search parameter type
    assert.throws(
      () => {
        new ChainlinkDataStreamsConsumer(config()).generateHeaders(
          method,
          path,
          search,
        );
      },
      {
        name: 'Error',
        message: /Search parameter must be a string/,
      },
    );
  });

  it("can't fetch without apiUrl", function () {
    const client = new ChainlinkDataStreamsConsumer(config());
    delete client.apiUrl
    assert.rejects(()=>{client.fetch()})
  });

  it("can't subscribe to feeds without wsUrl", function () {
    assert.doesNotThrow(() => {
      new ChainlinkDataStreamsConsumer({...config(), wsUrl: null, feeds: []});
    });
    assert.throws(() => {
      new ChainlinkDataStreamsConsumer({...config(), wsUrl: null, feeds: ['0x0']});
    });
  });

  it("doesn't allow connectedFeeds to be mutated directly", function () {
    const client = new ChainlinkDataStreamsConsumer(config());
    assert.throws(() => client.feeds.add('0x0'));
    assert.throws(() => client.feeds.delete('0x0'));
    assert.throws(() => client.feeds.clear());
  });

  it("automatically disconnects when feeds are set to []", function () {
    const client = new ChainlinkDataStreamsConsumer({...config(), feeds: feedIds, lazy: true });
    assert.ok(client.feeds.size > 0);
    client.feeds = []
  });

  it('should fetch a report for a single feed and validate the instance', async function () {
    for (const feed of feedIds) {
      const report = await new ChainlinkDataStreamsConsumer(config()).fetchFeed({
        timestamp: Math.floor(Date.now() / 1000), // current timestamp in seconds
        feed,
      });
      assert(report instanceof Report);

      if (DEBUG) {
        console.log({ feed, report });
      }
    }
  });

  it('should fetch reports for multiple feeds and validate the type', async function () {
    const reports = await new ChainlinkDataStreamsConsumer(config()).fetchFeeds({
      timestamp: Math.floor(Date.now() / 1000), // current timestamp in seconds
      feeds: feedIds,
    });

    assert(typeof reports === 'object');

    if (DEBUG) {
      console.log({ feed, reports });
    }
  });

  it('should subscribe and unsubscribe to a feed and receive reports', function (done) {
    const SDK = new ChainlinkDataStreamsConsumer({
      ...config(),
      feeds: feedIds,
    });

    SDK.once('report', async (report1) => {
      console.log({ report1 });
      await SDK.unsubscribeFrom(report1.feedId);

      SDK.once('report', (report2) => {
        console.log({ report2 });
        SDK.disconnect();
      });
    });

    SDK.once('report', async (report3) => {
      console.log({ report3 });
      SDK.disconnect();
      done();
    });

    SDK.subscribeTo(feedIds[0]);
  });

  it('should throw an error when calling Report.fromSocketMessage with invalid data', function () {
    assert.throws(() => Report.fromSocketMessage({}), {
      name: 'Error',
    });
  });

  it('should throw an error when calling Report.fromAPIResponse with invalid data', function () {
    assert.throws(() => Report.fromAPIResponse({}), {
      name: 'Error',
    });
  });

  it('should throw an error when calling Report.fromBulkAPIResponse with invalid data', function () {
    assert.throws(() => Report.fromBulkAPIResponse({}), {
      name: 'Error',
    });
  });
});
