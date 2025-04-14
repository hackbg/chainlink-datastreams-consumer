import type { WebSocket } from 'ws';

export type ReconnectOptions = {
  enabled?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
};
export default class ChainlinkDataStreamsConsumer {
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
    /** Disable or configure socket auto-reconnect. */
    reconnect?: boolean|ReconnectOptions;
    /** Don't automatically connect to socket on construction or setting feeds. */
    lazy?: boolean;
  });

  fetchFeed(args: {
    timestamp: string | number;
    feed: string;
  }): Promise<Report>;

  fetchFeeds(args: {
    timestamp: string | number;
    feeds: string[];
  }): Promise<Record<string, Report>>;

  subscribeTo(feeds: string | string[]): Promise<WebSocket | null>;

  unsubscribeFrom(feeds: string | string[]): Promise<WebSocket | null>;

  connect(): Promise<void>;

  disconnect(): void;

  feeds: Set<string>;

  on(event: string, cb: Function): this;

  off(event: string, cb: Function): this;

  once(event: string, cb: Function): this;
}

export type Report = {
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
