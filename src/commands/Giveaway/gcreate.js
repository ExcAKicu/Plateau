import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { saveGiveaway } from '../../utils/giveaways.js';
import { 
    parseDuration, 
    validatePrize, 
    validateWinnerCount,
    createGiveawayEmbed, 
    createGiveawayButtons 
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("gcreate")
        .setDescription("Rozpoczyna nowy konkurs w wybranym kanale.")
        .addStringOption((option) =>
            option
                .setName("duration")
                .setDescription("Jak długo ma trwać konkurs (np. 1h, 30m, 5d).")
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName("winners")
                .setDescription("Liczba zwycięzców do wybrania.")
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("prize")
                .setDescription("Nagroda w konkursie.")
                .setRequired(true),
        )
        .addChannelOption((option) =>
            option
                .setName("channel")
                .setDescription("Kanał, na który ma zostać wysłany konkurs (domyślnie bieżący kanał).")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        try {
            if (!interaction.inGuild()) {
                throw new TitanBotError(
                    'Komenda konkursu użyta poza serwerem',
                    ErrorTypes.VALIDATION,
                    'Ta komenda może być używana tylko na serwerze.',
                    { userId: interaction.user.id }
                );
            }

            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                throw new TitanBotError(
                    'Użytkownik nie ma uprawnienia Manage Server',
                    ErrorTypes.PERMISSION,
                    "Potrzebujesz uprawnienia „Zarządzanie serwerem”, aby rozpocząć konkurs.",
                    { userId: interaction.user.id, guildId: interaction.guildId }
                );
            }

            logger.info(`Tworzenie konkursu rozpoczęte przez ${interaction.user.tag} na serwerze ${interaction.guildId}`);

            const durationString = interaction.options.getString("duration");
            const winnerCount = interaction.options.getInteger("winners");
            const prize = interaction.options.getString("prize");
            const targetChannel = interaction.options.getChannel("channel") || interaction.channel;

            const durationMs = parseDuration(durationString);
            validateWinnerCount(winnerCount);
            const prizeName = validatePrize(prize);

            if (!targetChannel.isTextBased()) {
                throw new TitanBotError(
                    'Wybrany kanał nie jest tekstowy',
                    ErrorTypes.VALIDATION,
                    'Kanał musi być tekstowy.',
                    { channelId: targetChannel.id, channelType: targetChannel.type }
                );
            }

            const endTime = Date.now() + durationMs;

            const initialGiveawayData = {
                messageId: "placeholder",
                channelId: targetChannel.id,
                guildId: interaction.guildId,
                prize: prizeName,
                hostId: interaction.user.id,
                endTime: endTime,
                endsAt: endTime,
                winnerCount: winnerCount,
                participants: [],
                isEnded: false,
                ended: false,
                createdAt: new Date().toISOString()
            };

            const embed = createGiveawayEmbed(initialGiveawayData, "active");
            const row = createGiveawayButtons(false);

            const giveawayMessage = await targetChannel.send({
                content: "🎉 **NOWY KONKURS** 🎉",
                embeds: [embed],
                components: [row],
            });

            initialGiveawayData.messageId = giveawayMessage.id;
            const saved = await saveGiveaway(
                interaction.client,
                interaction.guildId,
                initialGiveawayData,
            );

            if (!saved) {
                logger.warn(`Nie udało się zapisać konkursu w bazie danych: ${giveawayMessage.id}`);
            }

            try {
                await logEvent({
                    client: interaction.client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_CREATE,
                    data: {
                        description: `Utworzono konkurs: ${prizeName}`,
                        channelId: targetChannel.id,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: '🎁 Nagroda',
                                value: prizeName,
                                inline: true
                            },
                            {
                                name: '🏆 Zwycięzcy',
                                value: winnerCount.toString(),
                                inline: true
                            },
                            {
                                name: '⏰ Czas trwania',
                                value: durationString,
                                inline: true
                            },
                            {
                                name: '📍 Kanał',
                                value: targetChannel.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Błąd podczas logowania zdarzenia konkursu:', logError);
            }

            logger.info(`Konkurs został pomyślnie utworzony: ${giveawayMessage.id} na kanale ${targetChannel.name}`);

            await InteractionHelper.safeReply(interaction, {
                embeds: [
                    successEmbed(
                        `Konkurs rozpoczęty! 🎉`,
                        `Nowy konkurs o nagrodę **${prizeName}** został rozpoczęty na kanale ${targetChannel} i zakończy się za **${durationString}**.`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });

        } catch (error) {
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'gcreate',
                context: 'giveaway_creation'
            });
        }
    },
};
