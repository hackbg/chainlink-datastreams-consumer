# 2.0.0

* Custom `Error` classes, discernible using `instanceof`.
* Automatic reconnection of WebSocket.
  * Use `new Client({ lazy: true, ... })` option to prevent initial autoconnect
  * Use `connect()` and `disconnect()` to manually set the socket state
* **Breaking changes** to configuration:
  * Full URLs now required instead of bare hostnames:
    * `hostname` -> `apiUrl`, now requires protocol (i.e. `https://`)
    * `wsHostname` -> `wsUrl`, now requires protocol (i.e. `wss://`)
    * `http://` and `ws://` supported (for testing only!)
  * `clientID` -> `clientId` to match capitalization of other parameters
  * Configuration variables in `.env` updated accordingly, see `.env.example`.

# 1.1.0

* Allow only `GET|HEAD|OPTIONS` in `generateHeaders`

# 1.0.1

* Harden `generateHeaders`

# 1.0.0

* Initial release
