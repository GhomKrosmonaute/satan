import util from "node:util"
import discord from "discord.js"

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

const baphometCooldowns = new Map<string, number[]>()

function checkAndUpdateCooldown(userId: string): {
	allowed: boolean
	remainingMs?: number
} {
	const now = Date.now()
	const oneHour = 60 * 60 * 1000

	let timestamps = baphometCooldowns.get(userId) ?? []

	// Filter out timestamps older than 1 hour
	timestamps = timestamps.filter((t) => now - t < oneHour)

	if (timestamps.length >= 5) {
		const oldest = timestamps[0]
		const remainingMs = oneHour - (now - oldest)
		return { allowed: false, remainingMs }
	}

	timestamps.push(now)
	baphometCooldowns.set(userId, timestamps)
	return { allowed: true }
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
	rawMessage?: discord.Message | null
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
		rawMessage,
	} = options

	// Check for non-admin cooldown
	if (userId) {
		const isAdmin =
			member?.permissions.has(discord.PermissionFlagsBits.Administrator) ??
			false
		if (!isAdmin) {
			const cooldownStatus = checkAndUpdateCooldown(userId)
			if (!cooldownStatus.allowed && cooldownStatus.remainingMs) {
				const minutes = Math.ceil(cooldownStatus.remainingMs / (60 * 1000))
				return `${context.userMention}, calme ton impatience. Les murmures de l’abîme demandent du temps pour se former. Tu as dépassé la limite de 5 messages par heure. Réessaie dans ${minutes} minute${minutes > 1 ? "s" : ""}.`
			}
		}
	}

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

				// --- Mentions Parsing ---
				let targetUserId: string | undefined
				let targetChannelId: string | undefined
				let targetMessageId: string | undefined
				let targetMessageChannelId: string | undefined

				// 1. From native message mentions (if available)
				if (rawMessage) {
					// User mention (filter out bot itself and current speaking user)
					const userMention = rawMessage.mentions.users.find(
						(u) => u.id !== botId && u.id !== userId,
					)
					if (userMention) targetUserId = userMention.id

					// Channel mention
					const channelMention = rawMessage.mentions.channels.first()
					if (channelMention) targetChannelId = channelMention.id

					// Message reply reference
					if (rawMessage.reference?.messageId) {
						targetMessageId = rawMessage.reference.messageId
						targetMessageChannelId = rawMessage.reference.channelId
					}
				}

				// 2. Fallbacks: Regex parsing from the prompt text (handles slash command string mentions too)
				if (!targetUserId) {
					for (const match of context.message.matchAll(/<@!?(\d+)>/g)) {
						const id = match[1]
						if (id !== botId && id !== userId) {
							targetUserId = id
							break
						}
					}
				}

				if (!targetChannelId) {
					const channelRegex = /<#(\d+)>/
					const channelMatch = channelRegex.exec(context.message)
					if (channelMatch) targetChannelId = channelMatch[1]
				}

				if (!targetMessageId) {
					// Parsing Discord message link: https://discord.com/channels/guildId/channelId/messageId
					const messageRegex =
						/https:\/\/discord\.com\/channels\/\d+\/(\d+)\/(\d+)/
					const messageMatch = messageRegex.exec(context.message)
					if (messageMatch) {
						targetMessageChannelId = messageMatch[1]
						targetMessageId = messageMatch[2]
					}
				}

				// --- Mentioned User History Fetching ---
				if (targetUserId) {
					const mentionedUserHistoryRaw = sorted
						.filter(
							(m) => m.author.id === targetUserId && m.id !== currentMessageId,
						)
						.slice(0, 5)
						.reverse()

					context.mentionedUserHistory = mentionedUserHistoryRaw.map((m) => ({
						author: m.author.username,
						content: m.content,
						createdAt: m.createdAt,
					}))

					const fetchedUser = await client.users
						.fetch(targetUserId)
						.catch(() => null)
					context.mentionedUserUsername = fetchedUser?.username ?? "membre"
				}

				// --- Mentioned Channel History Fetching ---
				if (targetChannelId && targetChannelId !== channel.id) {
					const targetChannel = await client.channels
						.fetch(targetChannelId)
						.catch(() => null)
					if (targetChannel?.isTextBased()) {
						const otherFetched = await targetChannel.messages
							.fetch({ limit: 100 })
							.catch(() => null)
						if (otherFetched) {
							const otherSorted = Array.from(otherFetched.values()).sort(
								(a, b) => b.createdTimestamp - a.createdTimestamp,
							)
							const mentionedChannelHistoryRaw = otherSorted
								.slice(0, 5)
								.reverse()

							context.mentionedChannelHistory = mentionedChannelHistoryRaw.map(
								(m) => ({
									author: m.author.username,
									content: m.content,
									createdAt: m.createdAt,
								}),
							)
							context.mentionedChannelName =
								"name" in targetChannel ? String(targetChannel.name) : "salon"
						}
					}
				}

				// --- Mentioned Message History Fetching ---
				if (targetMessageId) {
					const msgChannelId = targetMessageChannelId ?? channel.id
					const msgChannel = await client.channels
						.fetch(msgChannelId)
						.catch(() => null)
					if (msgChannel?.isTextBased()) {
						const aroundFetched = await msgChannel.messages
							.fetch({ limit: 5, around: targetMessageId })
							.catch(() => null)
						if (aroundFetched) {
							const aroundSorted = Array.from(aroundFetched.values()).sort(
								(a, b) => a.createdTimestamp - b.createdTimestamp,
							)
							context.mentionedMessageHistory = aroundSorted.map((m) => ({
								author: m.author.username,
								content: m.content,
								createdAt: m.createdAt,
							}))
						}
					}
				}
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
