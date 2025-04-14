import { Report } from './report.js';
import { ChainlinkDataStreamsConsumerError } from './error.js';
import { makeSetReadOnly, defineProperty, compareSets } from './util.js';
import { once } from './event.js';
import { WebSocket as _WebSocket } from 'ws';

export const WebSocket = _WebSocket || globalThis.WebSocket;

let connectionIndex = 0

export class Socket {

  // Global socket counter.
  static index = 0;

  constructor (options = {}) {
    const { auth, url, feeds, lazy = false, emitter, } = options
    this.index = ++Socket.index;
    this.url = url;
    this.auth = auth;
    this.emitter = emitter;
    let { reconnect } = options
    if (typeof reconnect === 'boolean') reconnect = { enabled: reconnect }
    this.reconnect = {
      enabled:     reconnect.enabled ?? true,
      interval:    reconnect.interval ?? 1000,
      maxAttempts: reconnect.maxAttempts ?? Infinity,
      attempts:    0,
    };
    this.enabled = true;
    this.connection = null;
    this.setConnectedFeeds(feeds);
  }

  debug = (...args) => console.debug(
    `Socket #${this.index}:`, ...args
  );

  logConnecting = (attempt) => this.debug(
    `Connecting (#${attempt}/${this.reconnect.maxAttempts})`
  );

  logReconnecting = (attempt) => this.debug(
    `Reconnecting (#${attempt}/${this.reconnect.maxAttempts})`
  );

  logConnectionFailed = () => this.debug(
    `Connection failed. ` +
    `Retry #${this.reconnect.attempts}/${this.reconnect.maxAttempts} ` +
    `in ${this.reconnect.interval}ms...`
  );

  logConnectionClosed = () => this.debug(
    `Connection closed. ` +
    `Retry #${this.reconnect.attempts}/${this.reconnect.maxAttempts} ` +
    `in ${this.reconnect.interval}ms...`,
  );

  setConnectedFeeds = (feeds) => {

    feeds = makeSetReadOnly(new Set(feeds || []), () => {
      throw new Error.ReadOnlyFeedSet();
    });

    this.debug('Using URL and feeds:', this.url, [...feeds]);

    if ((feeds.size > 0) && !this.url) {
      throw new Error.NoWsUrl();
    }

    if (!this.feeds || !compareSets(this.feeds, feeds)) {
      defineProperty(this, 'feeds', () => feeds, (feeds) => {
        this.setConnectedFeeds(feeds);
        return feeds;
      });
      if (!this.lazy) {
        return this.enable()
      }
    }

    return Promise.resolve(null)

  }

  get readyState () {
    return this.connection?.socket.readyState || WebSocket.CLOSED;
  }

  enable = () => {
    this.enabled = true;
    if (!this.connection) {
      return this.connect();
    }
  }

  disable = async () => {
    this.enabled = false;
    if (this.connection) {
      await this.connection.close()
    }
  }

  configure = (feeds = this.feeds || new Set()) => {
    const path = '/api/v1/ws';
    const search = new URLSearchParams({ feedIDs: [...feeds].join(','), }).toString();
    return {
      url:     Object.assign(new URL(path, this.url), { search }).toString(),
      headers: this.auth.generateHeaders('GET', path, search)
    }
  }

  connect = async () => {
    this.enabled = true;
    const { emitter, decodeAndEmit, feeds = new Set(), onMessage } = this;
    if (feeds.size > 0) {
      const { url, headers } = this.configure(feeds);
      if (this.connection) await this.connection.close();
      let firstTry = this.enabled;
      while (firstTry || (
        this.reconnect?.enabled && (this.reconnect.attempts < this.reconnect.maxAttempts)
      )) {
        const attempt = this.reconnect?.attempts ? ++this.reconnect.attempts : 1;
        if (firstTry) {
          firstTry = false;
          this.logConnecting(attempt);
        } else {
          this.logReconnecting(attempt);
        }
        try {
          this.connection = createSocket({
            url, headers, emitter, onMessage, debug: this.debug
          })
          await this.connection.ready
          this.reconnect.attempts = 0; // reset reconnect attempts on successful connection
          return // stop retrying on success
        } catch (e) {
          console.error(e)
          this.debug(`Reconnecting in ${this.reconnect.interval}ms...`,);
          await new Promise(resolve=>setTimeout(resolve, this.reconnect.interval));
        }
      }
      this.debug(`Connection failed. Use connect() to retry.`);
      throw new Error.Reconnect(error);
    } else if (this.connection) {
      this.debug('Disconnecting because all feeds were disabled. Set feeds to connect.')
      await this.disable();
    } else {
      this.debug('Not connecting because no feeds are enabled. Set feeds to connect.')
    }
  }

