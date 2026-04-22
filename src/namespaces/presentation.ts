import dayjs from "dayjs"
import discord from "discord.js"

import logger from "#core/logger"
import users from "#tables/user"

import { generateWelcomeMessage } from "#namespaces/openai"
import { emotes, roles, sendableChannels } from "#namespaces/tst"

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
		for (const emoteId of [emotes.approve, emotes.disapprove, emotes.ban]) {
			const reaction = presentation.reactions.cache.find(
				(r) => r.emoji.id === emoteId,
			)
			await reaction?.users.remove(member.client.user.id).catch(() => {})
		}
	}

	const general = member.client.channels.cache.get(sendableChannels.general)

	if (general?.isSendable()) {
		let welcomeText: string
		try {
			welcomeText = await generateWelcomeMessage({
				username: member.user.username,
				accountCreatedAt: dayjs(member.user.createdAt).format("DD/MM/YYYY"),
				presentationText: presentation?.content,
				memberCount: member.guild.memberCount,
			})
		} catch {
			welcomeText = `🐐 *Les portes du Temple s'ouvrent.*\n\nBienvenue parmi nous, {{MEMBER}}. Baphomet accueille ton esprit libre — que la raison guide tes pas et que le savoir t'arme.`
		}

		await general
			.send({
				embeds: [
					new discord.EmbedBuilder()
						.setColor(0x8b0000)
						.setDescription(
							welcomeText.replace(/\{\{MEMBER}}/g, `${member.user}`),
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

export async function banMember(
	member: discord.GuildMember,
	presentation: discord.Message,
) {
	await users.query.delete().where({ id: member.id })

	const excerpt =
		presentation.content.slice(0, 900) +
		(presentation.content.length > 900 ? "…" : "")

	await sendLog(
		member.client,
		"ban",
		`**${member.user.username}** (\`${member.id}\`) a été banni(e) lors de la présentation.\n\n**Présentation :**\n\`\`\`\n${excerpt}\n\`\`\``,
	)

	await member.ban({ reason: "Banni lors de la présentation" })

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

type LogType = "approve" | "disapprove" | "ban" | "too-short" | "auto-approve"

const LOG_COLORS: Record<LogType, number> = {
	approve: 0x2ecc71,
	disapprove: 0xe74c3c,
	ban: 0x8b0000,
	"too-short": 0xe67e22,
	"auto-approve": 0x3498db,
}

const LOG_TITLES: Record<LogType, string> = {
	approve: "✅ Présentation approuvée",
	disapprove: "❌ Présentation refusée",
	ban: "🔨 Membre banni",
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
