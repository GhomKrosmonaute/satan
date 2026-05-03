import util from "node:util"
import dayjs from "dayjs"
import discord from "discord.js"

import logger from "#core/logger"
import users from "#tables/user"

import { generateWelcomeMessage } from "#namespaces/openai"
import { emotes, roles, sendLog, sendableChannels } from "#namespaces/tst"

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
		const msg = await presentation.channel.messages
			.fetch(presentation.id)
			.catch(() => presentation)
		const botId = member.client.user.id
		await Promise.all(
			[emotes.approve, emotes.disapprove, emotes.ban].map((emoteId) => {
				const reaction = msg.reactions.resolve(emoteId)
				return (
					reaction?.users.remove(botId).catch(() => {}) ?? Promise.resolve()
				)
			}),
		)
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
		} catch (err) {
			welcomeText = `🐐 *Les portes du Temple s'ouvrent.*\n\nBienvenue parmi nous, {{MEMBER}}. Baphomet accueille ton esprit libre — que la raison guide tes pas et que le savoir t'arme.`
			const detail = util.inspect(err, {
				depth: 5,
				colors: false,
				compact: false,
			})
			logger.error(
				`Welcome OpenAI fallback for ${member.user.username} (${member.id}): ${detail}`,
				"namespaces/presentation.ts",
			)
			const maxDetailLen = 3500
			const detailForDiscord =
				detail.length > maxDetailLen
					? `${detail.slice(0, maxDetailLen)}\n…`
					: detail
			await sendLog(
				member.client,
				"error",
				`**Message de bienvenue OpenAI** — échec pour **${member.user.username}** (\`${member.id}\`), fallback utilisé.\n\`\`\`\n${detailForDiscord}\n\`\`\``,
			)
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
		"success",
		`**Présentation approuvée** — **${member.user.username}** (\`${member.id}\`) a reçu le rôle membre.`,
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
		"warning",
		`**Présentation refusée** — **${member.user.username}** (\`${member.id}\`) a été expulsé(e).\n\n**Présentation :**\n\`\`\`\n${excerpt}\n\`\`\``,
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
		"error",
		`**Bannissement (présentation)** — **${member.user.username}** (\`${member.id}\`).\n\n**Présentation :**\n\`\`\`\n${excerpt}\n\`\`\``,
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
		"warning",
		`**Présentation trop courte** — **${user.username}** (\`${user.id}\`) (**${content.length}**/${PRESENTATION_MIN_LENGTH} caractères).\n\n**Contenu :**\n\`\`\`\n${excerpt}\n\`\`\``,
	)
}
