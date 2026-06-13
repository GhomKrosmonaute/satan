import discord from "discord.js"

import env from "#core/env"
import logger from "#core/logger"

import type { BaphometModerationAction } from "#namespaces/gemini"
import { roles, sendLog } from "#namespaces/tst"

const NICKNAME_MAX = 32
const REASON_MAX = 512

const ACTION_LABELS: Record<BaphometModerationAction["type"], string> = {
	rename: "renommage",
	kick: "expulsion",
	ban: "bannissement",
}

export type BaphometModerationOutcome =
	| { attempted: false }
	| {
			attempted: true
			action: BaphometModerationAction["type"]
			actionLabel: string
			success: boolean
			reason: string
	  }

function assertCanModerate(member: discord.GuildMember): {
	ok: boolean
	reason?: string
} {
	if (member.user.bot) return { ok: false, reason: "cible bot" }
	if (member.id === env.BOT_OWNER)
		return { ok: false, reason: "propriétaire du bot" }
	if (member.id === member.guild.ownerId)
		return { ok: false, reason: "propriétaire du serveur" }
	if (member.permissions.has(discord.PermissionFlagsBits.Administrator))
		return { ok: false, reason: "administrateur" }
	if (member.roles.cache.has(roles.staff))
		return { ok: false, reason: "membre du staff" }

	return { ok: true }
}

function failedOutcome(
	action: BaphometModerationAction,
	reason: string,
): BaphometModerationOutcome {
	return {
		attempted: true,
		action: action.type,
		actionLabel: ACTION_LABELS[action.type],
		success: false,
		reason,
	}
}

export async function executeBaphometModeration(
	member: discord.GuildMember,
	actions: BaphometModerationAction[],
): Promise<BaphometModerationOutcome> {
	const action = actions[0]
	if (!action) return { attempted: false }

	const guard = assertCanModerate(member)
	if (!guard.ok) {
		const reason = `sanction impossible : le membre est ${guard.reason}`
		const message = `Modération Baphomet refusée pour **${member.user.username}** (\`${member.id}\`) : ${guard.reason}.`
		await sendLog(member.client, "warning", message)
		return failedOutcome(action, reason)
	}

	const me = member.guild.members.me
	if (!me) {
		return failedOutcome(
			action,
			"sanction impossible : le bot n'est pas présent sur le serveur",
		)
	}

	try {
		switch (action.type) {
			case "rename": {
				if (!me.permissions.has(discord.PermissionFlagsBits.ManageNicknames)) {
					throw new Error("permission ManageNicknames manquante sur le bot")
				}
				if (!member.manageable) {
					throw new Error(
						"hiérarchie de rôles insuffisante : le membre est trop haut placé pour être renommé",
					)
				}
				const nickname = action.nickname.slice(0, NICKNAME_MAX)
				await member.setNickname(nickname, `Baphomet : ${action.reason}`)
				const message = `**Rename Baphomet** — **${member.user.username}** (\`${member.id}\`) → \`${nickname}\`\nRaison : ${action.reason}`
				await sendLog(member.client, "warning", message)
				return {
					attempted: true,
					action: "rename",
					actionLabel: ACTION_LABELS.rename,
					success: true,
					reason: `surnom changé en « ${nickname} »`,
				}
			}
			case "kick": {
				if (!me.permissions.has(discord.PermissionFlagsBits.KickMembers)) {
					throw new Error("permission KickMembers manquante sur le bot")
				}
				if (!member.kickable) {
					throw new Error(
						"hiérarchie de rôles insuffisante : le membre est trop haut placé pour être expulsé",
					)
				}
				const reason = action.reason.slice(0, REASON_MAX)
				await member.kick(`Baphomet : ${reason}`)
				const message = `**Kick Baphomet** — **${member.user.username}** (\`${member.id}\`)\nRaison : ${reason}`
				await sendLog(member.client, "warning", message)
				return {
					attempted: true,
					action: "kick",
					actionLabel: ACTION_LABELS.kick,
					success: true,
					reason: `membre expulsé — ${reason}`,
				}
			}
			case "ban": {
				if (!me.permissions.has(discord.PermissionFlagsBits.BanMembers)) {
					throw new Error("permission BanMembers manquante sur le bot")
				}
				if (!member.bannable) {
					throw new Error(
						"hiérarchie de rôles insuffisante : le membre est trop haut placé pour être banni",
					)
				}
				const reason = action.reason.slice(0, REASON_MAX)
				const deleteMessageSeconds = Math.min(
					7,
					Math.max(0, action.deleteMessageDays ?? 0),
				)
				await member.ban({
					reason: `Baphomet : ${reason}`,
					deleteMessageSeconds: deleteMessageSeconds * 24 * 60 * 60,
				})
				const message = `**Ban Baphomet** — **${member.user.username}** (\`${member.id}\`)\nRaison : ${reason}`
				await sendLog(member.client, "error", message)
				return {
					attempted: true,
					action: "ban",
					actionLabel: ACTION_LABELS.ban,
					success: true,
					reason: `membre banni — ${reason}`,
				}
			}
		}
	} catch (err) {
		const detail = err instanceof Error ? err.message : String(err)
		const message = `**Modération Baphomet échouée** (${action.type}) pour **${member.user.username}** (\`${member.id}\`) : ${detail}`
		logger.error(message, "namespaces/baphometModeration.ts")
		await sendLog(member.client, "error", message)
		return failedOutcome(action, detail)
	}
}
