import discord from "discord.js"

import logger from "#core/logger"
import users from "#tables/user"

import { roles, sendableChannels } from "#namespaces/tst"

export const APPROVE_EMOJI = "✅"
export const DISAPPROVE_EMOJI = "❌"
export const PRESENTATION_MIN_LENGTH = 150

export async function approveMember(
	member: discord.GuildMember,
	presentation?: discord.Message,
) {
	await users.query
		.insert({
			id: member.id,
			presentation_id: presentation?.id ?? null,
		})
		.onConflict("id")
		.merge(["presentation_id"])

	await member.fetch(true)

	try {
		await member.roles.set([
			roles.member,
			...member.roles.cache
				.filter((role) => role.id !== roles.awaitValidation)
				.map((role) => role.id),
		])
	} catch {
		logger.error(
			`Failed to set roles for ${member.user.username} in ${member.guild.name}`,
			"namespaces/presentation.ts",
		)
	}

	if (presentation) {
		for (const emoji of [APPROVE_EMOJI, DISAPPROVE_EMOJI]) {
			await presentation.reactions.cache
				.get(emoji)
				?.users.remove(member.client.user.id)
				.catch(() => {})
		}
	}

	const general = member.client.channels.cache.get(sendableChannels.general)

	if (general?.isSendable()) {
		await general
			.send({
				embeds: [
					new discord.EmbedBuilder()
						.setColor(0x8b0000)
						.setDescription(
							`🐐 *Les portes du Temple s'ouvrent.*\n\nBienvenue parmi nous, ${member.user}. Baphomet accueille ton esprit libre — que la raison guide tes pas et que le savoir t'arme.`,
						)
						.setThumbnail(member.user.displayAvatarURL())
						.setTimestamp(),
				],
			})
			.catch(() => {})
	}

	await sendLog(
		member.client,
		"approve",
		`**${member.user.username}** (\`${member.id}\`) a été approuvé(e) et a reçu le rôle membre.`,
	)
}

export async function disapproveMember(
	member: discord.GuildMember,
	presentation: discord.Message,
) {
	await users.query.delete().where({ id: member.id })

	const excerpt =
		presentation.content.slice(0, 900) +
		(presentation.content.length > 900 ? "…" : "")

	await sendLog(
		member.client,
		"disapprove",
		`**${member.user.username}** (\`${member.id}\`) a été refusé(e) et expulsé(e).\n\n**Présentation :**\n\`\`\`\n${excerpt}\n\`\`\``,
	)

	await member.kick("Présentation refusée")

	await presentation.delete().catch(() => {})
}

export async function logTooShort(
	client: discord.Client,
	user: discord.User,
	content: string,
) {
	const excerpt = content.slice(0, 900) + (content.length > 900 ? "…" : "")

	await sendLog(
		client,
		"too-short",
		`**${user.username}** (\`${user.id}\`) a soumis une présentation trop courte (**${content.length}**/${PRESENTATION_MIN_LENGTH} caractères).\n\n**Contenu :**\n\`\`\`\n${excerpt}\n\`\`\``,
	)
}

type LogType = "approve" | "disapprove" | "too-short" | "auto-approve"

const LOG_COLORS: Record<LogType, number> = {
	approve: 0x2ecc71,
	disapprove: 0xe74c3c,
	"too-short": 0xe67e22,
	"auto-approve": 0x3498db,
}

const LOG_TITLES: Record<LogType, string> = {
	approve: "✅ Présentation approuvée",
	disapprove: "❌ Présentation refusée",
	"too-short": "⚠️ Présentation trop courte",
	"auto-approve": "🔄 Auto-approbation",
}

export async function sendLog(
	client: discord.Client,
	type: LogType,
	description: string,
) {
	const channel = client.channels.cache.get(sendableChannels.log)

	if (!channel?.isSendable()) return

	await channel
		.send({
			embeds: [
				new discord.EmbedBuilder()
					.setColor(LOG_COLORS[type])
					.setTitle(LOG_TITLES[type])
					.setDescription(description)
					.setTimestamp(),
			],
		})
		.catch(() => {})
}
