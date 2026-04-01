import discord from "discord.js"
import { SlashCommand } from "#core/slash"
import { getSystemMessage } from "#core/util"

import { approveMember } from "#namespaces/presentation"
import { roles } from "#namespaces/tst"

export default new SlashCommand({
	name: "approve",
	description: "Approve a member's presentation",
	guildOnly: true,
	userPermissions: ["ManageRoles"],
	build: (builder) =>
		builder.addUserOption((option) =>
			option
				.setName("membre")
				.setDescription("Le membre a approuver")
				.setRequired(true),
		),
	async run(interaction) {
		const targetUser = interaction.options.getUser("membre", true)
		const member = await interaction.guild.members
			.fetch(targetUser.id)
			.catch(() => null)

		if (!member) {
			return interaction.reply({
				flags: discord.MessageFlags.Ephemeral,
				...(await getSystemMessage(
					"error",
					"Membre introuvable sur ce serveur.",
				)),
			})
		}

		if (member.roles.cache.has(roles.member)) {
			return interaction.reply({
				flags: discord.MessageFlags.Ephemeral,
				...(await getSystemMessage("error", "Ce membre est deja valide.")),
			})
		}

		await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral })

		await approveMember(member)

		return interaction.editReply(
			await getSystemMessage(
				"success",
				`**${member.user.username}** a ete approuve(e) avec succes.`,
			),
		)
	},
})
