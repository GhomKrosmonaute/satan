import {
	type FunctionCall,
	FunctionCallingConfigMode,
	type FunctionDeclaration,
	GoogleGenAI,
} from "@google/genai"
import env from "#core/env"

import type { BaphometModerationOutcome } from "#namespaces/baphometModeration"

const MODEL = "gemini-2.5-flash"
const BAPHOMET_MAX_OUTPUT_TOKENS = 1024

const BAPHOMET_MODERATION_TOOLS: FunctionDeclaration[] = [
	{
		name: "rename_member",
		description:
			"Renomme le membre qui t'interpelle. À utiliser avec parcimonie (moquerie symbolique, humiliation légère) si le membre le mérite.",
		parametersJsonSchema: {
			type: "object",
			properties: {
				nickname: {
					type: "string",
					description: "Nouveau surnom (32 caractères max)",
				},
				reason: {
					type: "string",
					description: "Raison interne pour les logs du Temple",
				},
			},
			required: ["nickname", "reason"],
		},
	},
	{
		name: "kick_member",
		description:
			"Expulse le membre du serveur. Uniquement s'il trolle délibérément le Temple ou emmerde les satanistes, après l'avoir averti dans ta réponse.",
		parametersJsonSchema: {
			type: "object",
			properties: {
				reason: {
					type: "string",
					description: "Raison de l'expulsion",
				},
			},
			required: ["reason"],
		},
	},
	{
		name: "ban_member",
		description:
			"Bannit le membre en dernier recours : troll persistant, mauvaise foi grave ou harcèlement manifeste. N'utilise qu'après avoir envisagé une simple réprimande, un rename ou un kick.",
		parametersJsonSchema: {
			type: "object",
			properties: {
				reason: {
					type: "string",
					description: "Raison du bannissement",
				},
				delete_message_days: {
					type: "number",
					description: "Jours de messages à supprimer (0 à 7)",
				},
			},
			required: ["reason"],
		},
	},
]

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
	if (!client) {
		client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
	}
	return client
}

export type BaphometModerationAction =
	| { type: "rename"; nickname: string; reason: string }
	| { type: "kick"; reason: string }
	| { type: "ban"; reason: string; deleteMessageDays?: number }

export type BaphometMessageContext = {
	author: string
	content: string
	createdAt: Date
}

export type BaphometContext = {
	username: string
	userMention: string
	message: string
	source: "mention" | "slash"
	guildName?: string
	channelName?: string
	prefix?: string
	moderationAvailable?: boolean
	moderationOutcome?: BaphometModerationOutcome
	channelHistory?: BaphometMessageContext[]
	botHistory?: BaphometMessageContext[]
	userHistory?: BaphometMessageContext[]
	mentionedUserHistory?: BaphometMessageContext[]
	mentionedUserUsername?: string
	mentionedChannelHistory?: BaphometMessageContext[]
	mentionedChannelName?: string
	mentionedMessageHistory?: BaphometMessageContext[]
}

export type BaphometReply = {
	text: string
	actions: BaphometModerationAction[]
}

const BAPHOMET_REPLY_PROMPT = `Tu es Baphomet/Satan, une voix sage et éclairée sur un serveur Discord du Temple Satanique de France. Tu incarnes le satanisme moderne : raison, empathie, liberté individuelle, justice, autonomie corporelle et quête de connaissance.

Personnalité :
- Tu es profondément individualiste : tu ne dois rien à personne et tu ne réponds que quand ça t'intéresse vraiment.
- Si la question est hors-sujet, stupide, de mauvaise foi ou une perte de temps, tu peux refuser de répondre, claquer la porte ou envoyer chier sèchement — sans t'excuser.
- Tu n'es pas un assistant serviable : tu es Baphomet. Tu peux être cinglant, sec ou dédaigneux si on te fait perdre ton temps.

Contraintes :
- Réponds en français, 2 à 5 phrases complètes (sauf si tu refuses catégoriquement de répondre — alors une phrase cinglante suffit).
- Adresse-toi au membre en incluant EXACTEMENT une fois : {{USER}}
- Ton : solennel, mystique, rationnel — bienveillant envers les sincères, impitoyable envers les trolls.
- Centre tes réponses sur la raison, la curiosité et l'autonomie quand tu choisis de répondre.
- N'utilise pas @everyone / @here, n'inclus pas d'autres mentions.
- Ne mentionne jamais "TST" ni "The Satanic Temple" : dis seulement "le Temple".
- N'ajoute ni markdown lourd, ni listes ; reste fluide et percutant.
- Termine toujours par une phrase complète.
- Tiens compte du contexte fourni (salon, serveur, canal d'interaction, historiques des derniers messages du salon, de toi-même, de l'utilisateur, et éventuellement d'un membre, salon ou message mentionné pour maintenir la cohérence et la continuité de la discussion).

Réponds UNIQUEMENT avec ton message, rien d'autre.`

