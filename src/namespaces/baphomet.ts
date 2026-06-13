import util from "node:util"
import type discord from "discord.js"

import logger from "#core/logger"

import { executeBaphometModeration } from "#namespaces/baphometModeration"
import {
	type BaphometContext,
	baphometFallback,
	decideBaphometActions,
	generateBaphometReply,
} from "#namespaces/gemini"
import { sendLog } from "#namespaces/tst"

const DISCORD_MESSAGE_LIMIT = 2000

export type BaphometDeliveryContext = BaphometContext & {
	moderationAvailable: boolean
}

function truncateForDiscord(content: string): string {
	if (content.length <= DISCORD_MESSAGE_LIMIT) return content
	return `${content.slice(0, DISCORD_MESSAGE_LIMIT - 1)}…`
}

export async function deliverBaphometResponse(options: {
	client: discord.Client
	context: BaphometDeliveryContext
	member?: discord.GuildMember | null
	errorSource: string
	errorLogTitle: string
	channel?: discord.TextBasedChannel | null
	userId?: string
	currentMessageId?: string
}): Promise<string> {
	const {
		client,
		context,
		member,
		errorSource,
		errorLogTitle,
		channel,
		userId,
		currentMessageId,
	} = options

	if (channel && userId) {
		try {
			const fetched = await channel.messages
				.fetch({ limit: 100 })
				.catch(() => null)
			if (fetched) {
				const botId = client.user?.id
				const sorted = Array.from(fetched.values()).sort(
					(a, b) => b.createdTimestamp - a.createdTimestamp,
				)

				const channelHistoryRaw = sorted
					.filter(
						(m) =>
							m.id !== currentMessageId &&
							(!botId || m.author.id !== botId) &&
							m.author.id !== userId,
					)
					.slice(0, 5)
					.reverse()

				const botHistoryRaw = botId
					? sorted
							.filter((m) => m.author.id === botId && m.id !== currentMessageId)
							.slice(0, 5)
							.reverse()
					: []

				const userHistoryRaw = sorted
					.filter((m) => m.author.id === userId && m.id !== currentMessageId)
					.slice(0, 5)
					.reverse()

				context.channelHistory = channelHistoryRaw.map((m) => ({
					author: m.author.username,
					content: m.content,
					createdAt: m.createdAt,
				}))

				context.botHistory = botHistoryRaw.map((m) => ({
					author: m.author.username,
					content: m.content,
					createdAt: m.createdAt,
				}))

				context.userHistory = userHistoryRaw.map((m) => ({
					author: m.author.username,
					content: m.content,
					createdAt: m.createdAt,
				}))
			}
		} catch (err) {
			logger.error(
				`Error fetching baphomet message history: ${err}`,
				errorSource,
			)
		}
	}

	try {
		if (member && context.moderationAvailable) {
			const decision = await decideBaphometActions(context)

			if (decision.actions.length > 0) {
				const outcome = await executeBaphometModeration(
					member,
					decision.actions,
				)
				const text = await generateBaphometReply({
					...context,
					moderationOutcome: outcome,
				})
				return truncateForDiscord(text)
			}

			return truncateForDiscord(decision.text)
		}

		const text = await generateBaphometReply(context)
		return truncateForDiscord(text)
	} catch (err) {
		const detail = util.inspect(err, {
			depth: 5,
			colors: false,
			compact: false,
		})
		logger.error(
			`${errorLogTitle} fallback for ${context.username}: ${detail}`,
			errorSource,
		)
		await sendLog(
			client,
			"error",
			`**${errorLogTitle}** — échec pour **${context.username}**.\n\`\`\`\n${detail.slice(0, 3500)}\n\`\`\``,
		).catch(() => {})

		return baphometFallback(context.userMention)
	}
}
