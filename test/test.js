import { Consumer, Error, Report } from '../index.js';
import { config, feedIds } from './config.js';
import { createMockServer } from './mock.js';
import assert from 'node:assert';
import 'dotenv/config';
import { WebSocket as _WebSocket } from 'ws';
const WebSocket = _WebSocket || globalThis.WebSocket;

process.on('unhandledRejection', (reason, promise) => { throw reason });

const DEBUG = false;

let mockServer

before(async()=>{
  if (process.env.CHAINLINK_WS_MOCK_SERVER) {
    mockServer = createMockServer();
  } else {
    console.debug('Using real server from .env config.')
  }
});

after(async()=>{
  if (process.env.CHAINLINK_WS_MOCK_SERVER) {
    console.debug('Tearing down mock server.');
    mockServer.close();
  }
});

describe('entrypoint', function () {

  it('inits correctly', function () {
    assert.doesNotThrow(() => new Consumer({ ...config(), feedIds, }));
  });

  it('rejects deprecated config', function () {
    assert.throws(() => new Consumer({ clientID: 'x' }), Error.Config.DeprecatedConsumerId);
    assert.throws(() => new Consumer({ hostname: 'x' }), Error.Config.DeprecatedHostname);
    assert.throws(() => new Consumer({ wsHostname: 'x' }), Error.Config.DeprecatedWsHostname);
  });

});

describe('authentication', function () {

  it('allows clientSecret to be updated', function () {
    const client = new Consumer(config());
    assert.equal(client.clientSecret, config().clientSecret);
    const newSecret = 'something';
    client.clientSecret = newSecret;
    assert.equal(client.clientSecret, newSecret);
  });

  it('generates headers correctly', function () {
    const path = '/api/v1/ws';
    const search = new URLSearchParams({ feedIDs: [...feedIds].join(',') }).toString();
    const headers = new Consumer(config()).generateHeaders('GET', path, search);
    // Check that the returned data is an object
    assert.strictEqual(typeof headers, 'object',
      'Returned data is not an object');
    // Check that all required keys are present and of the right types
    assert.ok(headers.Authorization,
      'Missing authorization');
    assert.strictEqual(typeof headers.Authorization, 'string',
      'Authorization is not a string');
    assert.ok(headers['X-Authorization-Timestamp'],
      'Missing timestamp');
    assert.strictEqual(typeof headers['X-Authorization-Timestamp'], 'string',
      'Timestamp is not a string');
    assert.ok(headers['X-Authorization-Signature-SHA256'],
      'Missing signature');
    assert.strictEqual(typeof headers['X-Authorization-Signature-SHA256'], 'string',
      'Signature is not a string');
  });

  it('does not generate headers without client id', function () {
    const search = new URLSearchParams({ feedIDs: [...feedIds].join(','), })
    assert.throws(
      () => new Consumer({...config(), clientId: null})
        .generateHeaders('GET', '/api/v1/ws', search),
      err => err instanceof Error.Auth.NoClientId
    );
  });

  it('does not generate headers without client secret', function () {
    const search = new URLSearchParams({ feedIDs: [...feedIds].join(','), })
    assert.throws(
      () => new Consumer({...config(), clientSecret: undefined})
        .generateHeaders('GET', '/api/v1/ws', search),
      err => err instanceof Error.Auth.NoClientSecret
    );
  });

  it('does not generate headers for wrong method', function () {
    const search = new URLSearchParams({ feedIDs: [...feedIds].join(','), })
    assert.throws(
      () => new Consumer(config()).generateHeaders('RANDOM', '/api/v1/ws', search),
      err => err instanceof Error.Auth.InvalidHttpMethod
    );
  });

  it('does not generate headers for invalid path', function () {
    const search = new URLSearchParams({ feedIDs: [...feedIds].join(','), })
    assert.throws(
      () => new Consumer(config()).generateHeaders('GET', 1230123, search),
      err => err instanceof Error.Auth.InvalidUrlPath,
    );
  });

  it('does not generate headers for wrong  search query params', function () {
    assert.throws(
      () => new Consumer(config()).generateHeaders('GET', '/api/v1/ws', 123),
      err => err instanceof Error.Auth.InvalidSearch,
    );
  });

  it('does not generate headers for invalid timestamp', function () {
    const search = new URLSearchParams({ feedIDs: [...feedIds].join(','), })
    assert.throws(
      () => new Consumer(config()).generateHeaders('GET', '/api/v1/ws', search, 'WRONGTIMESTAMP'),
      err => err instanceof Error.Auth.InvalidTimestamp,
    );
  });

})

