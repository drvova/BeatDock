# BeatDock Migration: Lavalink → discord-player

## Overview

Replace `lavalink-client` (requires a separate Lavalink Java server) with `discord-player` + `@discord-player/extractor` (pure Node.js, uses FFmpeg locally). This eliminates the Lavalink server dependency entirely — the bot becomes a single Docker container.

---

## Step 1: Update Dependencies

**File: `package.json`**

Remove:
- `lavalink-client`

Add:
- `discord-player` (v6.x)
- `@discord-player/extractor` (default extractors: YouTube, SoundCloud, Spotify, etc.)
- `ffmpeg-static` (FFmpeg binary for audio transcoding)
- `mediaplex` (opus encoder — required for voice)

Keep:
- `discord.js`, `dotenv`, `picocolors`

```bash
npm uninstall lavalink-client
npm install discord-player @discord-player/extractor ffmpeg-static mediaplex
```

---

## Step 2: Delete Lavalink-Specific Files

Delete these files entirely:
- `src/utils/LavalinkConnectionManager.js` (436 lines — Lavalink WebSocket reconnection)
- `src/utils/PublicNodeProvider.js` (fetches public Lavalink nodes)
- `Dockerfile.lavalink` (Lavalink server Docker image)
- `application.yml` (Lavalink server config)

---

## Step 3: Rewrite `src/index.js`

**Current:** Creates `LavalinkManager`, connects to Lavalink server, registers lavalink events.

**New:** Create `Player` from `discord-player`, load default extractors, register discord-player events.

### Key changes:

```js
// OLD
const { LavalinkManager } = require('lavalink-client');
client.lavalink = new LavalinkManager({...});

// NEW
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const player = new Player(client);
await player.extractors.loadMulti(DefaultExtractors);
```

### Event mapping:

| Old (lavalink-client)       | New (discord-player)                    |
|-----------------------------|-----------------------------------------|
| `trackStart`                | `player.events.on('playerStart', ...)`  |
| `trackEnd`                  | `player.events.on('playerFinish', ...)` |
| `queueEnd`                  | `player.events.on('emptyQueue', ...)`   |
| `trackStuck`                | `player.events.on('playerSkip', ...)`   |
| `trackError`                | `player.events.on('playerError', ...)`  |

### Remove from `bootstrap()`:
- All Lavalink connection setup
- `LavalinkConnectionManager` initialization
- `PublicNodeProvider` references
- `LAVALINK_HOST/PORT/PASSWORD` env var reads

### Keep:
- `client.activePlayers` Map (for player message tracking)
- `client.autoplayEnabled` Map
- `client.playerController` instance
- `cleanupGuildPlayer()` (adapted)

### Autoplay:
discord-player has built-in autoplay via `QueueRepeatMode.AUTOPLAY`. Set it with `queue.setRepeatMode(QueueRepeatMode.AUTOPLAY)` instead of custom autoplay logic. The existing `autoplay.js` util can be simplified or removed.

---

## Step 4: Rewrite `src/utils/interactionHelpers.js`

### `isLavalinkAvailable()` → `isPlayerReady()`
```js
// OLD: checks client.lavalinkConnectionManager.isAvailable()
// NEW: Always true (no external server needed), or check player.extractors
function isPlayerReady(client) {
  return client.player !== undefined;
}
```

### `requirePlayer(guild)` → use `useQueue()`
```js
// OLD: client.lavalink.getPlayer(guild.id)
// NEW:
const { useQueue } = require('discord-player');
const queue = useQueue(guild.id);
if (!queue || !queue.currentTrack) { /* no player */ }
```

### `requireSameVoice(interaction, player)`
```js
// OLD: player.voiceChannelId
// NEW: queue.channel.id
```

### `handleLavalinkError()` → rename to `handlePlayerError()`
Map discord-player errors to locale keys. Most Lavalink-specific errors disappear.

---

## Step 5: Rewrite `src/commands/play.js`

**Current flow:** `createPlayer()` → `player.search()` → `queue.add()` → `player.play()` → `player.connect()`

