import discord from "discord.js"
import { SlashCommand } from "#core/slash"
import { getSystemMessage } from "#core/util"

import { roles, sendableChannels } from "#namespaces/tst"

export default new SlashCommand({
	name: "setup-presentation",
	description: "Setup permissions for the presentation system",
	guildOnly: true,
	userPermissions: ["Administrator"],
	build: (builder) =>
		builder.addStringOption((option) =>
			option
				.setName("categories")
				.setDescription(
					"IDs des categories a restreindre (separes par des virgules)",
				)
				.setRequired(true),
		),
	async run(interaction) {
		const categoriesInput = interaction.options.getString("categories", true)
		const categoryIds = categoriesInput.split(",").map((id) => id.trim())

		const presentationChannel = interaction.guild.channels.cache.get(
			sendableChannels.presentation,
		)

		if (!presentationChannel || presentationChannel.isThread()) {
			return interaction.reply({
				flags: discord.MessageFlags.Ephemeral,
				...(await getSystemMessage(
					"error",
					`Salon de presentation introuvable (ID: \`${sendableChannels.presentation}\`). Mets a jour \`tst.ts\`.`,
				)),
			})
		}

		const categories: discord.CategoryChannel[] = []

		for (const categoryId of categoryIds) {
			const category = interaction.guild.channels.cache.get(categoryId)

			if (!category || category.type !== discord.ChannelType.GuildCategory) {
				return interaction.reply({
					flags: discord.MessageFlags.Ephemeral,
					...(await getSystemMessage(
						"error",
						`Categorie introuvable : \`${categoryId}\``,
					)),
				})
			}

			categories.push(category)
		}

		const awaitValidationRole = interaction.guild.roles.cache.get(
			roles.awaitValidation,
		)
		const memberRole = interaction.guild.roles.cache.get(roles.member)
		const everyoneRole = interaction.guild.roles.everyone

		if (!awaitValidationRole) {
			return interaction.reply({
				flags: discord.MessageFlags.Ephemeral,
				...(await getSystemMessage(
					"error",
					`Role "attente validation" introuvable (ID: \`${roles.awaitValidation}\`). Mets a jour \`tst.ts\`.`,
				)),
			})
		}

		if (!memberRole) {
			return interaction.reply({
				flags: discord.MessageFlags.Ephemeral,
				...(await getSystemMessage(
					"error",
					`Role "membre" introuvable (ID: \`${roles.member}\`). Mets a jour \`tst.ts\`.`,
				)),
			})
		}

		await interaction.deferReply({ flags: discord.MessageFlags.Ephemeral })

		let processedChannels = 0

		for (const category of categories) {
			await category.permissionOverwrites.set([
				{
					id: everyoneRole.id,
					deny: [discord.PermissionFlagsBits.ViewChannel],
				},
				{
					id: memberRole.id,
					allow: [discord.PermissionFlagsBits.ViewChannel],
				},
			])

			for (const [, channel] of category.children.cache) {
				if (channel.id === presentationChannel.id) continue

				await channel.permissionOverwrites.set([
					{
						id: everyoneRole.id,
						deny: [discord.PermissionFlagsBits.ViewChannel],
					},
					{
						id: memberRole.id,
						allow: [discord.PermissionFlagsBits.ViewChannel],
					},
				])

				processedChannels++
			}
		}

		if (!("permissionOverwrites" in presentationChannel)) {
			return interaction.editReply(
				await getSystemMessage(
					"error",
					"Le salon de presentation ne supporte pas les overwrites de permissions.",
				),
			)
		}

		await presentationChannel.permissionOverwrites.set([
			{
				id: everyoneRole.id,
				allow: [
					discord.PermissionFlagsBits.ViewChannel,
					discord.PermissionFlagsBits.SendMessages,
					discord.PermissionFlagsBits.ReadMessageHistory,
				],
			},
			{
				id: awaitValidationRole.id,
				deny: [discord.PermissionFlagsBits.SendMessages],
			},
			{
				id: memberRole.id,
				allow: [
					discord.PermissionFlagsBits.ViewChannel,
					discord.PermissionFlagsBits.ReadMessageHistory,
				],
				deny: [discord.PermissionFlagsBits.SendMessages],
			},
		])

		processedChannels++

		return interaction.editReply(
			await getSystemMessage(
				"success",
				`Systeme de presentation configure avec succes !
- Salon presentation : ${presentationChannel}
- Categories configurees : ${categories.length}
- Salons traites au total : ${processedChannels}`,
			),
		)
	},
})
