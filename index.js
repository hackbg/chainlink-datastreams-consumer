import { WebSocket } from 'ws'
import * as crypto      from 'node:crypto'
import * as https       from 'node:https'
import * as querystring from 'node:querystring'

export default class LOLSDK {

  constructor ({
    log = () => {},
    hostname = "api.testnet-dataengine.chain.link",
    clientID = '16678a93-e5a2-424d-98da-47793460bc4d',
    clientSecret = 'HX7ALWUkf8s4faD52pNekYMfAzhgHnKPvwVFdyg26SQ2FQ2VMv4gkvFyLs7MXk5BeJ56gwhb5BsN52s6y95daXCrMsNsmmnQJSnjg2ejjFCbXcmHSTyunJhjKyczaCAP'
  } = {}) {
    Object.assign(this, {
      log,
      hostname,
      clientID,
      clientSecret
    })
  }

  fetchFeed = ({ timestamp, feedID }) => this.fetch('/api/v1/reports', {
    feedID,
    timestamp
  })

  fetchFeeds = ({ timestamp, feedIDs }) => this.fetch('/api/v1/reports/bulk', {
    feedIDs: feedIDs.join(','),
    timestamp
  })

  subscribeToFeed = ({ feedID }) => this.openSocket(/* TODO */)

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
    //export function openWebSocketSingleFeed({
      //hostname   = BASE_URL,
      //clientId   = CLIENT_ID,
      //userSecret = CLIENT_SECRET,
      ////feedID     = '0x00023496426b520583ae20a66d80484e0fc18544866a5b0bfee15ec771963274',
      //feedID     = '0x0002F18A75A7750194A6476C9AB6D51276952471BD90404904211A9D47F34E64',
      //timestamp  = +new Date()//'1000000'
    //} = {}) {
      //const url = new URL(path, `wss://${hostname}`)
      //url.search = querystring.stringify({ feedID, timestamp: '1694212245',  })
      //return new Promise((resolve, reject)=>{
        //let ws
        //try {
          //ws = new WebSocket(url.toString(), {
            //headers: generateHeaders('GET', path, url.search, clientId, userSecret, timestamp)
          //})
        //} catch (e) {
          //console.error({e})
          //reject(e)
        //}
        //ws.on('error', error => {
          //reject(error)
        //})
        //ws.on('open', () => {
          //resolve(ws)
        //})
      //})
    //}
  }

}

export class SingleReport {
  constructor(feedID, validFromTimestamp, observationsTimestamp, fullReport) {
    this.feedID = feedID;
    this.validFromTimestamp = validFromTimestamp;
    this.observationsTimestamp = observationsTimestamp;
    this.fullReport = fullReport;
  }
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

