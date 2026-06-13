import config from "#config"
import * as command from "#core/command"
import env from "#core/env"
import { Listener } from "#core/listener"

import { deliverBaphometResponse } from "#namespaces/baphomet"

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

		const member = message.member ?? null
		const content = await deliverBaphometResponse({
			client: message.client,
			member,
			errorSource: "listeners/baphomet.messageCreate.ts",
			errorLogTitle: "Gemini (mention)",
			context: {
				username: message.author.username,
				userMention: `${message.author}`,
				message: barePing ? "" : trimmed,
				source: "mention",
				prefix,
				guildName: message.guild?.name,
				channelName:
					message.channel && "name" in message.channel
						? String((message.channel as any).name)
						: message.guild
							? undefined
							: "message privé",
				moderationAvailable: !!member,
			},
		})

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
