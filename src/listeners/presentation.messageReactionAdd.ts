import { Listener } from "#core/listener"

import {
	APPROVE_EMOJI,
	DISAPPROVE_EMOJI,
	approveMember,
	disapproveMember,
} from "#namespaces/presentation"
import { roles, sendableChannels } from "#namespaces/tst"

export default new Listener({
	event: "messageReactionAdd",
	description: "Handle presentation approval/disapproval via reactions",
	async run(reaction, user) {
		if (user.bot) return

		if (reaction.partial) {
			try {
				await reaction.fetch()
			} catch {
				return
			}
		}

		const message = reaction.message

		if (message.partial) {
			try {
				await message.fetch()
			} catch {
				return
			}
		}

		if (!message.guild || !message.author) return
		if (message.channel.id !== sendableChannels.presentation) return

		const reactor = await message.guild.members
			.fetch({ user: user.id, force: true })
			.catch(() => null)

		const redactor = await message.guild.members
			.fetch({ user: message.author.id, force: true })
			.catch(() => null)

		if (!reactor || !redactor) return
		if (!reactor.roles.cache.has(roles.staff)) return
		if (redactor.roles.cache.has(roles.member)) return

		const emoji = reaction.emoji.name

		if (emoji === APPROVE_EMOJI) {
			const fullMessage = await message.channel.messages.fetch(message.id)
			await approveMember(redactor, fullMessage.id)
		} else if (emoji === DISAPPROVE_EMOJI) {
			const fullMessage = await message.channel.messages.fetch(message.id)
			await disapproveMember(redactor, fullMessage)
		}
	},
})
