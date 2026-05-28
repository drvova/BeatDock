import { Player, useQueue, useHistory, type Track } from 'discord-player';
import { debug as logDebug, warn as logWarn } from './logger.js';

const YOUTUBE_VIDEO_PATTERN = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const YOUTUBE_CHANNEL_PATTERN = /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/;
const ISRC_PATTERN = /^[A-Z]{2}-?\w{3}-?\d{2}-?\d{5}$/;

function extractYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_VIDEO_PATTERN);
  return match ? match[1] : null;
}

function buildSearchQuery(track: Track, tier: number): string | null {
  switch (tier) {
    case 0: {
      const videoId = extractYouTubeId(track.url);
      if (videoId) return `https://music.youtube.com/watch?v=${videoId}&list=RDAMVM${videoId}`;
      return null;
    }
    case 1: {
      const isrc = (track.raw as any)?.isrc as string | undefined;
      if (isrc && ISRC_PATTERN.test(isrc)) return isrc;
      return null;
    }
    case 2: {
      const title = track.title;
      const author = track.author;
      if (title) return `${title} ${author || ''} audio`;
      return null;
    }
    default:
      return null;
  }
}

function isTrackDuplicate(candidate: Track, existing: Set<string>): boolean {
  return existing.has(candidate.id) || existing.has(candidate.url);
}

function isTrackAllowed(track: Track): boolean {
  // Filter out YouTube channels, livestreams, etc.
  if (YOUTUBE_CHANNEL_PATTERN.test(track.url)) return false;
  if (Number(track.duration) === 0) return false; // livestreams have 0 duration
  return true;
}

export async function findAutoplayTracks(
  discordPlayer: Player,
  guildId: string,
  lastPlayedTrack: Track
): Promise<Track[]> {
  const queue = useQueue(guildId);
  const history = useHistory(guildId);
  const existingIds = new Set<string>();

  if (queue?.currentTrack) {
    existingIds.add(queue.currentTrack.id);
    existingIds.add(queue.currentTrack.url);
  }
  if (queue) {
    for (const t of queue.tracks.toArray()) {
      existingIds.add(t.id);
      existingIds.add(t.url);
    }
  }
  if (history) {
    for (const t of history.tracks.toArray()) {
      existingIds.add(t.id);
      existingIds.add(t.url);
    }
  }

  const candidates: Track[] = [];
  const MAX_CANDIDATES = 5;

  for (let tier = 0; tier < 3 && candidates.length < MAX_CANDIDATES; tier++) {
    const query = buildSearchQuery(lastPlayedTrack, tier);
    if (!query) continue;

    try {
      const searchResult = await discordPlayer.search(query, {});
      if (!searchResult?.tracks?.length) continue;

      for (const track of searchResult.tracks) {
        if (candidates.length >= MAX_CANDIDATES) break;
        if (isTrackDuplicate(track, existingIds)) continue;
        if (!isTrackAllowed(track)) continue;

        candidates.push(track);
        existingIds.add(track.id);
        existingIds.add(track.url);
      }

      logDebug('autoplay', `Tier ${tier} found ${candidates.length} candidates from query: ${query}`);
    } catch (err) {
      logWarn('autoplay', `Tier ${tier} search failed: ${err}`);
    }
  }

  return candidates;
}
