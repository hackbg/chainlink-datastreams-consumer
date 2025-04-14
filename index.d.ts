import type { WebSocket } from 'ws';

export {
  Report,
  EventEmitter,
  ChainlinkDataStreamsConsumer as default,
  ChainlinkDataStreamsConsumer as Consumer,
  ChainlinkDataStreamsError as Error,
  generateHeaders,
}

declare class EventEmitter {
  on(event: string, cb: Function): this;
  off(event: string, cb: Function): this;
  once(event: string, cb: Function): this;
  emit(event: string, data: unknown): this;
}

declare class ChainlinkDataStreamsConsumer extends EventEmitter {
  constructor(args: {
    /** API client ID. */
    clientId?: string;
    /** API client secret. */
    clientSecret?: string;
    /** API HTTP URL. */
    apiUrl?: string;
    /** API WebSocket URL. */
    wsUrl?: string;
    /** List of feed IDs to subscribe to. */
    feeds?: string[];
    /** Automatically connect to socket on construction or setting feeds? */
    lazy?: boolean;
    /** Disable or configure socket auto-reconnect. */
    reconnect?: boolean|{
      enabled?: boolean;
      maxAttempts?: number;
      interval?: number;
    };
  });
  fetchFeed(args: { timestamp: string | number; feed: string; }):
    Promise<Report>;
  fetchFeeds(args: { timestamp: string | number; feeds: string[]; }):
    Promise<Record<string, Report>>;
  subscribeTo(feeds: string | string[]): 
    Promise<WebSocket | null>;
  unsubscribeFrom(feeds: string | string[]):
    Promise<WebSocket | null>;
  connect():
    Promise<void>;
  disconnect():
    void;
  feeds:
    Set<string> & { add: never, delete: never, clear: never };
  generateHeaders(
    method: string,
    path: string,
    search: string|URLSearchParams,
    timestamp?: number
  ): AuthHeaders;
}

declare type Report = {
  feedId: string;
  observationsTimestamp: bigint;
} & (
  | {
      version: 'v1';
      bid: bigint;
      ask: bigint;
      currentBlockNum: bigint;
      currentBlockHash: string;
      validFromBlockNum: bigint;
      currentBlockTimeStamp: bigint;
      benchmarkPrice: bigint;
    }
  | {
      version: 'v2';
      nativeFee: bigint;
      linkFee: bigint;
      expiresAt: number;
      benchmarkPrice: bigint;
    }
  | {
      version: 'v3';
      nativeFee: bigint;
      linkFee: bigint;
      expiresAt: number;
      bid: bigint;
      ask: bigint;
      benchmarkPrice: bigint;
    }
  | {
      version: 'v4';
      validFromTimestamp: bigint;
      nativeFee: bigint;
      linkFee: bigint;
      expiresAt: number;
      price: bigint;
      marketStatus: number;
    }
);

declare class ChainlinkDataStreamsError extends Error {
}

declare function generateHeaders (args: {
  clientId: string,
  clientSecret: string,
  method: string,
  path: string,
  search: string|URLSearchParams,
  timestamp?: number
}): AuthHeaders

declare type AuthHeaders = {
  'Authorization':                    string
  'X-Authorization-Timestamp':        string
  'X-Authorization-Signature-SHA256': string
}
