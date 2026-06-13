import util from "node:util"

import logger from "#core/logger"
import { SlashCommand } from "#core/slash"

import { generateConversationReply } from "#namespaces/gemini"
import { sendLog } from "#namespaces/tst"

const DISCORD_MESSAGE_LIMIT = 2000

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

		let content: string
		try {
			content = await generateConversationReply({
				username: interaction.user.username,
				userMention: `${interaction.user}`,
				message,
				guildName: interaction.guild?.name,
				channelName:
					interaction.channel && "name" in interaction.channel
						? String(interaction.channel.name)
						: undefined,
			})
		} catch (err) {
			const detail = util.inspect(err, {
				depth: 5,
				colors: false,
				compact: false,
			})
			logger.error(
				`Slash Baphomet Gemini fallback for ${interaction.user.username} (${interaction.user.id}): ${detail}`,
				"slash/baphomet.ts",
			)
			await sendLog(
				interaction.client,
				"error",
				`**Gemini (/baphomet)** — échec de génération pour **${interaction.user.username}** (\`${interaction.user.id}\`).\n\`\`\`\n${detail.slice(0, 3500)}\n\`\`\``,
			)
			content = `${interaction.user}, je t’entends… mais le souffle s’est brisé. Réessaie en une phrase claire.`
		}

		if (content.length > DISCORD_MESSAGE_LIMIT) {
			content = `${content.slice(0, DISCORD_MESSAGE_LIMIT - 1)}…`
		}

		return interaction.editReply({
			content,
			allowedMentions: { users: [interaction.user.id] },
		})
	},
})
