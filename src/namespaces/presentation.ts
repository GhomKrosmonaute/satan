import type discord from "discord.js"

import logger from "#core/logger"
import users from "#tables/user"

import { logChannelId, roles, sendableChannels } from "#namespaces/tst"

export const APPROVE_EMOJI = "✅"
export const DISAPPROVE_EMOJI = "❌"
export const PRESENTATION_MIN_LENGTH = 300

export async function approveMember(
	member: discord.GuildMember,
	presentationMessageId?: string,
) {
	await users.query
		.insert({
			id: member.id,
			presentation_id: presentationMessageId ?? null,
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
	} catch (error) {
		logger.error(
			`Failed to set roles for ${member.user.username} in ${member.guild.name}`,
			"namespaces/presentation.ts",
		)
	}

	await sendLog(
		member.client,
		`${member.user} a ete approuve(e) et a recu le role membre.`,
	)
}

export async function disapproveMember(
	member: discord.GuildMember,
	presentation: discord.Message,
) {
	await users.query.delete().where({ id: member.id })

	await sendLog(
		member.client,
		`**Presentation refusee de ${member.user.username} :**\n${presentation.content}`,
	)

	await member.kick("Presentation refusee")

	await presentation.delete().catch(() => {})
}

async function sendLog(client: discord.Client, content: string) {
	const channel = client.channels.cache.get(logChannelId)

	if (channel?.isSendable()) {
		await channel.send(content).catch(() => {})
	}
}