**New flow:** Single `player.play(voiceChannel, query, { nodeOptions })` call does everything.

```js
const { useMainPlayer } = require('discord-player');

const player = useMainPlayer();
const result = await player.play(voiceChannel, query, {
  requestedBy: interaction.user,
  nodeOptions: {
    metadata: { channel: interaction.channel },
    selfDeaf: true,
    volume: defaultVolume,
    leaveOnEnd: true,
    leaveOnEmpty: true,
    leaveOnEmptyCooldown: 300000,
  },
});
```

Track info access changes:
```js
// OLD: track.info.title, track.info.author, track.info.duration
// NEW: track.title, track.author, track.duration
```

---

## Step 6: Rewrite `src/commands/search.js`

Use `player.search()` directly, then handle results similarly to current flow.

```js
const player = useMainPlayer();
const searchResult = await player.search(query, { requestedBy: interaction.user });
// searchResult.tracks = array of tracks
// searchResult.playlist = playlist info if URL
```

---

## Step 7: Adapt All Other Commands

### API mapping cheat sheet:

| lavalink-client                           | discord-player                                    |
|-------------------------------------------|---------------------------------------------------|
| `client.lavalink.getPlayer(guildId)`      | `useQueue(guildId)`                               |
| `player.queue.current`                    | `queue.currentTrack`                              |
| `player.queue.tracks`                     | `queue.tracks.toArray()` / `queue.tracks.data`    |
| `player.queue.tracks.length`              | `queue.tracks.size`                               |
| `player.queue.add(track)`                 | `queue.tracks.add(track)`                         |
| `player.queue.shuffle()`                  | `queue.tracks.shuffle()`                          |
| `player.queue.tracks.splice(0, len)`      | `queue.tracks.clear()`                            |
| `player.queue.previous`                   | `queue.history.tracks.toArray()`                  |
| `player.queue.shiftPrevious()`            | `queue.history.back()`                            |
| `player.skip()`                           | `queue.node.skip()`                               |
| `player.destroy()`                        | `queue.delete()` / `queue.destroy()`              |
| `player.pause()` / `player.resume()`      | `queue.node.pause()` / `queue.node.resume()`      |
| `player.paused`                           | `queue.node.isPaused()`                           |
| `player.playing`                          | `queue.isPlaying()`                               |
| `player.connected`                        | `queue.channel` (truthy if connected)             |
| `player.voiceChannelId`                   | `queue.channel.id`                                |
| `player.guildId`                          | `queue.guild.id`                                  |
| `player.setVolume(vol)`                   | `queue.node.setVolume(vol)`                       |
| `player.volume`                           | `queue.node.volume`                               |
| `player.setRepeatMode(mode)`              | `queue.setRepeatMode(mode)`                       |
| `player.repeatMode`                       | `queue.repeatMode`                                |
| `player.seek(ms)`                         | `queue.node.seek(ms)`                             |
| `track.info.title`                        | `track.title`                                     |
| `track.info.author`                       | `track.author`                                    |
| `track.info.duration`                     | `track.duration`                                  |
| `track.info.uri` / `track.info.identifier`| `track.url` / `track.id`                          |
| `track.info.artworkUrl`                   | `track.thumbnail`                                 |

### Command-by-command:

- **skip.js**: `queue.node.skip()` — also handle "skip to next" for autoplay
- **nowplaying.js**: `queue.currentTrack`, `queue.repeatMode`, `useTimeline()` for progress
- **pause.js**: `queue.node.pause()` / `queue.node.resume()`
- **stop.js**: `queue.delete()`
- **volume.js**: `queue.node.setVolume(vol)`
- **loop.js**: `queue.setRepeatMode(QueueRepeatMode.OFF/TRACK/QUEUE/AUTOPLAY)`
- **shuffle.js**: `queue.tracks.shuffle()`
- **queue.js**: `queue.currentTrack`, `queue.tracks.toArray()`, `queue.tracks.size`
- **clear.js**: `queue.tracks.clear()`
- **back.js**: `queue.history.back()`
- **lyrics.js**: `queue.currentTrack.title`, `queue.currentTrack.author`, `queue.currentTrack.duration`
- **autoplay.js**: Toggle `queue.setRepeatMode(QueueRepeatMode.AUTOPLAY)` vs `QueueRepeatMode.OFF`
- **filter.js**: See Step 8

