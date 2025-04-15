import { Report } from './report.js';
import { ChainlinkDataStreamsConsumerError } from './error.js';
import { makeSetReadOnly, defineProperty, compareSets } from './util.js';
import { once } from './event.js';
import { WebSocket as _WebSocket } from 'ws';

export const WebSocket = _WebSocket || globalThis.WebSocket;

export class Socket {

  // Global counter of Socket instances.
  static logicalIndex = 0;

  // Global counter of underlying WebSocket instances.
  static connectionIndex = 0

  constructor (options = {}) {
    const { id, auth, url, feeds, lazy = false, emitter, } = options
    Socket.logicalIndex++
    this.id  = id ?? `socket${Socket.logicalIndex}`;
    this.url = url;
    if (!this.url) {
      throw new Error.NoWsUrl();
    }
    this.auth = auth;
    this.emitter = emitter;
    let { reconnect } = options
    if (typeof reconnect === 'boolean') {
      reconnect = { enabled: reconnect }
    }
    this.reconnect = {
      enabled:     reconnect.enabled ?? true,
      interval:    reconnect.interval ?? 1000,
      maxAttempts: reconnect.maxAttempts ?? Infinity,
      attempts:    0,
    };
    this.connection = null;
    this.setFeeds(feeds);
    this.setEnabled(!lazy);
  }

  get readyState () {
    return this.connection?.socket.readyState || WebSocket.CLOSED;
  }

  setFeeds = async (feeds) => {
    if (typeof feeds === 'string') feeds = [feeds];
    feeds = makeSetReadOnly(new Set(feeds || []), () => {
      throw new Error.ReadOnlyFeedSet();
    });
    if (!this.feeds || !compareSets(this.feeds, feeds)) {
      this.debug('New feeds:', feeds.size, ...feeds);
      defineProperty(this, 'feeds', () => feeds);
      if (this.feeds.size === 0) {
        return await this.connection?.close();
      } else {
        return await this.setEnabled(this.enabled);
      }
    }
  }

  setEnabled = async (enabled) => {
    this.debug(enabled ? 'Enabling' : 'Disabling')
    defineProperty(this, 'enabled', () => enabled);
    if (this.enabled) {
      return await this.connect();
    } else {
      return await this.connection?.close();
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
          this.debug(`Connecting (#${attempt}/${this.reconnect.maxAttempts})`);
        } else {
          this.debug(`Reconnecting (#${attempt}/${this.reconnect.maxAttempts})`);
        }
        try {
          // create the new connection
          const options = { url, headers, emitter, onMessage, debug: this.debug }
          this.connection = createSocket(options)
          // wait for connection to report success
          await this.connection.ready
          // on success, reset reconnect attempts
          this.reconnect.attempts = 0; 
          // on connection close, reconnect
          this.emitter.once('socket-closed', () => this.enabled && this.connect());
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
      await this.connection.close();
    } else {
      this.debug('Not connecting because no feeds are enabled. Set feeds to connect.')
    }
  }

  onMessage = ({ message: { data } }) => {
    const report = Report.fromSocketMessage(data)
    this.emitter.emit('report', report)
  }

  debug = (...args) => console.debug(`[${this.id}]`, ...args);

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
  const index = ++Socket.connectionIndex;
  emitter.emit('socket-connect', { index, get socket () { return { url } } })
  const socket = bind(new WebSocket(url, { headers }));
  const context = (error = null, message = null) => ({
    index, error, get socket () { return socket }, get message () { return message },
  })
  const ready = afterSocketOpen(socket);
  emitter.emit('socket-connecting', context())
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
    emitter.emit('socket-close-requested', context())
    const result = afterSocketClose(socket)
    await ready
    socket.close()
    emitter.emit('socket-close-performed', context())
    return result
  }
  async function onMessageWrapper (message) {
    emitter.emit('socket-message', context(null, message));
    onMessage && await Promise.resolve(onMessage({ index, socket, message }))
  }
  async function onErrorWrapper (error) {
    emitter.emit('socket-error', context(error));
    unbind()
    onError && await Promise.resolve(onError({ index, socket, error }))
    emitter.emit('socket-closed', context(error));
  }
  async function onCloseWrapper () {
    emitter.emit('socket-closing', context());
    unbind()
    onClose && await Promise.resolve(onClose({ index, socket }))
    emitter.emit('socket-closed', context());
  }
  async function onOpenWrapper () {
    emitter.emit('socket-opening', context());
    socket.removeEventListener('open', onOpen);
    onOpen && await Promise.resolve(onOpen({ index, socket }))
    emitter.emit('socket-opened', context());
  }
}

function afterSocketOpen (socket, callback = x => x) {
  return new Promise((resolve, reject)=>{
    switch (socket.readyState) {
      case WebSocket.CONNECTING:
        once(socket, 'open',  () => resolve(callback(socket)));
        once(socket, 'error', () => reject(new Error('afterSocketOpen: connection failed')));
        return
      case WebSocket.OPEN:
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
      case WebSocket.OPEN:
      case WebSocket.CLOSING:
        return once(socket, 'close', () => resolve(callback(socket)));
      case WebSocket.CLOSED:
        return resolve(callback(socket));
      default:
        return reject(
          new Error(`afterSocketClose: invalid WebSocket readyState: ${socket.readyState}`)
        );
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
        'The set of feeds is read-only. Use setFeeds to reconfigure, '+
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