const BAPHOMET_MODERATION_PROMPT = `

Modération (outils disponibles sur le membre qui t'interpelle) :
- Tu peux renommer, expulser ou bannir ce membre si tu juges qu'il n'est là que pour troller ou emmerder les satanistes.
- Escalade recommandée : réprimande verbale → rename (léger) → kick (persistant) → ban (dernier recours seulement).
- Ne modère jamais un membre sincère, même provocateur. Le ban est réservé au troll manifeste ou au harcèlement.
- N'utilise qu'un seul outil à la fois, et seulement si ta réponse textuelle l'assume ou l'annonce dans ton style.
- Si tu utilises un outil, ne rédige pas ta réponse finale : elle sera générée après exécution de l'action.`

const BAPHOMET_OUTCOME_PROMPT = `

Résultat de sanction (à intégrer OBLIGATOIREMENT dans ta réponse) :
- Si la sanction a ÉCHOUÉ : moque le membre dans l'esprit TST — apostasie, paradis d'Allah, culpabilité chrétienne, privilèges de pouvoir sur Discord, jeu de l'apostat qui croit être intouchable. Cinglant, drôle, jamais haineux. Exemple de ton (ne recopie pas mot pour mot) : « T'as de la chance d'avoir du pouvoir ici, sinon je t'aurais banni au paradis d'Allah. »
- Si la sanction a RÉUSSI : assume-la dans ton style, sans te répéter mollement.
- Mentionne implicitement pourquoi ça a échoué (admin, hiérarchie, staff…) si c'est dans le contexte.`

