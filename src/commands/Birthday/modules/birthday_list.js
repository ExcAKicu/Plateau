import { MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getAllBirthdays } from '../../../services/birthdayService.js';
import { deleteBirthday } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const guildId = interaction.guildId;
            
            
            const sortedBirthdays = await getAllBirthdays(client, guildId);

            if (sortedBirthdays.length === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({
                        title: '❌ Żadnych urodzin',
                        description: 'Na tym serwerze nie ustawiono jeszcze żadnych urodzin.',
                        color: 'error'
                    })]
                });
            }

            const embed = createEmbed({
                title: "🎂 Urodziny serwera",
                color: 'info'
            });

            // Batch fetch to verify which users are still in the guild
            const userIds = sortedBirthdays.map(b => b.userId);
            const fetchedMembers = await interaction.guild.members.fetch({ user: userIds }).catch(() => null);

            let birthdayList = '';
            let displayIndex = 0;
            const staleUserIds = [];

            for (const birthday of sortedBirthdays) {
                if (fetchedMembers && !fetchedMembers.has(birthday.userId)) {
                    staleUserIds.push(birthday.userId);
                    continue;
                }
                displayIndex++;
                birthdayList += `${displayIndex}. <@${birthday.userId}> - ${birthday.monthName} ${birthday.day}\n`;
            }

            // Clean up birthday entries for members who left the server
            if (fetchedMembers && staleUserIds.length > 0) {
                for (const userId of staleUserIds) {
                    deleteBirthday(client, guildId, userId).catch(() => null);
                }
            }

            if (displayIndex === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({
                        title: '❌ Żadnych urodzin',
                        description: 'Obecni członkowie serwera nie ustawili żadnych urodzin.',
                        color: 'error'
                    })]
                });
            }

            birthdayList = `**${displayIndex} birthday${displayIndex !== 1 ? 's' : ''} in ${interaction.guild.name}**\n\n` + birthdayList;

            embed.setDescription(birthdayList);
            embed.setFooter({ text: `Total: ${displayIndex} birthday${displayIndex !== 1 ? 's' : ''}` });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            
            logger.info('Birthday list retrieved successfully', {
                userId: interaction.user.id,
                guildId,
                birthdayCount: displayIndex,
                staleRemoved: staleUserIds.length,
                commandName: 'birthday_list'
            });
        } catch (error) {
            logger.error("Nie udało się wykonać polecenia listy urodzin", {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'birthday_list'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'birthday_list',
                source: 'birthday_list_module'
            });
        }
    }
};



