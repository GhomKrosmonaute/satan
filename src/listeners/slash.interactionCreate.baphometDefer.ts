import { Listener } from "#core/listener"

export default new Listener({
	event: "interactionCreate",
	description:
		"Réponse différée immédiate pour /baphomet (appels Gemini lents)",
	async run(interaction) {
		if (!interaction.isChatInputCommand()) return
		if (interaction.commandName !== "baphomet") return
		if (interaction.deferred || interaction.replied) return

		await interaction.deferReply().catch(() => {})
	},
})
