import util from "node:util"
import config from "#config"
import * as command from "#core/command"
import env from "#core/env"
import { Listener } from "#core/listener"
import logger from "#core/logger"

import { generateMentionReply } from "#namespaces/openai"
import { sendLog } from "#namespaces/tst"

export default new Listener({
	event: "messageCreate",
	description:
		"Réponses de Baphomet quand le bot est mentionné (hors lignes de commande)",
	async run(message) {
		if (config.ignoreBots && message.author.bot) return
		if (!command.isAnyMessage(message)) return

		const bot = message.client.user
		if (!message.mentions.users.has(bot.id)) return

		const trimmed = message.content.trim()
		const barePing = new RegExp(`^<@!?${bot.id}>\\s*$`).test(trimmed)

		const prefix = config.getPrefix
			? await config.getPrefix(message)
			: env.BOT_PREFIX

		if (trimmed.startsWith(prefix)) return

		if (message.guild) {
			const atStartBot = new RegExp(`^<@!?${bot.id}>\\s*\\S`).test(trimmed)
			if (atStartBot && !barePing) return
		}

		let content: string
		try {
			content = await generateMentionReply({
				username: message.author.username,
				userMention: `${message.author}`,
				message: barePing ? "" : trimmed,
				prefix,
				guildName: message.guild?.name,
				channelName:
					message.channel && "name" in message.channel
						? String((message.channel as any).name)
						: undefined,
			})
		} catch (err) {
			const detail = util.inspect(err, {
				depth: 5,
				colors: false,
				compact: false,
			})
			logger.error(
				`Mention OpenAI fallback for ${message.author.username} (${message.author.id}): ${detail}`,
				"listeners/baphomet.messageCreate.ts",
			)
			await sendLog(
				message.client,
				"error",
				`**OpenAI (mention)** — échec de génération.\n\`\`\`\n${detail.slice(0, 3500)}\n\`\`\``,
			)
			content = `${message.author}, je t’entends… mais le souffle s’est brisé. Réessaie en une phrase claire.`
		}

		// Le listener natif répond au ping nu avec un message "prefix".
		// Sans toucher aux fichiers .native.ts, on supprime ce message si on le détecte.
		if (barePing) {
			setTimeout(() => {
				message.channel.messages
					.fetch({ limit: 5 })
					.then((msgs) => {
						const toDelete = msgs.find(
							(m) =>
								m.author.id === message.client.user.id &&
								m.id !== message.id &&
								/^(?:My prefix is )/i.test((m.content ?? "").trim()),
						)
						toDelete?.delete().catch(() => {})
					})
					.catch(() => {})
			}, 250)
		}

		await message
			.reply({ content, allowedMentions: { repliedUser: true } })
			.catch(() => {})
	},
})
