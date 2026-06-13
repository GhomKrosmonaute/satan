import discord from "discord.js"

import env from "#core/env"
import logger from "#core/logger"
import { SlashCommand } from "#core/slash"

import { deliverBaphometResponse } from "#namespaces/baphomet"

async function safeEditReply(
	interaction: discord.ChatInputCommandInteraction,
	content: string,
) {
	if (!interaction.deferred || interaction.replied) return

	await interaction
		.editReply({
			content,
			allowedMentions: { users: [interaction.user.id] },
		})
		.catch((err) => {
			logger.error(err, "slash/baphomet.ts")
		})
}

export default new SlashCommand({
	name: "baphomet",
	description: "Parle à Baphomet, sage gardien du Temple",
	build: (builder) =>
		builder.addStringOption((option) =>
			option
				.setName("message")
				.setDescription("Ce que tu veux demander ou dire à Baphomet")
				.setRequired(true)
				.setMaxLength(500),
		),
	async run(interaction) {
		if (!interaction.deferred && !interaction.replied) {
			await interaction.deferReply().catch((err) => {
				logger.error(err, "slash/baphomet.ts")
			})
		}

		if (!interaction.deferred && !interaction.replied) return

		const message = interaction.options.getString("message", true)

		const member =
			interaction.inGuild() && interaction.member instanceof discord.GuildMember
				? interaction.member
				: interaction.inGuild()
					? await interaction
							.guild!.members.fetch(interaction.user.id)
							.catch(() => null)
					: null

		const content = await deliverBaphometResponse({
			client: interaction.client,
			member,
			errorSource: "slash/baphomet.ts",
			errorLogTitle: "Gemini (/baphomet)",
			channel: interaction.channel,
			userId: interaction.user.id,
			context: {
				username: interaction.user.username,
				userMention: `${interaction.user}`,
				message,
				source: "slash",
				prefix: env.BOT_PREFIX,
				guildName: interaction.guild?.name,
				channelName:
					interaction.channel && "name" in interaction.channel
						? String(interaction.channel.name)
						: interaction.guild
							? undefined
							: "message privé",
				moderationAvailable: !!member,
			},
		})

		await safeEditReply(interaction, content)
	},
})
