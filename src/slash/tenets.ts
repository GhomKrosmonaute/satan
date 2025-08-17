import path from "node:path"
import { AttachmentBuilder, EmbedBuilder } from "discord.js"
import { SlashCommand } from "#core/slash"
import { tenets } from "#namespaces/tenets"

/**
 * See the {@link https://ghom.gitbook.io/bot.ts/usage/create-a-command command guide} for more information.
 */
export default new SlashCommand({
	name: "tenets",
	description: "Display tenets",
	guildOnly: true,
	run(interaction) {
		return interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setTitle("Les tenets du TST")
					.setDescription(tenets.map((t, i) => `${i + 1}. ${t}`).join("\n\n"))
					.setURL("https://thesatanictemple.com/pages/about-us")
					.setFooter({
						text: "Clique sur le titre pour atteindre le site officiel du TST",
					})
					.setImage("attachment://banner_about-us.png"),
			],
			files: [
				new AttachmentBuilder(
					path.join(import.meta.dirname, "../assets/banner_about-us.png"),
				),
			],
		})
	},
})
