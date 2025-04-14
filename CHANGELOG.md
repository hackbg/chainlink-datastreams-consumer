# 2.0.0

* Automatic and manual reconnection:
* Configuration changes:
  * Full URLs now required instead of bare hostnames:
    * `hostname` -> `apiUrl`, now requires protocol (i.e. `https://`)
    * `wsHostname` -> `wsUrl`, now requires protocol (i.e. `wss://`)
    * `http://` and `ws://` supported (for testing only!)
  * `clientID` -> `clientId` to match capitalization of other parameters
  * Configuration variables in `.env` updated accordingly;, see `.env.example`.

# 1.1.0

* Allow only `GET|HEAD|OPTIONS` in `generateHeaders`

# 1.0.1

* Harden `generateHeaders`

# 1.0.0

* Initial release