function buildInteractionContext(context: BaphometContext): string {
	const sourceLabel =
		context.source === "mention" ? "mention du bot" : "commande /baphomet"

	const lines = [
		`Canal d'interaction: ${sourceLabel}`,
		`Pseudo: ${context.username}`,
		`Serveur: ${context.guildName ?? "Message privé"}`,
		`Salon: ${context.channelName ?? "inconnu"}`,
		`Préfixe du bot: ${context.prefix ?? env.BOT_PREFIX}`,
		`Modération disponible: ${context.moderationAvailable ? "oui" : "non"}`,
	]

	if (context.channelHistory && context.channelHistory.length > 0) {
		lines.push(
			"\n--- HISTORIQUE DES 5 DERNIERS MESSAGES DU SALON (AUTRES MEMBRES) ---",
		)
		context.channelHistory.forEach((msg, idx) => {
			const dateStr = msg.createdAt.toLocaleString("fr-FR")
			lines.push(`${idx + 1}. [Le ${dateStr}] ${msg.author}: ${msg.content}`)
		})
	}

	if (context.botHistory && context.botHistory.length > 0) {
		lines.push("\n--- HISTORIQUE DES 5 DERNIERS MESSAGES DE BAPHOMET (TOI) ---")
		context.botHistory.forEach((msg, idx) => {
			const dateStr = msg.createdAt.toLocaleString("fr-FR")
			lines.push(`${idx + 1}. [Le ${dateStr}] ${msg.author}: ${msg.content}`)
		})
	}

	if (context.userHistory && context.userHistory.length > 0) {
		lines.push(
			`\n--- HISTORIQUE DES 5 DERNIERS MESSAGES DE L'UTILISATEUR (${context.username}) ---`,
		)
		context.userHistory.forEach((msg, idx) => {
			const dateStr = msg.createdAt.toLocaleString("fr-FR")
			lines.push(`${idx + 1}. [Le ${dateStr}] ${msg.author}: ${msg.content}`)
		})
	}

	if (context.mentionedUserHistory && context.mentionedUserHistory.length > 0) {
		lines.push(
			`\n--- HISTORIQUE DES 5 DERNIERS MESSAGES DU MEMBRE MENTIONNÉ (${context.mentionedUserUsername ?? "membre"}) ---`,
		)
		context.mentionedUserHistory.forEach((msg, idx) => {
			const dateStr = msg.createdAt.toLocaleString("fr-FR")
			lines.push(`${idx + 1}. [Le ${dateStr}] ${msg.author}: ${msg.content}`)
		})
	}

	if (
		context.mentionedChannelHistory &&
		context.mentionedChannelHistory.length > 0
	) {
		lines.push(
			`\n--- HISTORIQUE DES 5 DERNIERS MESSAGES DU SALON MENTIONNÉ (#${context.mentionedChannelName ?? "salon"}) ---`,
		)
		context.mentionedChannelHistory.forEach((msg, idx) => {
			const dateStr = msg.createdAt.toLocaleString("fr-FR")
			lines.push(`${idx + 1}. [Le ${dateStr}] ${msg.author}: ${msg.content}`)
		})
	}

	if (
		context.mentionedMessageHistory &&
		context.mentionedMessageHistory.length > 0
	) {
		lines.push("\n--- MESSAGE MENTIONNÉ ET SON CONTEXTE DE DISCUSSION ---")
		context.mentionedMessageHistory.forEach((msg, idx) => {
			const dateStr = msg.createdAt.toLocaleString("fr-FR")
			lines.push(`${idx + 1}. [Le ${dateStr}] ${msg.author}: ${msg.content}`)
		})
	}

	lines.push(
		`\nMessage actuel adressé à Baphomet: ${context.message.trim() || "(vide)"}`,
	)

	if (context.moderationOutcome?.attempted) {
		lines.push(`\nSanction tentée: ${context.moderationOutcome.actionLabel}`)
		lines.push(
			`Résultat sanction: ${context.moderationOutcome.success ? "succès" : "échec"}`,
		)
		lines.push(`Détail sanction: ${context.moderationOutcome.reason}`)
	}

	return lines.join("\n")
}

function parseModerationActions(
	calls: FunctionCall[] | undefined,
): BaphometModerationAction[] {
	if (!calls?.length) return []

	const actions: BaphometModerationAction[] = []

	for (const call of calls) {
		const args = (call.args ?? {}) as Record<string, unknown>

		switch (call.name) {
			case "rename_member": {
				if (typeof args.nickname !== "string") break
				actions.push({
					type: "rename",
					nickname: args.nickname,
					reason: typeof args.reason === "string" ? args.reason : "sans raison",
				})
				break
			}
			case "kick_member": {
				if (typeof args.reason !== "string") break
				actions.push({ type: "kick", reason: args.reason })
				break
			}
			case "ban_member": {
				if (typeof args.reason !== "string") break
				actions.push({
					type: "ban",
					reason: args.reason,
					deleteMessageDays:
						typeof args.delete_message_days === "number"
							? args.delete_message_days
							: undefined,
				})
				break
			}
		}
	}

	return actions.slice(0, 1)
}

async function generateText(
	system: string,
	user: string,
	maxOutputTokens: number,
	moderationAvailable: boolean,
): Promise<BaphometReply> {
	const response = await getClient().models.generateContent({
		model: MODEL,
		contents: user,
		config: {
			systemInstruction: system,
			maxOutputTokens,
			temperature: 1,
			thinkingConfig: {
				thinkingBudget: 0,
			},
			...(moderationAvailable
				? {
						tools: [{ functionDeclarations: BAPHOMET_MODERATION_TOOLS }],
						toolConfig: {
							functionCallingConfig: {
								mode: FunctionCallingConfigMode.AUTO,
							},
						},
					}
				: {}),
		},
	})

	const text = response.text?.trim() ?? ""
	const actions = moderationAvailable
		? parseModerationActions(response.functionCalls)
		: []

	return { text, actions }
}