  onMessage = ({ message: { data } }) => {
    const report = Report.fromSocketMessage(data)
    this.debug('Received message from feed', report.feedId)
    this.emitter.emit('report', report)
  }

  subscribeTo = (feeds) => {
    this.debug('Subscribe to:', feeds);
    if (typeof feeds === 'string') {
      feeds = [feeds];
    }
    for (const feed of new Set(feeds)) {
      if (!this.feeds.has(feed)) {
        feeds = new Set([...this.feeds, ...feeds]);
        this.debug('New feed count:', feeds.size);
        return this.setConnectedFeeds(feeds);
      }
    }
    this.debug('No new feeds in:', feeds);
  };

  unsubscribeFrom = (feeds) => {
    this.debug('Unsubscribe from:', feeds);
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
      this.debug('New feed count:', updatedFeeds.size);
      return this.setConnectedFeeds(updatedFeeds);
    }
  };

}

function createSocket ({
  url,
  headers,
  emitter,
  onMessage,
  onOpen,
  onError,
  onClose,
  debug = () => {}
}) {
  const index = ++connectionIndex;
  emitter.emit('socket-connect', { index, get socket () { return { url } } })
  const socket = bind(new WebSocket(url, { headers }));
  const ready = afterSocketOpen(socket);
  emitter.emit('socket-connecting', { index, get socket () { socket } })
  return {
    get index  () { return index },
    get ready  () { return ready },
    get socket () { return socket },
    get close  () { return close },
  }
  function bind (socket) {
    socket.addEventListener('error',   onErrorWrapper);
    socket.addEventListener('close',   onCloseWrapper);
    socket.addEventListener('open',    onOpenWrapper);
    socket.addEventListener('message', onMessageWrapper);
    return socket
  }
  function unbind () {
    socket.removeEventListener('error',   onErrorWrapper);
    socket.removeEventListener('close',   onCloseWrapper);
    socket.removeEventListener('open',    onOpenWrapper);
    socket.removeEventListener('message', onMessageWrapper);
  }
  async function close () {
    emitter.emit('socket-close-requested', { index, get socket () { socket } })
    const result = afterSocketClose(socket)
    await ready
    socket.close()
    emitter.emit('socket-close-performed', { index, get socket () { socket } })
    return result
  }
  async function onMessageWrapper (message) {
    emitter.emit('socket-message', { index, get socket () { socket }, get message () { message } });
    onMessage && await Promise.resolve(onMessage({ index, socket, message }))
  }
  async function onErrorWrapper (error) {
    emitter.emit('socket-error', { index, error, get socket () { socket } });
    unbind()
    onError && await Promise.resolve(onError({ index, socket, error }))
  }
  async function onCloseWrapper () {
    emitter.emit('socket-closing', { index, get socket () { socket } });
    unbind()
    onClose && await Promise.resolve(onClose({ index, socket }))
    emitter.emit('socket-closed', { index, get socket () { socket } });
  }
  async function onOpenWrapper () {
    emitter.emit('socket-opening', { socket });
    socket.removeEventListener('open', onOpen);
    onOpen && await Promise.resolve(onOpen({ index, socket }))
    emitter.emit('socket-opened', { socket });
  }
}

function afterSocketOpen (socket, callback = x => x) {
  return new Promise((resolve, reject)=>{
    switch (socket.readyState) {
      case WebSocket.CONNECTING:
        once(socket, 'open',  () => resolve(callback(socket)));
        once(socket, 'error', () => reject(new Error('afterSocketOpen: connection failed')));
        return
      case WebSocket.CONNECTED:
        return resolve(callback(socket));
      case WebSocket.CLOSING:
        return reject(new Error('afterSocketOpen: called on closing socket'))
      case WebSocket.CLOSED:
        return reject(new Error('afterSocketOpen: called on closed socket'));
      default:
        return reject(new Error('afterSocketOpen: invalid WebSocket readyState'));
    }
  })
}

function afterSocketClose (socket, callback = x => x) {
  return new Promise((resolve, reject)=>{
    switch (socket.readyState) {
      case WebSocket.CONNECTING:
      case WebSocket.CONNECTED:
      case WebSocket.CLOSING:
        return once(socket, 'close', () => resolve(callback(socket)));
      case WebSocket.CLOSED:
        return resolve(callback(socket));
      default:
        return reject(new Error('afterSocketClose: invalid WebSocket readyState'));
    }
  })
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
      super(`Socket reconnect error: ${error.message}`)
      this.stack = error.stack
    }
  }
}
