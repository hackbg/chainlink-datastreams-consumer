import { ChainlinkDataStreamsConsumerError } from './error.js';
import { EventEmitter } from './event.js'
import { Auth } from './auth.js'
import { Fetcher } from './fetch.js'
import { Socket } from './socket.js'

export class ChainlinkDataStreamsConsumer extends EventEmitter {
  constructor (options = {}) {
    if ('clientID' in options) throw new Error.DeprecatedClientId();
    if ('hostname' in options) throw new Error.DeprecatedHostname();
    if ('wsHostname' in options) throw new Error.DeprecatedWsHostname();
    const { apiUrl, wsUrl, clientId, clientSecret, feeds, connect, reconnect } = options;
    super();
    const auth = this.auth = new Auth({ clientId, clientSecret });
    this.fetcher = new Fetcher({ auth, url: apiUrl });
    this.socket = new Socket({ auth, url: wsUrl, feeds, connect, reconnect, emitter: this });
  }
  get clientId () {
    return this.auth.clientId;
  }
  set clientId (value) {
    return this.auth.clientId = value;
  }
  get clientSecret () {
    return this.auth.clientSecret;
  }
  set clientSecret (value) {
    return this.auth.clientSecret = value;
  }
  fetchFeed ({ timestamp, feed }) {
    return this.fetcher.feed({ timestamp, feed });
  }
  fetchFeeds ({ timestamp, feeds }) {
    return this.fetcher.feeds({ timestamp, feeds });
  }
  connect () {
    return this.socket.setEnabled(true);
  }
  disconnect () {
    return this.socket.setDisabled(true);
  }
  get feeds () {
    return this.socket.feeds;
  }
  subscribeTo (feeds = []) {
    return this.socket.setFeeds([...this.feeds, (typeof feeds === 'string') ? [feeds] : feeds]);
  }
  unsubscribeFrom (feeds = []) {
    if (typeof feeds === 'string') feeds = [feeds];
    return this.socket.setFeeds([...this.feeds].filter(feed=>!feeds.has(feed)));
  }
  unsubscribeAll () {
    return this.socket.setFeeds([])
  }
  get socketState () {
    return this.socket?.readyState ?? null;
  }
  generateHeaders (...args) {
    return this.auth.generateHeaders(...args);
  }
}

export const Error = class ConfigError extends ChainlinkDataStreamsConsumerError {
  static DeprecatedClientId = class DeprecatedClientIdError extends ConfigError {
    constructor () {
      super(
        'Deprecated: options.clientID is now options.clientId '+
        'to match capitalization of other parameters.'
      )
    }
  }
  static DeprecatedHostname = class DeprecatedHostnameError extends ConfigError {
    constructor () {
      super(
        'Deprecated: options.hostname is now options.apiUrl and requires protocol.'
      )
    }
  }
  static DeprecatedWsHostname = class DeprecatedWsHostnameError extends ConfigError {
    constructor () {
      super(
        'Deprecated: options.wsHostname is now options.wsUrl and requires protocol.'
      )
    }
  }
}
