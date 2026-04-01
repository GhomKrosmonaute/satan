import { Listener } from "#core/listener"

import {
	APPROVE_EMOJI,
	DISAPPROVE_EMOJI,
	PRESENTATION_MIN_LENGTH,
	logTooShort,
} from "#namespaces/presentation"
import { roles, sendableChannels } from "#namespaces/tst"

export default new Listener({
	event: "messageCreate",
	description: "Handle member presentation submission",
	async run(message) {
		if (message.author.bot) return
		if (!message.guild || !message.member) return

		if (message.channel.id !== sendableChannels.presentation) return

		await message.member.fetch(true)

		if (
			message.member.roles.cache.has(roles.member) ||
			message.member.roles.cache.has(roles.awaitValidation)
		)
			return

		if (message.content.length < PRESENTATION_MIN_LENGTH) {
			const content = message.content

			await Promise.all([
				message.author
					.send(
						`## ⚠️ Présentation trop courte\nTa présentation doit contenir au moins **${PRESENTATION_MIN_LENGTH} caractères**.\nLa tienne en compte **${content.length}** — il t'en manque **${PRESENTATION_MIN_LENGTH - content.length}**.\n\nVoici ce que tu avais écrit :\n\`\`\`\n${content}\n\`\`\``,
					)
					.catch(() => {}),
				message.delete().catch(() => {}),
				logTooShort(message.client, message.author, content),
			])

			return
		}

		await Promise.all([
			message.member.roles.add(roles.awaitValidation),
			message.react(APPROVE_EMOJI),
			message.react(DISAPPROVE_EMOJI),
		])
	},
})
