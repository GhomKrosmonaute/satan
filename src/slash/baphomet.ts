import env from "#core/env"
import { SlashCommand } from "#core/slash"

import { deliverBaphometResponse } from "#namespaces/baphomet"

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
		const message = interaction.options.getString("message", true)

		await interaction.deferReply()

		const member = interaction.inGuild()
			? await interaction
					.guild!.members.fetch(interaction.user.id)
					.catch(() => null)
			: null

		const content = await deliverBaphometResponse({
			client: interaction.client,
			member,
			errorSource: "slash/baphomet.ts",
			errorLogTitle: "Gemini (/baphomet)",
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

		return interaction.editReply({
			content,
			allowedMentions: { users: [interaction.user.id] },
		})
	},
})
