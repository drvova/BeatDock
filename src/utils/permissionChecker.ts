import type { GuildMember, PermissionsBitField } from 'discord.js';

const ALLOWED_ROLES: string[] = process.env.ALLOWED_ROLES
  ? process.env.ALLOWED_ROLES.split(',').map(r => r.trim()).filter(Boolean)
  : [];

export function isAdmin(permissions: Readonly<PermissionsBitField>): boolean {
  return permissions.has('Administrator');
}

export function hasPermission(member: GuildMember): boolean {
  if (isAdmin(member.permissions)) return true;
  if (ALLOWED_ROLES.length === 0) return true;
  return member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));
}

export async function checkInteractionPermission(
  interaction: import('discord.js').ChatInputCommandInteraction | import('discord.js').ButtonInteraction | import('discord.js').StringSelectMenuInteraction
): Promise<boolean> {
  const member = interaction.member as GuildMember;
  if (!hasPermission(member)) {
    await interaction.reply({
      content: `❌ ${'NO_PERMISSION'}`,
      ephemeral: true,
    });
    return false;
  }
  return true;
}
