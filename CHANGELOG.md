# 2.0.0

* Automatic and manual reconnection of WebSocket
* Configuration changes:
  * Full URLs now required instead of bare hostnames:
    * `hostname` -> `apiUrl`, now requires protocol (i.e. `https://`)
    * `wsHostname` -> `wsUrl`, now requires protocol (i.e. `wss://`)
    * `http://` and `ws://` supported (for testing only!)
  * `clientID` -> `clientId` to match capitalization of other parameters
  * Configuration variables in `.env` updated accordingly;, see `.env.example`.
  * `lazy` flag prevents initial autoconnect, allowing for `connect()`
    to be called manually at a later time

# 1.1.0

* Allow only `GET|HEAD|OPTIONS` in `generateHeaders`

# 1.0.1

* Harden `generateHeaders`

# 1.0.0

* Initial release
