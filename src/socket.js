import { Report } from './report.js';
import { ChainlinkDataStreamsConsumerError } from './error.js';
import { makeSetReadOnly, defineProperty, compareSets } from './util.js';
import { WebSocket as _WebSocket } from 'ws';

export const WebSocket = _WebSocket || globalThis.WebSocket;

export class Socket {

  // Global socket counter.
  static index = 0;

  constructor (options = {}) {
    const { auth, url, feeds, lazy = false, reconnect, emitter, } = options
    this.index = ++Socket.index;
    this.url = url;
    this.auth = auth;
    this.emitter = emitter;
    this.reconnect = {
      enabled:     true,
      maxAttempts: Infinity,
      interval:    1000,
      ...((typeof options.reconnect === 'boolean')
        ? { enabled: options.reconnect }
        : options.reconnect),
    };
    this.manuallyDisconnected = false;
    this.setConnectedFeeds(feeds);
  }

  setConnectedFeeds = (feeds) => {
    feeds = feeds || [];
    console.debug('Connecting to feeds:', feeds, this.url);
    if ((feeds.length > 0) && !this.url) {
      throw new Error.NoWsUrl();
    }
    feeds = makeSetReadOnly(new Set(feeds), () => {
      throw new Error.ReadOnlyFeedSet();
    });
    if (!this.feeds || !compareSets(this.feeds, feeds)) {
      defineProperty(this, 'feeds', () => feeds, (feeds) => {
        this.setConnectedFeeds(feeds);
        return feeds;
      });
      if (!this.lazy) {
        this.connectImpl()
      }
    }
    return feeds
  }

  get readyState () {
    return this.ws?.readyState || WebSocket.CLOSED;
  }

  connect = () => {
    this.manuallyDisconnected = false;
    return this.connectImpl();
  }

  disconnect = () => {
    this.manuallyDisconnected = true;
    return this.disconnectImpl(true);
  }

  connectImpl = () => new Promise(async (resolve, reject)=>{
    const { feeds = new Set() } = this;
    if (feeds.size > 0) {
      const path    = '/api/v1/ws';
      const search  = new URLSearchParams({ feedIDs: [...feeds].join(','), }).toString();
      const url     = Object.assign(new URL(path, this.url), { search, });
      const headers = this.auth.generateHeaders('GET', path, search);
      if (this.ws) await this.disconnectImpl(true);
      const ws = (this.ws = new WebSocket(url.toString(), { headers }));
      const onopen = () => {
        ws.off('open',  onopen);
        this.emitter.emit('connected', this.ws);
        console.debug(`Socket #${this.index} opened.`)
        // reset reconnect attempts on successful connection
        this.reconnect.attempts = 0;
        resolve(this.ws);
      };
      const onerror = (error) => {
        ws.off('error', onerror);
        ws.off('close', onclose);
        ws.off('open',  onopen);
        console.error(`Socket #${this.index} error:`, error)
        resolve();
      };
      const onclose = () => {
        ws.off('error', onerror);
        ws.off('close', onclose);
        ws.off('open',  onopen);
        this.emitter.emit('disconnected', this.ws);
        console.debug(`Socket #${this.index} closed.`)
        if (!this.reconnect?.enabled) {
          console.debug(
            `Socket #${this.index} closed. Reconnect not enabled, will not reconnect. ` +
            'Use connect() to reconnect.'
          );
          resolve();
          return;
        }
        if (this.manuallyDisconnected) {
          console.debug(
            `Socket #${this.index} closed. Manually disconnected, will not reconnect. ` +
            'Use connect() to resume.'
          );
          resolve();
          return;
        }
        if (this.reconnect.attempts < this.reconnect.maxAttempts) {
          this.reconnect.attempts++;
          console.log(
            `Socket #${this.index} reconnecting: `+
            `attempt #${this.reconnect.attempts}/${this.reconnect.maxAttempts}`,
            `in ${this.reconnect.interval}ms...`,
          );
          setTimeout(this.connectImpl, this.reconnect.interval);
        } else {
          const error = `Socket #${this.index}: `+
            `max reconnect attempts (${this.reconnect.maxAttempts}) reached. Giving up.`
          console.error(error);
          return reject(new Error.Reconnect(error))
        }
        resolve();
      };
      ws.on('error',   onerror);
      ws.on('open',    onopen);
      ws.on('close',   onclose);
      ws.on('message', this.decodeAndEmit);
    } else if (this.ws) {
      console.debug('No feeds enabled, disconnecting. Set feeds to connect.')
      await this.disconnectImpl(true);
    } else {
      console.debug('No feeds enabled, not connecting. Set feeds to connect.')
    }
    resolve();
  })

  disconnectImpl = (unbind) => {
    const { ws } = this;
    if (unbind) {
      this.ws.off('error', onerror);
      this.ws.off('close', onclose);
      this.ws.off('open',  onopen);
    }
    return new Promise((resolve, reject)=>{
      if (ws) {
        ws.off('message', this.decodeAndEmit);
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.on('open', () => {
            ws.close();
            resolve();
          });
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.close();
          resolve();
        }
        this.ws = null;
      } else {
        console.warn('Already disconnected.');
        resolve();
      }
    })
  };

  decodeAndEmit = (message) => {
    this.emitter.emit('report', Report.fromSocketMessage(message));
  };

  subscribeTo = (feeds) => {
    if (typeof feeds === 'string') {
      feeds = [feeds];
    }
    const newFeeds = new Set()
    for (const feed of new Set(feeds)) {
      if (!this.feeds.has(feed)) {
        return this.setConnectedFeeds([...this.feeds, ...newFeeds]);
      }
    }
    console.warn('No new feeds in:', feeds)
  };

  unsubscribeFrom = (feeds) => {
    if (typeof feeds === 'string') {
      feeds = [feeds];
    }
    let changed = false;
    const updatedFeeds = new Set(this.feeds);
    for (const feed of new Set(feeds)) {
      if (updatedFeeds.has(feed)) {
        updatedFeeds.delete(feed);
        changed = true;
      }
    }
    if (changed) {
      return this.setConnectedFeeds(updatedFeeds);
    }
  };

}

export const Error = class SocketError extends ChainlinkDataStreamsConsumerError {
  static NoWsUrl = class NoWsUrlError extends SocketError {
    constructor () {
      super('WebSocket URL not provided.');
    }
  }
  static ReadOnlyFeedSet = class ReadOnlyFeedSetError extends SocketError {
    constructor () {
      super(
        'The set of feeds is read-only. Use setConnectedFeeds to reconfigure, '+
        'or clone the set to mutate its values outside the client module.'
      );
    }
  }
  static Reconnect = class ReconnectError extends SocketError {
    constructor (error) {
      super(`Socket teconnect error: ${error.message}`)
      this.stack = error.stack
    }
  }
}