describe('fetching', function () {

  it("can't fetch without apiUrl", function () {
    const client = new Consumer(config());
    delete client.apiUrl
    assert.rejects(()=>client.fetcher.fetch('/'))
  });

})

describe('subscribing', function () {

  it("can't subscribe to feeds without wsUrl", function () {
    assert.throws(() => new Consumer({...config(), wsUrl: null, feeds: []}));
    assert.throws(() => new Consumer({...config(), wsUrl: null, feeds: ['0x0']}));
  });

  it("doesn't allow connectedFeeds to be mutated directly", async function () {
    const client = new Consumer(config());
    assert.throws(() => client.feeds.add('0x0'));
    assert.throws(() => client.feeds.delete('0x0'));
    assert.throws(() => client.feeds.clear());
    await client.disconnect()
  });

  it("automatically disconnects when feeds are set to []", async function () {
    const client = new Consumer({...config(), feeds: feedIds, lazy: true });
    assert.strictEqual(client.feeds.size, feedIds.length);
    await client.unsubscribeAll()
    assert.strictEqual(client.feeds.size, 0);
    assert.strictEqual(client.socketState, WebSocket.CLOSED);
  });

  it('fetches a report for a single feed and validate the instance', async function () {
    for (const feed of feedIds) {
      const timestamp = Math.floor(Date.now() / 1000) - 30; // 30 seconds ago to avoid flaky test
      const report = await new Consumer(config()).fetchFeed({ timestamp, feed, });
      assert(report instanceof Report);
      if (DEBUG) {
        console.log({ feed, report });
      }
    }
  });

  it('fetches reports for multiple feeds and validate the type', async function () {
    const reports = await new Consumer(config()).fetchFeeds({
      timestamp: Math.floor(Date.now() / 1000), // current timestamp in seconds
      feeds: feedIds,
    });
    assert(typeof reports === 'object');
    if (DEBUG) {
      console.log({ feed, reports });
    }
  });

  it('receives reports when subscribed via constructor', function (done) {
    this.timeout(30000);
    const SDK = new Consumer({ ...config(), feeds: feedIds });
    SDK.once('report', async (report) => {
      await SDK.disconnect();
      done();
    });
  });

  it('receives reports when subscribed via method', function (done) {
    this.timeout(30000);
    const SDK = new Consumer({ ...config(), lazy: true });
    SDK.subscribeTo(feedIds[0]).then(async()=>{})
    SDK.once('report', async (report) => {
      console.log({report: report.feedId, feed: feedIds[0]})
      if (report.feedId === feedIds[0]) {
        console.log({unsub: feedIds[0]})
        await SDK.unsubscribeFrom(feedIds[0]);
        await SDK.subscribeTo(feedIds[1]);
        SDK.once('report', async (report) => {
          await SDK.unsubscribeAll();
          done();
          //if (report.feedId === feedIds[1]) {
            //SDK.unsubscribeFrom(feedIds[1]);
            //done();
          //}
        });
      }
    });
  });

  it('reconnects when socket closes', function (done) {
    this.timeout(30000);
    const SDK = new Consumer({ ...config(), feeds: feedIds, lazy: true, });
    SDK.once('socket-message', async () => {
      console.log('Received 1st message, closing socket...')
      SDK.socket.connection.close();
      console.log('Closed socket...')
      SDK.once('socket-message', async () => {
        console.log('Reconnected, received 2nd message, closing for good...')
        await SDK.disconnect();
        console.log('Done!')
        done()
      });
    });
    SDK.connect();
  });

})

describe('decoding', function () {

  it('throws an error when calling Report.fromSocketMessage with invalid data', function () {
    assert.throws(() => Report.fromSocketMessage({}), {
      name: 'Error',
    });
  });

  it('throws an error when calling Report.fromAPIResponse with invalid data', function () {
    assert.throws(() => Report.fromAPIResponse({}), {
      name: 'Error',
    });
  });

  it('throws an error when calling Report.fromBulkAPIResponse with invalid data', function () {
    assert.throws(() => Report.fromBulkAPIResponse({}), {
      name: 'Error',
    });
  });
});