---

## Step 8: Rewrite Filter System (`src/interactions/filterNavigation.js`)

discord-player has FFmpeg-based filters via `queue.filters.ffmpeg`.

### Filter mapping:

| lavalink-client `player.filterManager` | discord-player `queue.filters.ffmpeg` |
|-----------------------------------------|---------------------------------------|
| `fm.toggleNightcore()`                  | `toggle(['nightcore'])`               |
| `fm.toggleVaporwave()`                  | `toggle(['vaporwave'])`               |
| `fm.toggleRotation()`                   | `toggle(['rotation'])`                |
| `fm.toggleKaraoke()`                    | `toggle(['karaoke'])`                 |
| `fm.toggleTremolo()`                    | `toggle(['tremolo'])`                 |
| `fm.toggleVibrato()`                    | `toggle(['vibrato'])`                 |
| `fm.toggleLowPass()`                    | `toggle(['lowpass'])`                 |
| `fm.setEQ(bands)`                       | `toggle(['bassboost'])` or custom FFmpeg filter |
| `fm.clearEQ()`                          | `toggle(['bassboost'])` (off)         |
| `fm.resetFilters()`                     | `queue.filters.ffmpeg.setFilters([])` |

### Important: discord-player filters operate differently:
- They use FFmpeg audio filters, not Lavalink plugin filters
- EQ presets (like `EQList` from lavalink-client) don't exist natively — replace with bassboost levels or custom FFmpeg filter strings
- Filter toggling has a delay (audio re-encoding)

### Check what filters are active:
```js
queue.filters.ffmpeg.isEnabled('nightcore') // returns boolean
```

---

## Step 9: Rewrite `src/interactions/searchNavigation.js`

Replace `client.lavalink.createPlayer()` + `player.search()` + `player.connect()` + `player.play()` with:
```js
const player = useMainPlayer();
await player.play(voiceChannel, selectedTrack, {
  nodeOptions: { metadata: { channel: textChannel } },
});
```

---

## Step 10: Adapt `src/utils/PlayerController.js`

Replace all `client.lavalink.getPlayer(guildId)` calls with `useQueue(guildId)`.

Track property access changes:
```js
// OLD
player.queue.current.info.title
player.queue.current.info.author
player.queue.current.info.duration
player.queue.current.info.artworkUrl

// NEW
queue.currentTrack.title
queue.currentTrack.author
queue.currentTrack.duration
queue.currentTrack.thumbnail
```

Progress bar: use `useTimeline({ node: guildId })` → `timeline.timestamp.progress`.

---

## Step 11: Adapt `src/utils/PlayerActions.js`

### `playPrevious(player)`:
```js
// OLD: player.queue.previous, player.queue.shiftPrevious()
// NEW:
const { useHistory } = require('discord-player');
const history = useHistory(guildId);
await history.back(); // plays previous track
```

### `shuffleQueue(player)`:
```js
// OLD: player.queue.shuffle()
// NEW: queue.tracks.shuffle()
```

### `clearQueue(player)`:
```js
// OLD: player.queue.tracks.splice(0, len)
// NEW: queue.tracks.clear()
```

### `jumpToTrack(player, index)`:
```js
// OLD: player.queue.tracks[index], player.skip()
// NEW: Remove all tracks before the target, then skip current
// (no native skipTo in discord-player)
const tracks = queue.tracks.toArray();
for (let i = 0; i < index; i++) {
  queue.removeTrack(0);
}
queue.node.skip(); // skips current, plays the target
```

---

## Step 12: Adapt `src/utils/autoplay.js`

discord-player has **built-in autoplay** via `QueueRepeatMode.AUTOPLAY`. This is simpler and likely better than the custom 3-tier cascade.