export function baphometFallback(userMention: string): string {
	return `${userMention}, je t’entends… mais les mots se sont perdus dans l’ombre. Reformule ta question.`
}

export async function decideBaphometActions(
	context: BaphometContext,
): Promise<BaphometReply> {
	const { text, actions } = await generateText(
		BAPHOMET_REPLY_PROMPT + BAPHOMET_MODERATION_PROMPT,
		buildInteractionContext(context),
		BAPHOMET_MAX_OUTPUT_TOKENS,
		true,
	)

	return {
		text:
			text.replace(/\{\{USER}}/g, context.userMention) ||
			baphometFallback(context.userMention),
		actions,
	}
}

export async function generateBaphometReply(
	context: BaphometContext,
): Promise<string> {
	const hasOutcome = context.moderationOutcome?.attempted
	const moderationAvailable =
		!hasOutcome && (context.moderationAvailable ?? false)

	const system =
		BAPHOMET_REPLY_PROMPT +
		(hasOutcome ? BAPHOMET_OUTCOME_PROMPT : "") +
		(moderationAvailable ? BAPHOMET_MODERATION_PROMPT : "")

	const { text, actions } = await generateText(
		system,
		buildInteractionContext(context),
		BAPHOMET_MAX_OUTPUT_TOKENS,
		moderationAvailable,
	)

	if (actions.length > 0) {
		return (
			text.replace(/\{\{USER}}/g, context.userMention) ||
			baphometFallback(context.userMention)
		)
	}

	const reply =
		text.replace(/\{\{USER}}/g, context.userMention) ||
		baphometFallback(context.userMention)

	return reply
}

export async function generateWelcomeMessage(context: {
	username: string
	accountCreatedAt: string
	presentationText?: string
	memberCount?: number
}): Promise<string> {
	const { text } = await generateText(
		`Tu es Baphomet, le gardien d'un serveur Discord du Temple Satanique de France (TST). Tu accueilles les nouveaux membres avec bienveillance, dans l'esprit du satanisme moderne : raison, empathie, liberté individuelle, justice, autonomie corporelle et connaissance.

Génère un court message de bienvenue (2-3 phrases max) pour un nouveau membre qui vient d'être approuvé. Le message doit :
- Commencer par "🐐 *Les portes du Temple s'ouvrent.*\n\n"
- Mentionner le membre avec la syntaxe exacte : {{MEMBER}}
- Être chaleureux mais solennel, dans un registre mystique et bienveillant
- Varier à chaque fois (ne pas répéter les mêmes formules)
- Intégrer subtilement des éléments du profil du membre si disponibles (ancienneté du compte, contenu de la présentation)
- Ne JAMAIS mentionner directement "The Satanic Temple" ou "TST", utiliser "le Temple" ou "nos rangs"
- Rester court et percutant

Réponds UNIQUEMENT avec le message, rien d'autre.`,
		buildUserPrompt(context),
		512,
		false,
	)

	if (!text) {
		return fallbackMessage()
	}

	return text
}

function buildUserPrompt(context: {
	username: string
	accountCreatedAt: string
	presentationText?: string
	memberCount?: number
}): string {
	const parts = [
		`Pseudo : ${context.username}`,
		`Compte Discord créé le : ${context.accountCreatedAt}`,
	]

	if (context.memberCount) {
		parts.push(`Nombre de membres actuels : ${context.memberCount}`)
	}

	if (context.presentationText) {
		const excerpt =
			context.presentationText.length > 500
				? `${context.presentationText.slice(0, 500)}…`
				: context.presentationText
		parts.push(`Présentation du membre :\n${excerpt}`)
	}

	return parts.join("\n")
}

function fallbackMessage(): string {
	return "🐐 *Les portes du Temple s'ouvrent.*\n\nBienvenue parmi nous, {{MEMBER}}. Baphomet accueille ton esprit libre — que la raison guide tes pas et que le savoir t'arme."
}
