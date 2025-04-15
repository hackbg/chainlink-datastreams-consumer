import { ChainlinkDataStreamsConsumerError } from './error.js';
import { EventEmitter } from './event.js'
import { Report } from './report.js'

export class Fetcher {
  constructor (options = {}) {
    const { auth, url } = options
    this.auth = auth;
    this.url = url;
  }

  async fetch (path, params = {}) {
    if (!this.url) throw new Error.NoApiUrl();
    const url = new URL(path, this.url);
    url.search = new URLSearchParams(params).toString();
    const headers = this.auth.generateHeaders('GET', path, url.search);
    const response = await fetch(url, { headers });
    const data = await response.json();
    return data;
  }

  async feed ({ timestamp, feed }) {
    const params = { timestamp, feedID: feed };
    return Report.fromAPIResponse(await this.fetch('/api/v1/reports', params));
  }

  async feeds ({ timestamp, feeds }) {
    const params = { timestamp, feedIDs: feeds.join(',') };
    return Report.fromBulkAPIResponse(await this.fetch('/api/v1/reports/bulk', params));
  }
}

export const Error = class FetchError extends ChainlinkDataStreamsConsumerError {
  static NoApiUrl = class NoApiUrlError extends FetchError {
    constructor () {
      super('REST API URL not provided.')
    }
  }
}
