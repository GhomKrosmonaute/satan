import discord from "discord.js"
import { SlashCommand } from "#core/slash"
import { getSystemMessage } from "#core/util"

import { disapproveMember } from "#namespaces/presentation"
import { roles, sendableChannels } from "#namespaces/tst"

export default new SlashCommand({
	name: "disapprove",
	description: "Disapprove a member's presentation and kick them",
	guildOnly: true,
	userPermissions: ["ManageRoles"],
	build: (builder) =>
		builder
			.addUserOption((option) =>
				option
					.setName("membre")
					.setDescription("Le membre a refuser")
					.setRequired(true),
			)
			.addStringOption((option) =>
				option
					.setName("raison")
					.setDescription("Raison du refus")
					.setRequired(false),
			),
	async run(interaction) {
		const targetUser = interaction.options.getUser("membre", true)
		const raison =
			interaction.options.getString("raison") ?? "Aucune raison fournie"

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
				...(await getSystemMessage(
					"error",
					"Ce membre est deja valide. Utilise /kick a la place.",
				)),
			})
		}

		await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral })

		const channel = interaction.guild.channels.cache.get(
			sendableChannels.presentation,
		)

		let presentation: discord.Message | undefined

		if (channel?.isTextBased()) {
			const messages = await channel.messages.fetch({ limit: 100 })
			presentation = messages.find((m) => m.author.id === member.id)
		}

		if (!presentation) {
			await member.kick(`Presentation refusee : ${raison}`)

			return interaction.editReply(
				await getSystemMessage(
					"success",
					`**${member.user.username}** a ete refuse(e) et expulse(e) (aucune presentation trouvee).`,
				),
			)
		}

		await disapproveMember(member, presentation)

		return interaction.editReply(
			await getSystemMessage(
				"success",
				`**${member.user.username}** a ete refuse(e) et expulse(e).`,
			),
		)
	},
})
