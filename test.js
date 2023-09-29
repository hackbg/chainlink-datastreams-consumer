import ChainlinkLowLatencySDK, { Report } from './index.js'
import assert from 'node:assert'
import 'dotenv/config'

const config = {
  hostname:     process.env.CHAINLINK_API_URL,
  wsHostname:   process.env.CHAINLINK_WEBSOCKET_URL,
  clientID:     process.env.CHAINLINK_CLIENT_ID,
  clientSecret: process.env.CHAINLINK_CLIENT_SECRET,
}

for (const feed of [
  '0x0002F18A75A7750194A6476C9AB6D51276952471BD90404904211A9D47F34E64',
  '0x00023496426b520583ae20a66d80484e0fc18544866a5b0bfee15ec771963274'
]) {
  const report = await new ChainlinkLowLatencySDK(config).fetchFeed({
    timestamp: '1694212245', feed
  })
  assert(report instanceof Report)
  console.log({ feed, report })
}

const reports = await new ChainlinkLowLatencySDK(config).fetchFeeds({
  timestamp:
    '1694212245',
  feeds: [
    '0x00023496426b520583ae20a66d80484e0fc18544866a5b0bfee15ec771963274',
    '0x0002f18a75a7750194a6476c9ab6d51276952471bd90404904211a9d47f34e64'
  ] 
})

assert(typeof reports === 'object')

console.log({ reports })

const SDK = new ChainlinkLowLatencySDK({
  ...config,
  feeds: [
    '0x00023496426b520583ae20a66d80484e0fc18544866a5b0bfee15ec771963274',
    '0x0002f18a75a7750194a6476c9ab6d51276952471bd90404904211a9d47f34e64'
  ]
})

SDK.once('report', async report1 => {
  console.log({ report1 })
  await SDK.unsubscribeFrom(report1.feedId)
  SDK.once('report', report2 => {
    console.log({ report2 })
    SDK.disconnect()
  })
})

await SDK.subscribeTo([
  '0x00023496426b520583ae20a66d80484e0fc18544866a5b0bfee15ec771963274',
])

SDK.once('report', async report3 => {
  console.log({ report3 })
  SDK.disconnect()
})

assert.throws(()=>Report.fromSocketMessage({}))

assert.throws(()=>Report.fromAPIResponse({}))

assert.throws(()=>Report.fromBulkAPIResponse({}))
