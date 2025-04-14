import { ChainlinkDataStreamsConsumerError as Error } from './src/error.js';
import { Error as AuthError, generateHeaders } from './src/auth.js';
import { Error as FetchError } from './src/fetch.js';
import { Error as SocketError } from './src/socket.js';
import { Error as ConfigError, ChainlinkDataStreamsConsumer } from './src/client.js';
import { Report } from './src/report.js';

Object.assign(Error, {
  Auth:   AuthError,
  Fetch:  FetchError,
  Socket: SocketError,
  Config: ConfigError,
})

export {
  generateHeaders,
  ChainlinkDataStreamsConsumer as default,
  ChainlinkDataStreamsConsumer as Consumer,
  Report,
  Error,
}
