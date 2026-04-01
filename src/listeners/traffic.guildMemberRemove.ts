import { Listener } from "#core/listener"

import { roles, sendableChannels } from "#namespaces/tst"

const farewells = [
	(name: string) => `${name} quitte le Temple. Que son chemin lui appartienne.`,
	(name: string) =>
		`${name} prend congé. La flamme qu'il portait reste la sienne.`,
	(name: string) => `${name} s'éloigne du Temple. Bon courage à lui.`,
	(name: string) => `Les portes se referment derrière ${name}.`,
	(name: string) =>
		`${name} a choisi une autre voie. La volonté individuelle est sacrée.`,
	(name: string) => `${name} quitte nos rangs. Le Temple se souvient.`,
	(name: string) => `${name} part. Que la raison continue de l'accompagner.`,
	(name: string) => `${name} a pris la sortie. Bonne route.`,
	(name: string) => `Le Temple dit au revoir à ${name}.`,
	(name: string) => `Un siège se libère. ${name} nous a quittés.`,
]

export default new Listener({
	event: "guildMemberRemove",
	description: "Send a farewell message when a member leaves",
	async run(member) {
		if (member.user.bot) return
		if (member.partial) return
		if (!member.roles.cache.has(roles.member)) return

		const farewell = farewells[Math.floor(Math.random() * farewells.length)]

		const general = member.client.channels.cache.get(sendableChannels.general)

		if (general?.isSendable()) {
			await general.send(`*${farewell(member.user.username)}*`).catch(() => {})
		}
	},
})
