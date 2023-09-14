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
