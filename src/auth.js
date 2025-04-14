import { ChainlinkDataStreamsConsumerError } from './error.js';
import { defineHiddenProperty } from './util.js';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { base16 } from '@scure/base';

const ALLOWED_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const encoder = new TextEncoder();

export class Auth {
  constructor ({ clientId, clientSecret } = {}) {
    if (!(this.clientId = clientId)) throw new Error.NoClientId();
    if (!clientSecret) throw new Error.NoClientSecret();
    this.setClientSecret(clientSecret);
  }
  generateHeaders (method, path, search, timestamp = +new Date()) {
    const { clientId, clientSecret } = this
    return generateHeaders({ clientId, clientSecret, method, path, search, timestamp })
  }
  // Set and hide secret
  setClientSecret (secret) {
    if (!secret) console.warn('Setting empty client secret.');
    defineHiddenProperty(this, 'clientSecret', () => secret, (secret) => {
      this.setClientSecret(secret);
      return secret;
    });
  }
}

export function generateHeaders ({
  clientId, clientSecret, method, path, search, timestamp = +new Date()
}) {
  if (!clientId) {
    throw new Error.NoClientId();
  }
  if (!clientSecret) {
    throw new Error.NoClientSecret();
  }
  // Validate method (must be a string and a valid HTTP method)
  if (typeof method !== 'string' || !ALLOWED_METHODS.includes(method.toUpperCase())) {
    throw new Error.InvalidHttpMethod(method);
  }
  // Validate path (must be a non-empty string)
  if (typeof path !== 'string' || path.trim() === '' || path.indexOf(' ') !== -1) {
    throw new Error.InvalidUrlPath(path);
  }
  // Validate search (must be a string starting with '?' or an empty string).
  // Can also be converted from `URLSearchParams`.
  if (search instanceof URLSearchParams) search = search.toString()
  if (typeof search !== 'string' || search.indexOf(' ') !== -1) {
    throw new Error.InvalidSearch(search);
  }
  if (search && !search.startsWith('?')) {
    search = `?${search}`;
  }
  // Validate timestamp (must be a valid number)
  if (typeof timestamp !== 'number' || isNaN(timestamp)) {
    throw new Error.InvalidTimestamp(timestamp);
  }
  // Sanitize inputs to remove any potentially dangerous characters or spaces
  method = method.trim().toUpperCase();
  path = path.trim();
  search = search.trim();
  // Prepare the signed string
  // The empty string in the sha256.create().update('') is the request body, which is empty in this request
  const signed = [
    method,
    `${path}${search}`,
    base16.encode(sha256.create().update('').digest()).toLowerCase(),
    clientId,
    String(timestamp),
  ];
  // Concatenate the signed string with proper sanitization and no unnecessary spaces
  // This ensures no unexpected spaces or collisions.
  const signedString = signed.join(' ').replace(/\s+/g, ' ').trim();
  // Generate the signature with HMAC
  const signature = base16
    .encode(hmac(sha256, encoder.encode(clientSecret), encoder.encode(signedString)))
    .toLowerCase();
  return {
    'Authorization': clientId,
    'X-Authorization-Timestamp': timestamp.toString(),
    'X-Authorization-Signature-SHA256': signature,
  };
}

export const Error = class AuthError extends ChainlinkDataStreamsConsumerError {
  static NoClientId = class NoClientIdError extends AuthError {
    constructor () {
      super("Client ID not provided");
    }
  }
  static NoClientSecret = class NoClientIdError extends AuthError {
    constructor () {
      super("Client secret not provided");
    }
  }
  static InvalidHttpMethod = class InvalidHttpMethodError extends AuthError {
    constructor (method) {
      super(
        `Invalid HTTP method provided or the provided: ${method}. `+
        `Allowed methods are: GET, HEAD, OPTIONS`,
      );
      this.method = method;
    }
  }
  static InvalidUrlPath = class InvalidPathError extends AuthError {
    constructor (path) {
      super(`Invalid path provided: ${path}`);
      this.path = path;
    }
  }
  static InvalidSearch = class InvalidSearchError extends AuthError {
    constructor (search) {
      super('Search parameter must be a string.');
      this.search = search;
    }
  }
  static InvalidTimestamp = class InvalidTimestampError extends AuthError {
    constructor (timestamp) {
      super(`Invalid timestamp provided: ${timestamp}`)
      this.timestamp = timestamp;
    }
  }
}
