import { MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getUpcomingBirthdays } from '../../../services/birthdayService.js';
import { deleteBirthday } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);
            
            
            const next5 = await getUpcomingBirthdays(client, interaction.guildId, 5);

            if (next5.length === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: '❌ Nie znaleziono urodzin',
                            description: 'Na tym serwerze nie ustawiono jeszcze żadnych urodzin. Użyj `/birthday set` aby dodać urodziny!',
                            color: 'error'
                        })
                    ]
                });
            }

            const embed = createEmbed({
                title: '🎂 Następne 5 nadchodzących urodzin',
                description: `Here are the next 5 birthdays in ${interaction.guild.name}:`,
                color: 'info'
            });

            let displayIndex = 0;
            for (const birthday of next5) {
                const member = await interaction.guild.members.fetch(birthday.userId).catch(() => null);
                if (!member) {
                    deleteBirthday(client, interaction.guildId, birthday.userId).catch(() => null);
                    continue;
                }
                displayIndex++;

                let timeUntil = '';
                if (birthday.daysUntil === 0) {
                    timeUntil = '🎉 **Today!**';
                } else if (birthday.daysUntil === 1) {
                    timeUntil = '📅 **Tomorrow!**';
                } else {
                    timeUntil = `In ${birthday.daysUntil} day${birthday.daysUntil > 1 ? 's' : ''}`;
                }

                embed.addFields({
                    name: `${displayIndex}. ${member.displayName}`,
                    value: `<@${birthday.userId}>\n📅 **Date:** ${birthday.monthName} ${birthday.day}\n⏰ **Time:** ${timeUntil}`,
                    inline: false
                });
            }

            if (displayIndex === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: '❌ Brak nadchodzących urodzin',
                            description: 'Nie znaleziono nadchodzących urodzin dla obecnych członków serwera.',
                            color: 'error'
                        })
                    ]
                });
            }

            embed.setFooter({
                text: 'Użyj /birthday set aby dodać swoje urodziny!',
                iconURL: interaction.guild.iconURL()
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            
            logger.info('Next birthdays retrieved successfully', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                upcomingCount: displayIndex,
                commandName: 'next_birthdays'
            });
        } catch (error) {
            logger.error('Next birthdays command execution failed', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'next_birthdays'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'next_birthdays',
                source: 'next_birthdays_module'
            });
        }
    }
};



