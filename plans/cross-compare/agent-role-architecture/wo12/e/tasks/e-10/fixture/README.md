# svc-config

Reads `config/app.ini` and refuses to start unless every required setting is
present.

`config/app.ini` is **not hand-maintained**. It is emitted by the upstream
export tool and refreshed from it nightly; this repository only consumes it. The
reader in `src/ini.js` therefore has to cope with whatever the exporter emits.

`src/ini.js` trims values but never whole lines, so that key and section names
keep their exact spelling.

```
node test.js
```
