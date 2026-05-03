import discord from "discord.js"

import client from "#core/client"
import { systemColors } from "#core/util"

export const guildID = "1380488557629542501"
export const sendableChannels = {
	general: "1380488558372196474",
	feed: "1380950764452581498",
	bumper: "1380527003773571193",
	shares: "1381627637201502440",
	announcements: "1388851309670830180",
	presentation: "1488856583827095602",
	log: "1488858215197315206",
} as const

export const roles = {
	member: "1488856666836303965",
	awaitValidation: "1488856867634675712",
	staff: "1488857066549547038",
} as const

export const emotes = {
	approve: "1496543797222310018",
	disapprove: "1496543751009734898",
	ban: "1496543701051248752",
} as const

export async function getGuild() {
	return client.guilds.fetch(guildID)
}

export async function getSendableChannel(name: keyof typeof sendableChannels) {
	const channel = await client.channels.fetch(sendableChannels[name])
	if (!channel) {
		throw new Error(`Channel ${name} not found in guild ${guildID}`)
	}
	if (!channel.isSendable()) {
		throw new Error(`Channel ${name} is not a text channel`)
	}
	return channel
}

export type LogType = "error" | "info" | "success" | "warning" | "system"

const LOG_COLORS: Record<LogType, number> = {
	error: systemColors.error,
	info: discord.Colors.Blue,
	success: systemColors.success,
	warning: systemColors.warning,
	system: discord.Colors.Grey,
}

const LOG_TITLES: Record<LogType, string> = {
	error: "❌  Erreur",
	info: "ℹ️  Information",
	success: "✅  Succès",
	warning: "⚠️  Avertissement",
	system: "⚙️  Système",
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
