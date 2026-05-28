const { useQueue, useHistory } = require('discord-player');
const logger = require('./logger');

const YOUTUBE_VIDEO_PATTERN = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;
const YOUTUBE_CHANNEL_PATTERN = /youtube\.com\/channel\/([\w-]+)/;
const ISRC_PATTERN = /^[A-Z]{2}-?\w{3}-?\d{2}-?\d{5}$/;

function extractYouTubeId(uri) {
    if (!uri) return null;
    const match = uri.match(YOUTUBE_VIDEO_PATTERN);
    return match ? match[1] : null;
}

function buildSearchQuery(track) {
    const parts = [];
    if (track.author && track.title) {
        if (YOUTUBE_CHANNEL_PATTERN.test(track.url || '')) {
            parts.push(`${track.author} - ${track.title}`);
        } else {
            const authorName = track.author.replace(/\s*(-\s*Topic)?$/i, '').trim();
            parts.push(`${authorName} - ${track.title}`);
        }
    } else if (track.title) {
        parts.push(track.title);
    }
    if (parts.length > 0) return parts.join(' ');

    if (track.author) return track.author;
    return track.title || 'unknown';
}

function isTrackDuplicate(candidate, existingTracks) {
    return existingTracks.some(t =>
        t.id === candidate.id ||
        (t.title === candidate.title && t.author === candidate.author)
    );
}

function isTrackAllowed(track) {
    return !YOUTUBE_CHANNEL_PATTERN.test(track.url || '');
}

async function findAutoplayTracks(discordPlayer, guildId, lastPlayedTrack) {
    const MAX_RETRIES = 3;
    const tracksPerRetry = 5;

    if (!lastPlayedTrack) {
        logger.warn('[Autoplay] No last played track');
        return [];
    }

    if (!isTrackAllowed(lastPlayedTrack)) {
        logger.warn(`[Autoplay] Skipping channel track: ${lastPlayedTrack.title}`);
        return [];
    }

    const queue = useQueue(guildId);
    const history = useHistory(guildId);

    const existingTracks = [];
    if (queue?.currentTrack) existingTracks.push(queue.currentTrack);
    if (queue?.tracks) existingTracks.push(...queue.tracks.toArray());
    if (history) {
        const prevTracks = history.previous();
        if (prevTracks) existingTracks.push(...prevTracks);
    }

    const existingIds = new Set(existingTracks.map(t => t.id).filter(Boolean));
    const existingTitles = new Set(existingTracks.map(t => `${t.title}|${t.author}`.toLowerCase()));

    function isDuplicate(candidate) {
        if (existingIds.has(candidate.id)) return true;
        const key = `${candidate.title}|${candidate.author}`.toLowerCase();
        return existingTitles.has(key);
    }

    async function searchWithMix() {
        const videoId = extractYouTubeId(lastPlayedTrack.url);
        if (!videoId) return null;

        const mixUrl = `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`;
        logger.debug(`[Autoplay] Searching with mix: ${mixUrl}`);

        try {
            const result = await discordPlayer.search(mixUrl, {});
            if (!result?.tracks || result.tracks.length === 0) return null;

            return result.tracks
                .filter(t => t.id !== lastPlayedTrack.id)
                .filter(t => isTrackAllowed(t))
                .filter(t => !isDuplicate(t))
                .slice(0, tracksPerRetry);
        } catch (err) {
            logger.warn(`[Autoplay] Mix search failed: ${err.message}`);
            return null;
        }
    }

    async function searchWithISRC() {
        const raw = lastPlayedTrack.raw;
        const isrc = raw?.isrc;
        if (!isrc || !ISRC_PATTERN.test(isrc)) return null;

        const query = `https://music.youtube.com/search?q=${encodeURIComponent(`isrc:${isrc}`)}`;
        logger.debug(`[Autoplay] Searching with ISRC: ${isrc}`);

        try {
            const result = await discordPlayer.search(query, {});
            if (!result?.tracks || result.tracks.length === 0) return null;

            return result.tracks
                .filter(t => t.id !== lastPlayedTrack.id)
                .filter(t => isTrackAllowed(t))
                .filter(t => !isDuplicate(t))
                .slice(0, tracksPerRetry);
        } catch (err) {
            logger.warn(`[Autoplay] ISRC search failed: ${err.message}`);
            return null;
        }
    }

    async function searchWithYouTubeMusic() {
        const query = buildSearchQuery(lastPlayedTrack);
        if (!query || query === 'unknown') return null;

        const searchQuery = `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
        logger.debug(`[Autoplay] Searching YouTube Music: ${query}`);

        try {
            const result = await discordPlayer.search(searchQuery, {});
            if (!result?.tracks || result.tracks.length === 0) return null;

            return result.tracks
                .filter(t => t.id !== lastPlayedTrack.id)
                .filter(t => isTrackAllowed(t))
                .filter(t => !isDuplicate(t))
                .slice(0, tracksPerRetry);
        } catch (err) {
            logger.warn(`[Autoplay] YouTube Music search failed: ${err.message}`);
            return null;
        }
    }

    try {
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            logger.debug(`[Autoplay] Recommendation attempt ${attempt + 1}/${MAX_RETRIES}`);

            const mixTracks = await searchWithMix();
            if (mixTracks && mixTracks.length > 0) {
                logger.autoplay(`Found ${mixTracks.length} tracks from mix (attempt ${attempt + 1})`);
                return mixTracks;
            }

            const isrcTracks = await searchWithISRC();
            if (isrcTracks && isrcTracks.length > 0) {
                logger.autoplay(`Found ${isrcTracks.length} tracks from ISRC (attempt ${attempt + 1})`);
                return isrcTracks;
            }

            const ytmTracks = await searchWithYouTubeMusic();
            if (ytmTracks && ytmTracks.length > 0) {
                logger.autoplay(`Found ${ytmTracks.length} tracks from YouTube Music (attempt ${attempt + 1})`);
                return ytmTracks;
            }

            logger.warn(`[Autoplay] No tracks found in attempt ${attempt + 1}`);
        }

        logger.warn(`[Autoplay] No tracks found after ${MAX_RETRIES} attempts`);
        return [];
    } catch (err) {
        logger.error(`[Autoplay] Error in findAutoplayTracks: ${err.message}`);
        return [];
    }
}

module.exports = { findAutoplayTracks };
