# 2.0.0

* **NEW:** Unencrypted `http://` and `ws://` are now supported (use for testing only!)
* **NEW:** Custom `Error` classes, discernible using `instanceof`.
* **NEW:** Constructor option `reconnect` (default on) allows reconnection of WebSocket.
* **NEW:** Constructor option `lazy` (default off) prevents autoconnect to socket.
* **NEW:** Methods `connect()` and `disconnect()` manually set the socket connection state.
* **NEW:** Method `unsubscribeAll()` clears feeds and disconnects.
* **NEW:** Field `socketState` reports connection state of currently used `WebSocket`.
* **BREAKING:** `feeds` field is now read-only.
* **BREAKING:** Constructor option `hostname` is now `apiUrl` and requires protocol
  (preferably `https://`, alternatively `http://`, possibly `//`)
* **BREAKING:** Constructor option `wsHostname` is now `wsUrl` and requires protocol
  (preferably `wss://`, alternatively `ws://`, possibly `//`)
* **BREAKING:** Constructor option `clientID` is now `clientId`, to match others.
* **BREAKING:** Configuration variables in `.env` updated, see `.env.example`.

# 1.1.0

* **NEW**: Allow only `GET|HEAD|OPTIONS` in `generateHeaders`

# 1.0.1

* **FIX**: Harden `generateHeaders`

# 1.0.0

* **NEW**: Initial release
