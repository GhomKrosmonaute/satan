import discord from "discord.js"
import { SlashCommand } from "#core/slash"
import { getSystemMessage } from "#core/util"

import logger from "#core/logger"
import { PRESENTATION_MIN_LENGTH } from "#namespaces/presentation"
import { roles, sendLog, sendableChannels } from "#namespaces/tst"
import users from "#tables/user"

export default new SlashCommand({
	name: "edit-presentation",
	description: "Permet de modifier ta présentation et d'attendre ton édition",
	guildOnly: true,
	async run(interaction) {
		const member = interaction.member as discord.GuildMember

		if (!member.roles.cache.has(roles.member)) {
			return interaction.reply({
				flags: discord.MessageFlags.Ephemeral,
				...(await getSystemMessage(
					"error",
					"Tu n'es pas encore un membre validé du Temple.",
				)),
			})
		}

		const userData = await users.query.where({ id: member.id }).first()
		if (!userData || !userData.presentation_id) {
			return interaction.reply({
				flags: discord.MessageFlags.Ephemeral,
				...(await getSystemMessage(
					"error",
					"Ta présentation validée est introuvable dans la base de données.",
				)),
			})
		}

		const channel = interaction.guild.channels.cache.get(
			sendableChannels.presentation,
		)
		if (!channel || !channel.isTextBased()) {
			return interaction.reply({
				flags: discord.MessageFlags.Ephemeral,
				...(await getSystemMessage(
					"error",
					"Le salon de présentation est introuvable.",
				)),
			})
		}

		const presentationMessage = await channel.messages
			.fetch(userData.presentation_id)
			.catch(() => null)

		if (!presentationMessage) {
			return interaction.reply({
				flags: discord.MessageFlags.Ephemeral,
				...(await getSystemMessage(
					"error",
					"Ton message de présentation original est introuvable. Tu dois en refaire une nouvelle dans le salon dédié.",
				)),
			})
		}

		const previousRoles = member.roles.cache.map((r) => r.id)

		// Transition roles: remove member role, add awaitValidation
		try {
			await member.roles.set([
				roles.awaitValidation,
				...previousRoles.filter((id) => id !== roles.member),
			])
		} catch (err) {
			logger.error(
				`Failed to set editing roles for ${member.user.username}: ${err}`,
				"slash/edit-presentation.ts",
			)
			return interaction.reply({
				flags: discord.MessageFlags.Ephemeral,
				...(await getSystemMessage(
					"error",
					"Une erreur est survenue lors de la mise à jour temporaire de tes rôles.",
				)),
			})
		}

		await interaction.reply({
			flags: discord.MessageFlags.Ephemeral,
			...(await getSystemMessage(
				"default",
				`Tu as maintenant accès à la modification de ta présentation.\nModifie ton message d'origine ici : ${presentationMessage.url}\n\nUne fois les modifications enregistrées (minimum **${PRESENTATION_MIN_LENGTH} caractères**), tes rôles te seront automatiquement restitués. Tu as **15 minutes** pour le faire.`,
			)),
		})

		const timeout = setTimeout(
			async () => {
				interaction.client.off("messageUpdate", handleUpdate)

				// Restore original roles
				await member.roles.set(previousRoles).catch(() => {})
				await member
					.send(
						"⏰ **Temps écoulé** — Tu as mis trop de temps à modifier ta présentation. Tes rôles d'origine t'ont été restitués. Tu pourras réessayer quand tu le souhaites.",
					)
					.catch(() => {})
			},
			15 * 60 * 1000,
		)

		const handleUpdate = async (
			oldMessage: discord.Message | discord.PartialMessage,
			newMessage: discord.Message | discord.PartialMessage,
		) => {
			if (newMessage.id !== userData.presentation_id) return

			let fullMessage = newMessage
			if (newMessage.partial) {
				fullMessage = await newMessage.fetch().catch(() => newMessage)
			}

			const content = fullMessage.content ?? ""

			if (content.length < PRESENTATION_MIN_LENGTH) {
				await member
					.send(
						`⚠️ **Présentation trop courte**\nTa présentation modifiée doit contenir au moins **${PRESENTATION_MIN_LENGTH} caractères** (la tienne en compte actuellement **${content.length}**).\nMerci de la corriger pour récupérer tes rôles.`,
					)
					.catch(() => {})

				// Re-register listener since once got consumed
				interaction.client.once("messageUpdate", handleUpdate)
				return
			}

			// Valid edit! Clean up timeout
			clearTimeout(timeout)

			try {
				// Restore member role, remove awaitValidation
				await member.roles.set([
					roles.member,
					...previousRoles.filter((id) => id !== roles.awaitValidation),
				])

				await member
					.send(
						"✅ **Présentation validée** — Ta présentation a bien été mise à jour, et tes rôles t'ont été restitués !",
					)
					.catch(() => {})

				await sendLog(
					interaction.client,
					"success",
					`**Présentation modifiée** — **${member.user.username}** (\`${member.id}\`) a édité sa présentation originale et récupéré son rôle membre.`,
				)
			} catch (err) {
				logger.error(
					`Error restoring roles for ${member.user.username} after edit: ${err}`,
					"slash/edit-presentation.ts",
				)
			}
		}

		// Register the update listener
		interaction.client.once("messageUpdate", handleUpdate)
	},
})
