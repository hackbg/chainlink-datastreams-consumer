import * as crypto      from 'node:crypto'
import * as https       from 'node:https'
import * as querystring from 'node:querystring'
import * as assert      from 'node:assert'

import { WebSocket } from 'ws'
import * as Base64 from 'js-base64'
import { decodeAbiParameters } from 'viem'
import { AbiCoder } from 'ethers'

import * as Data from './data.js'

export default class LOLSDK {

  constructor ({
    log = () => {},
    hostname = "api.testnet-dataengine.chain.link",
    wsHostname = "ws.testnet-dataengine.chain.link",
    clientID = '16678a93-e5a2-424d-98da-47793460bc4d',
    clientSecret = 'HX7ALWUkf8s4faD52pNekYMfAzhgHnKPvwVFdyg26SQ2FQ2VMv4gkvFyLs7MXk5BeJ56gwhb5BsN52s6y95daXCrMsNsmmnQJSnjg2ejjFCbXcmHSTyunJhjKyczaCAP'
  } = {}) {
    Object.assign(this, {
      log,
      hostname,
      wsHostname,
      clientID,
      clientSecret
    })
  }

  fetchFeed = ({ timestamp, feedID }) => this.fetch('/api/v1/reports', {
    feedID,
    timestamp
  }).then(SingleReport.fromAPIResponse)

  fetchFeeds = ({ timestamp, feedIDs }) => this.fetch('/api/v1/reports/bulk', {
    feedIDs: feedIDs.join(','),
    timestamp
  })

  subscribeToFeed = ({ feedIDs }) => this.openSocket('/api/v1/ws', {
    feedIDs: feedIDs.join(','),
    timestamp: '1694212245' // sockets shouldn't need this, right?
  })

  async fetch (path, params = {}) {
    const url = new URL(path, `https://${this.hostname}`)
    url.search = new URLSearchParams(params).toString()
    this.log('Fetching', url.toString())
    const headers = generateHeaders('GET', path, url.search, this.clientID, this.clientSecret);
    const response = await fetch(url, { headers });
    const data = await response.json()
    this.log('Fetched', data)
    return data
  }

  async openSocket (path, params = {}) {
    const url = new URL(path, `wss://${this.wsHostname}`)
    url.search = querystring.stringify(params).toString()
    this.log('Opening WebSocket to', url.toString())
    const headers = generateHeaders('GET', path, url.search, this.clientID, this.clientSecret)
    return new Promise((resolve, reject)=>{
      const ws = new WebSocket(url.toString(), { headers })
      ws.on('error', error => reject(error))
      ws.on('open', () => resolve(ws))
    })
  }

}

const decodeBase64ABIResponse = (schema, data) =>
  decodeABIResponse(schema, Base64.toUint8Array(data))

const decodeABIResponse = (schema, data) => {
  const decoded = AbiCoder.defaultAbiCoder().decode(schema, data)
  assert.equal(
    schema.length,
    decoded.length,
    `length of schema (${schema.length}) and decoded data (${decoded.length}) should be equal`
  )
  const result = {}
  for (const index in schema) {
    result[schema[index].name] = decoded[index]
  }
  return result
}

export class SingleReport {

  static fromAPIResponse = ({
    report: { feedID, validFromTimestamp, observationsTimestamp, fullReport }
  }) => {
    return new this({
      feedID,
      validFromTimestamp,
      observationsTimestamp,
      fullReport: FullReport.fromBase64(fullReport)
    })
  }

  constructor ({ feedID, validFromTimestamp, observationsTimestamp, fullReport }) {
    this.feedID = feedID;
    this.validFromTimestamp = validFromTimestamp;
    this.observationsTimestamp = observationsTimestamp;
    this.fullReport = fullReport;
  }

}

export class FullReport {

  static abiSchema = [
    {name: "reportContext", type: "bytes32[3]"},
    {name: "reportBlob",    type: "bytes"},
    {name: "rawRs",         type: "bytes32[]"},
    {name: "rawSs",         type: "bytes32[]"},
    {name: "rawVs",         type: "bytes32"},
  ]

  static fromBase64 = base64String => {
    const decoded = decodeBase64ABIResponse(this.abiSchema, base64String)
    decoded.reportBlob = ReportBlob.fromHex(decoded.reportBlob)
    return new this(decoded)
  }

  static fromHex = base64String => {
    const decoded = decodeABIResponse(this.abiSchema, base64String)
    decoded.reportBlob = ReportBlob.fromHex(decoded.reportBlob)
    new this(decoded)
  }

  constructor ({
    reportContext, reportBlob, rawRs, rawSs, rawVs
  }) {
    Object.assign(this, {
      reportContext, reportBlob, rawRs, rawSs, rawVs
    })
  }

}

export class ReportBlob {

  static abiSchema = {
    v1: [
      {name: "feedId",                type: "bytes32"},
      {name: "observationsTimestamp", type: "uint32"},
      {name: "benchmarkPrice",        type: "int192"},
      {name: "bid",                   type: "int192"},
      {name: "ask",                   type: "int192"},
      {name: "currentBlockNum",       type: "uint64"},
      {name: "currentBlockHash",      type: "bytes32"},
      {name: "validFromBlockNum",     type: "uint64"},
      {name: "currentBlockTimestamp", type: "uint64"},
    ],
    v2: [
      {name: "feedId",                type: "bytes32"},
      {name: "validFromTimestamp",    type: "uint32"},
      {name: "observationsTimestamp", type: "uint32"},
      {name: "nativeFee",             type: "uint192"},
      {name: "linkFee",               type: "uint192"},
      {name: "expiresAt",             type: "uint32"},
      {name: "benchmarkPrice",        type: "int192"},
    ],
    v3: [
      {name: "feedId",                type: "bytes32"},
      {name: "validFromTimestamp",    type: "uint32"},
      {name: "observationsTimestamp", type: "uint32"},
      {name: "nativeFee",             type: "uint192"},
      {name: "linkFee",               type: "uint192"},
      {name: "expiresAt",             type: "uint32"},
      {name: "benchmarkPrice",        type: "int192"},
      {name: "bid",                   type: "int192"},
      {name: "ask",                   type: "int192"},
    ]
  }

  static fromHex = base64String =>
    new this(decodeABIResponse(this.abiSchema, base64String))

}

export class SingleReportResponse {
  constructor(report) {
    this.report = report;
  }
}

export class BulkReportResponse {
  constructor(reports) {
    this.reports = reports;
  }
}

function generateHeaders(method, path, search, clientId, userSecret, timestamp = +new Date()) {
  const header = {};
  const hmacString = generateHMAC(method, `${path}${search}`, '', clientId, timestamp, userSecret);
  header['Authorization'] = clientId;
  header['X-Authorization-Timestamp'] = timestamp.toString();
  header['X-Authorization-Signature-SHA256'] = hmacString;
  return header;
}

function generateHMAC(method, path, body, clientId, timestamp, userSecret) {
  const serverBodyHash = crypto.createHash('sha256').update(body).digest();
  const serverBodyHashString = `${method} ${path} ${serverBodyHash.toString('hex')} ${clientId} ${timestamp}`
	console.log(`Generating HMAC with the following:  ${serverBodyHashString}`)
  const signedMessage = crypto.createHmac('sha256', Buffer.from(userSecret, 'utf8')).update(serverBodyHashString).digest();
  const userHmac = signedMessage.toString('hex');
  return userHmac;
}

