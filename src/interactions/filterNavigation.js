const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { requirePlayer, requireSameVoice } = require('../utils/interactionHelpers');

const EFFECTS = {
    bassboost: { label: 'Bass Boost', emoji: '🔈' },
    nightcore: { label: 'Nightcore', emoji: '🌙' },
    vaporwave: { label: 'Vaporwave', emoji: '🌊' },
    '8d': { label: '8D Audio', emoji: '🎧' },
    karaoke: { label: 'Karaoke', emoji: '🎤' },
    tremolo: { label: 'Tremolo', emoji: '📳' },
    vibrato: { label: 'Vibrato', emoji: '〰️' },
    lowpass: { label: 'Low Pass', emoji: '🔉' },
    reset: { label: 'Reset All', emoji: '🔄' },
};

const FILTER_MAP = {
    bassboost: ['bassboost'],
    nightcore: ['nightcore'],
    vaporwave: ['vaporwave'],
    '8d': ['8d'],
    karaoke: ['karaoke'],
    tremolo: ['tremolo'],
    vibrato: ['vibrato'],
    lowpass: ['lowpass'],
};

const CUSTOM_FFMPEG_FILTERS = {
    vaporwave: 'aresample=48000,asetrate=48000*0.8,atempo=1.25,aresample=48000',
    '8d': 'apulsator=mode=sine:hz=0.08',
    karaoke: 'pan=stereo|c0=c0-c1|c1=c1-c0',
    tremolo: 'tremolo=f=5:0.5',
    vibrato: 'vibrato=f=5:d=0.5',
    lowpass: 'lowpass=f=500',
};

function isFilterActive(queue, key) {
    if (!queue?.filters?.ffmpeg) return false;
    try {
        if (['bassboost', 'nightcore'].includes(key)) {
            return queue.filters.ffmpeg.isEnabled(key);
        }
        return queue.filters.ffmpeg.isEnabled(key);
    } catch {
        return false;
    }
}

function getFilterLabel(key) {
    const effect = EFFECTS[key];
    return effect ? effect.label : key;
}

function buildFilterResponse(client, queue, page = 1) {
    const effectKeys = Object.keys(EFFECTS);
    const itemsPerPage = 5;
    const totalPages = Math.ceil(effectKeys.length / itemsPerPage);
    const safePage = Math.max(1, Math.min(page, totalPages));
    const start = (safePage - 1) * itemsPerPage;
    const pageKeys = effectKeys.slice(start, start + itemsPerPage);

    const statusLines = pageKeys.map(key => {
        if (key === 'reset') return `${EFFECTS[key].emoji} ${EFFECTS[key].label}`;
        const active = isFilterActive(queue, key);
        return `${EFFECTS[key].emoji} ${EFFECTS[key].label}: ${active ? '✅ ON' : '❌ OFF'}`;
    });

    const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(client.t('FILTER_TITLE'))
        .setDescription(statusLines.join('\n'))
        .setFooter({ text: client.t('PAGE_INFO', safePage, totalPages) });

    const buttonRows = [];
    const row = new ActionRowBuilder();
    for (const key of pageKeys) {
        const active = key === 'reset' ? false : isFilterActive(queue, key);
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`filter_${key}`)
                .setLabel(EFFECTS[key].label)
                .setEmoji(EFFECTS[key].emoji)
                .setStyle(key === 'reset' ? ButtonStyle.Danger : (active ? ButtonStyle.Success : ButtonStyle.Secondary)),
        );
    }
    buttonRows.push(row);

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`filter_prev_${safePage}`)
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage <= 1),
        new ButtonBuilder()
            .setCustomId(`filter_next_${safePage}`)
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage >= totalPages),
    );
    buttonRows.push(navRow);

    return { embeds: [embed], components: buttonRows };
}

async function applyFilter(queue, key) {
    if (key === 'reset') {
        try { queue.filters.ffmpeg.setFilters([]); } catch { /* ignore */ }
        return;
    }

    const filterNames = FILTER_MAP[key];
    if (!filterNames) return;

    try {
        queue.filters.ffmpeg.toggle(filterNames);
    } catch {
        // Filter not available in current extractor
    }
}

async function handleFilterNavigation(interaction) {
    const { client, guild, customId } = interaction;
    const queue = await requirePlayer(interaction);
    if (!queue) return;
    if (!(await requireSameVoice(interaction, queue))) return;

    if (customId === 'filter_reset') {
        await applyFilter(queue, 'reset');
        const response = buildFilterResponse(client, queue, 1);
        return interaction.update(response);
    }

    if (customId.startsWith('filter_prev_') || customId.startsWith('filter_next_')) {
        const parts = customId.split('_');
        const currentPage = parseInt(parts[2], 10);
        const newPage = customId.startsWith('filter_prev_') ? currentPage - 1 : currentPage + 1;
        const response = buildFilterResponse(client, queue, newPage);
        return interaction.update(response);
    }

    if (customId.startsWith('filter_')) {
        const key = customId.replace('filter_', '');
        if (EFFECTS[key]) {
            await applyFilter(queue, key);
            const currentPage = 1;
            const response = buildFilterResponse(client, queue, currentPage);
            return interaction.update(response);
        }
    }
}

module.exports = { buildFilterResponse, applyFilter, getFilterLabel, handleFilterNavigation, EFFECTS };
