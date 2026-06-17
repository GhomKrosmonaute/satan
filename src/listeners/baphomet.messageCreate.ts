import config from "#config"
import * as command from "#core/command"
import env from "#core/env"
import { Listener } from "#core/listener"

import { deliverBaphometResponse } from "#namespaces/baphomet"

export default new Listener({
	event: "messageCreate",
	description:
		"Réponses de Baphomet quand le bot est mentionné ou de manière passive",
	async run(message) {
		if (config.ignoreBots && message.author.bot) return
		if (!command.isAnyMessage(message)) return

		const bot = message.client.user
		const hasMention = message.mentions.users.has(bot.id)

		const trimmed = message.content.trim()
		const prefix = config.getPrefix
			? await config.getPrefix(message)
			: env.BOT_PREFIX

		if (trimmed.startsWith(prefix)) return

		const barePing =
			hasMention && new RegExp(`^<@!?${bot.id}>\\s*$`).test(trimmed)

		if (hasMention && message.guild) {
			const atStartBot = new RegExp(`^<@!?${bot.id}>\\s*\\S`).test(trimmed)
			if (atStartBot && !barePing) return
		}

		const member = message.member ?? null
		const content = await deliverBaphometResponse({
			client: message.client,
			member,
			errorSource: "listeners/baphomet.messageCreate.ts",
			errorLogTitle: hasMention ? "Gemini (mention)" : "Gemini (passive)",
			channel: message.channel,
			userId: message.author.id,
			currentMessageId: message.id,
			rawMessage: message,
			context: {
				username: message.author.username,
				userMention: `${message.author}`,
				message: barePing ? "" : trimmed,
				source: hasMention ? "mention" : "passive",
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

		if (!content || content.trim().toUpperCase() === "IGNORE") return

		if (message.channel) {
			message.channel.sendTyping().catch(() => {})
		}

		await new Promise((resolve) => setTimeout(resolve, 1500))

		if (hasMention && barePing) {
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
			.reply({
				content,
				allowedMentions: { repliedUser: hasMention },
			})
			.catch(() => {})
	},
})
