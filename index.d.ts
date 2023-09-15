import type { WebSocket } from 'ws'

export default class LOLSDK {
  constructor (args: {
    clientID: string,
    clientSecret: string,
    hostname: string,
    wsHostname: string,
    feeds?: string[]
  })

  fetchFeed (args: { timestamp: string|number, feed: string }): Promise<Report>

  fetchFeeds (args: { timestamp: string|number, feeds: string }): Promise<Record<string, Report>>

  subscribeTo (feeds: string|string[]): Promise<WebSocket|null>

  unsubscribeFrom (feeds: string|string[]): Promise<WebSocket|null>

  disconnect (): void

  feeds: Set<string>
}

export type Report = {
  feedId:                  string
  observationsTimestamp:   bigint
  benchmarkPrice:          bigint
} & (
  {
    version:               'v1'
    ask:                   bigint
    bid:                   bigint
    currentBlockHash:      string
    currentBlockNum:       bigint
    currentBlockTimeStamp: bigint
    validFromBlockNum:     bigint
  } | {
    version:               'v2'
    expiresAt:             number
    linkFee:               bigint
    nativeFee:             bigint
  } | {
    version:               'v3'
    ask:                   bigint
    bid:                   bigint
    expiresAt:             number
    linkFee:               bigint
    nativeFee:             bigint
  }
)
