# Fulldome Web Player

Web renderer for playing fulldome and 360° video on a planetarium dome.
It is designed to run in Chromium/JCEF and is controlled by the
[fulldomeplayer](https://github.com/prohfessor/fulldomeplayer) Java application.

## Features

- fulldome and equirectangular 360° video projection;
- playlist loading from a URL query parameter;
- playback range, seeking, mute and projection controls;
- rotation, pitch, vertical and near/far adjustments;
- status events sent back to the Java controller through JCEF queries;
- direct browser operation for renderer development and testing.

The renderer preserves the source projection. It does not normalize or convert
360° and fulldome frames.

## Serving with nginx

Place this repository in the nginx document root, for example:

```text
E:\www\player
```

Then open:

```text
http://localhost/player/index.html?playlist=test.js
```

The playlist path is resolved relative to `index.html`. Media paths inside a
playlist are resolved by the browser relative to the web-server document root.
Do not open `index.html` through `file://`: playlist loading uses `fetch()` and
requires an HTTP server.

## Playlist format

UTF-8 text, one media item per line:

```text
begin,end,rotation,pitch,flags,/path/to/video.webm
```

Example:

```text
0,0,0,0,f,/video/show.webm # duration=615.24 # comment=Fulldome show
```

The Java editor owns playlist persistence and metadata. The web player ignores
inline metadata after `#` except for the six playback fields before it.

Important flags:

- `f` — fulldome;
- `o` — 360°;
- `m` — muted;
- `s` — start immediately;
- `p` — pause marker;
- `h<number>` — vertical offset;
- `n<number>` — near/far offset.

## Controller protocol

Java calls these global browser functions:

```text
videoNext(...)
play()
pause()
stop()
setCurTime(...)
setBeginTime(...)
setEndTime(...)
setVideo360(...)
setRotate360(...)
setRotateTangage(...)
setRotateUp(...)
setRotateFB(...)
```

The renderer sends JCEF queries in this form:

```text
cmd:onload;
cmd:videoinfo;<duration>
cmd:currenttime;<seconds>
cmd:videoend;
cmd:error;<message>
```

Outside JCEF, `window.cefQuery` is optional, so the renderer can also be tested
in a regular Chromium browser.

## Source structure

- `index.html` — entry point and playlist bootstrap;
- `libs/FullDomeRenderer.js` — canonical renderer and player implementation;
- `libs/FullDomeRendererPlayer.js` — legacy compatibility filename; kept identical;
- `libs/DomeMaster.js` — dome projection support;
- `libs/common.js` — loader and shared browser utilities;
- `libs/three` — vendored Three.js runtime and loaders;
- `libs/draco` — vendored Draco decoder;
- `scenes/cubes.js` — orientation test scene;
- `test.js` — example playlist for a local media tree.

## Verification

Run from PowerShell:

```powershell
node --check .\libs\FullDomeRenderer.js
node --check .\libs\FullDomeRendererPlayer.js
node --check .\libs\common.js
node --check .\scenes\cubes.js
```

`FullDomeRenderer.js` is canonical. Keep
`FullDomeRendererPlayer.js` byte-for-byte identical when updating it.

## License

Project-specific code is available under the BSD 3-Clause License. Vendored
third-party libraries remain subject to their respective upstream licenses.
