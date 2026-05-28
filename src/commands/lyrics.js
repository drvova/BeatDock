const { EmbedBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
    data: { name: 'lyrics', description: 'Get lyrics for the current or specified song' },
    async execute(interaction) {
        const { client, guild } = interaction;
        const queue = useQueue(guild.id);
        const track = queue?.currentTrack;

        const title = track?.title || null;
        const artist = track?.author || null;

        if (!title) {
            return interaction.reply({ content: client.t('NO_TRACK_PLAYING'), flags: 64 });
        }

        await interaction.deferReply();

        try {
            const cleanTitle = title.replace(/\(.*?\)|\[.*?\]|feat\..*$/gi, '').trim();
            const cleanArtist = artist?.replace(/\s*(-\s*Topic)?$/i, '').trim();

            let lyrics = null;

            const params = new URLSearchParams({ track_name: cleanTitle, artist_name: cleanArtist || '' });
            const lrclibUrl = `https://lrclib.net/api/get?${params}`;
            const lrclibResponse = await fetch(lrclibUrl, {
                headers: { 'User-Agent': 'BeatDock/2.0 (https://github.com/beatdock)' },
            });

            if (lrclibResponse.ok) {
                const lrclibData = await lrclibResponse.json();
                lyrics = lrclibData.plainLyrics || lrclibData.syncedLyrics || null;
            }

            if (!lyrics) {
                const searchParams = new URLSearchParams({ q: `${cleanTitle} ${cleanArtist || ''}`.trim() });
                const searchResponse = await fetch(`https://lrclib.net/api/search?${searchParams}`, {
                    headers: { 'User-Agent': 'BeatDock/2.0 (https://github.com/beatdock)' },
                });

                if (searchResponse.ok) {
                    const searchResults = await searchResponse.json();
                    if (searchResults.length > 0) {
                        lyrics = searchResults[0].plainLyrics || searchResults[0].syncedLyrics || null;
                    }
                }
            }

            if (!lyrics) {
                return interaction.editReply({ content: client.t('LYRICS_NOT_FOUND') });
            }

            const formattedLyrics = lyrics.replace(/\r\n/g, '\n');
            const maxFieldLength = 4096;

            const embed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setTitle(client.t('LYRICS_FOR', title))
                .setURL(track?.url || null);

            if (formattedLyrics.length <= maxFieldLength) {
                embed.setDescription(formattedLyrics);
            } else {
                const chunks = [];
                let current = '';
                for (const line of formattedLyrics.split('\n')) {
                    if ((current + '\n' + line).length > maxFieldLength - 10) {
                        chunks.push(current);
                        current = line;
                    } else {
                        current = current ? current + '\n' + line : line;
                    }
                }
                if (current) chunks.push(current);

                embed.setDescription(chunks[0]);
                for (let i = 1; i < chunks.length && i < 3; i++) {
                    embed.addFields({ name: i === 1 ? '...' : '...(cont)', value: chunks[i] });
                }
            }

            embed.setFooter({ text: client.t('LYRICS_SOURCE_LRCLIB') });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ content: client.t('LYRICS_FETCH_ERROR') });
        }
    },
};
