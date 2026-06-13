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
}): Promise<string> {
	const { client, context, member, errorSource, errorLogTitle } = options

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