**Option A (Recommended):** Use built-in autoplay
```js
queue.setRepeatMode(QueueRepeatMode.AUTOPLAY);
```

**Option B:** Keep custom autoplay logic adapted to discord-player's search API:
```js
const player = useMainPlayer();
const result = await player.search(query, { requestedBy: user });
// result.tracks → array of Track objects
```

If keeping custom autoplay, the `emptyQueue` event handler becomes:
```js
player.events.on('emptyQueue', async (queue) => {
  if (client.autoplayEnabled.get(queue.guild.id)) {
    const tracks = await findAutoplayTracks(queue);
    if (tracks.length) {
      queue.tracks.add(tracks);
      queue.node.play();
    }
  }
});
```

---

## Step 13: Adapt `src/events/voiceStateUpdate.js`

Replace `client.lavalink.getPlayer(guildId)` with `useQueue(guildId)`.

```js
const { useQueue } = require('discord-player');
const queue = useQueue(guildId);
if (queue) queue.delete(); // or queue.destroy()
```

---

## Step 14: Update Docker Configuration

### `docker-compose.yml`:
- Remove the `lavalink` service entirely
- Remove `depends_on: lavalink` from the `bot` service
- Keep only the `bot` service

### `Dockerfile`:
- Add FFmpeg installation (discord-player needs it locally)
```dockerfile
RUN apk add --no-cache ffmpeg
```

---

## Step 15: Update Environment Variables

### `.env.example`:
Remove all `LAVALINK_*` variables:
- `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`
- `LAVALINK_RECONNECT_*` settings
- `LAVALINK_SECURE`

Keep:
- `DISCORD_TOKEN`, `CLIENT_ID`
- `DEFAULT_SEARCH_PLATFORM` (map to discord-player search engine)
- `DEFAULT_VOLUME`
- `AUTOPLAY_DEFAULT`

---

## Step 16: Update Locale Strings

### `locales/en.json`:
Remove or replace:
- `LAVALINK_UNAVAILABLE` → `PLAYER_UNAVAILABLE` ("Music service is currently unavailable")
- `LAVALINK_TIMEOUT` → `SEARCH_TIMEOUT` ("The search took too long")
- `LAVALINK_RECONNECTING` → remove (no reconnection needed)
- `LAVALINK_PUBLIC_NODE_SWITCH` → remove

---

## Step 17: Verify & Test

1. `npm install` — ensure clean install
2. Start bot, run `/play` with a YouTube URL
3. Test `/skip`, `/pause`, `/stop`, `/volume`, `/loop`, `/shuffle`, `/queue`, `/clear`, `/back`
4. Test `/filter` — verify FFmpeg filter toggling works
5. Test `/search` — verify search results and selection
6. Test autoplay toggle
7. Test voice state updates (bot leaves when alone)
8. Test playlist URLs
9. Run in Docker to verify FFmpeg is available

---

## Migration Order (Recommended)

Execute in this order to minimize broken intermediate states:

1. **Step 1**: Update dependencies
2. **Step 2**: Delete Lavalink-only files
3. **Step 3**: Rewrite `src/index.js` (core bootstrap)
4. **Step 4**: Rewrite `src/utils/interactionHelpers.js` (shared helpers)
5. **Step 5**: Rewrite `src/commands/play.js` (most critical)
6. **Step 10**: Adapt `src/utils/PlayerController.js`
7. **Step 11**: Adapt `src/utils/PlayerActions.js`
8. **Step 7**: Adapt remaining commands (skip, pause, stop, volume, loop, shuffle, queue, clear, back, nowplaying, lyrics, autoplay)
9. **Step 6**: Rewrite `src/commands/search.js`
10. **Step 8**: Rewrite filter system
11. **Step 9**: Rewrite search navigation interaction
12. **Step 12**: Adapt autoplay
13. **Step 13**: Adapt voice state update
14. **Steps 14-16**: Docker, env vars, locale strings
15. **Step 17**: Test everything
