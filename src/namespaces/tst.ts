import client from "#core/client"

export const guildID = "1380488557629542501"
export const sendableChannels = {
	general: "1380488558372196474",
	feed: "1380950764452581498",
	bumper: "1380527003773571193",
	shares: "1381627637201502440",
	announcements: "1388851309670830180",
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
