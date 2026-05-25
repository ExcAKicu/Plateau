import { MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { deleteBirthday } from '../../../services/birthdayService.js';
import { logger } from '../../../utils/logger.js';
import { handleInteractionError } from '../../../utils/errorHandler.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
export default {
    async execute(interaction, config, client) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const userId = interaction.user.id;
            const guildId = interaction.guildId;

            
            const result = await deleteBirthday(client, guildId, userId);

            if (result.success) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed(
                        "Twoja data urodzenia została pomyślnie usunięta z serwera.",
                        "Urodziny usunięte 🗑️"
                    )]
                });
            } else if (result.notFound) {
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [createEmbed({
                        title: '❌ Nie znaleziono urodzin',
                        description: "Nie masz ustawionej daty urodzenia do usunięcia.",
                        color: 'error'
                    })]
                });
            }
        } catch (error) {
            logger.error("Wykonanie polecenia usunięcia urodzin nie powiodło się", {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'birthday_remove'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'birthday_remove',
                source: 'birthday_remove_module'
            });
        }
    }
};



