import { Listener } from "#core/listener"

import users from "#tables/user"

import { approveMember } from "#namespaces/presentation"
import { sendableChannels } from "#namespaces/tst"

export default new Listener({
	event: "guildMemberAdd",
	description: "Auto-approve members with an existing validated presentation",
	async run(member) {
		if (member.user.bot) return

		const userData = await users.query.where({ id: member.id }).first()

		if (!userData?.presentation_id) return

		const channel = member.client.channels.cache.get(
			sendableChannels.presentation,
		)

		if (channel?.isTextBased()) {
			try {
				const presentation = await channel.messages.fetch(
					userData.presentation_id,
				)
				await approveMember(member, presentation)
				return
			} catch {
				// Le message de presentation n'existe plus
			}
		}

		await approveMember(member)
	},
})
