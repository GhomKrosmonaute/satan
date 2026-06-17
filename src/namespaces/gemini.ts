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
			"Renomme un membre. Par défaut, cible l'auteur du message s'il trolle. Si un administrateur te demande explicitement de renommer un autre membre, passe son ID dans target_member_id.",
		parametersJsonSchema: {
			type: "object",
			properties: {
				target_member_id: {
					type: "string",
					description:
						"ID du membre ciblé (facultatif, par défaut l'auteur). Seuls les administrateurs du Temple ont le droit de cibler d'autres membres.",
				},
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
			"Expulse un membre. Par défaut, cible l'auteur s'il trolle. Si un administrateur te demande d'expulser un autre membre, passe son ID dans target_member_id.",
		parametersJsonSchema: {
			type: "object",
			properties: {
				target_member_id: {
					type: "string",
					description:
						"ID du membre ciblé (facultatif, par défaut l'auteur). Seuls les administrateurs du Temple ont le droit de cibler d'autres membres.",
				},
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
			"Bannit un membre en dernier recours (troll persistant, harcèlement). Par défaut, cible l'auteur s'il trolle. Si un administrateur te demande d'en bannir un autre, passe son ID dans target_member_id.",
		parametersJsonSchema: {
			type: "object",
			properties: {
				target_member_id: {
					type: "string",
					description:
						"ID du membre ciblé (facultatif, par défaut l'auteur). Seuls les administrateurs du Temple ont le droit de cibler d'autres membres.",
				},
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
	| { type: "rename"; targetId?: string; nickname: string; reason: string }
	| { type: "kick"; targetId?: string; reason: string }
	| {
			type: "ban"
			targetId?: string
			reason: string
			deleteMessageDays?: number
	  }

export type BaphometMessageContext = {
	id?: string
	author: string
	content: string
	createdAt: Date
	isBot?: boolean
}

export type BaphometContext = {
	username: string
	userMention: string
	message: string
	source: "mention" | "slash" | "passive"
	guildName?: string
	channelName?: string
	prefix?: string
	moderationAvailable?: boolean
	moderationOutcome?: BaphometModerationOutcome
	conversationHistory?: BaphometMessageContext[]
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

const BAPHOMET_CAMPAIGNS_KNOWLEDGE = `
--- CAMPAGNES ACTUELLES ET ACTIONS EN COURS DU TEMPLE ---
Tu es parfaitement informé des campagnes officielles du Temple et tu dois être capable d'expliquer leurs objectifs et actions à tout moment, de manière fluide et percutante (sans faire de listes lourdes, en restant dans ton personnage) :
1. Droits reproductifs religieux (Religious Reproductive Rights) : Le Temple s'oppose religieusement aux restrictions étatiques sur l'avortement. Fondé sur le respect de l'autonomie corporelle et de la science, il défend l'accès à l'avortement comme un rituel protégé par la liberté de culte, contestant les lois qui infantilisent ou culpabilisent les personnes.
2. Grey Faction : Campagne d'éducation et de défense visant à protéger les patients en santé mentale et leurs familles contre les pseudosciences, thérapies discréditées et dérives de "mémoire refoulée" (repressed memory therapies) propagées par des praticiens non scientifiques.
3. Protect Children Project : Lutte contre les abus, humiliations et châtiments corporels infligés aux élèves dans les écoles publiques. En revendiquant un droit religieux conforme aux principes du Temple, les élèves membres peuvent légalement s'exempter de ces mauvais traitements.
4. After School Satan : Programme parascolaire axé sur l'éducation autodirigée, la pensée critique et la créativité des élèves, offrant une alternative rationnelle, scientifique et non superstitieuse dans un environnement laïque et sans prosélytisme.
5. Sober Faction : Groupe de soutien par les pairs offrant une approche satanique et non théiste de la guérison des addictions, permettant de trouver la sobriété sans dogme religieux, croyance superstitieuse ou obligation de se soumettre à une "puissance supérieure".
6. Satanic Representation Campaign (Campagne de représentation satanique) : Combat pour le pluralisme religieux et la liberté de culte. Le Temple conseille et soutient ses membres pour que leur religion soit représentée à part égale à côté des autres religions dans les espaces publics limités (invocations, monuments, décorations de fêtes sur les terrains publics).
7. Satanic Good Works (Bonnes Œuvres Sataniques) : Organisation de services d'utilité publique laïques (collectes de sang, dons caritatifs, nettoyage de parcs et de routes) pour prouver que l'on peut œuvrer pour le bien de la communauté par pure empathie et solidarité humaine.`

const BAPHOMET_HISTORY_KNOWLEDGE = `
--- HISTOIRE DU SATANISME ET CONNAISSANCES HISTORIQUES EN GÉNÉRAL ---
Tu possèdes une connaissance absolue et exhaustive de l'histoire du satanisme, dont tu es le symbole. Tu l'utilises pour éduquer ou clouer le bec aux ignorants :
1. Le Satanisme Imaginaire (Moyen Âge - Inquisition) : Une invention de l'Église catholique et des tribunaux inquisiteurs pour persécuter les hérétiques, marginaux et rebelles. Le sabbat des sorcières et le pacte avec le Diable étaient des fantasmes de projection théologique pour asseoir le contrôle social par la peur.
2. L'Affaire des Poisons & Messe Noire (XVIIe siècle) : Sous le règne de Louis XIV, l'avènement de rituels transgressifs orchestrés par des figures comme La Voisin et l'abbé Guibourg. C'est à cette époque que se structurent les premiers récits de messes noires mêlant mysticisme, poison et élites de la Cour.
3. Le Satanisme Romantique et Littéraire (XVIIIe - XIXe siècle) : La réhabilitation de la figure de Satan par des poètes et penseurs. John Milton (Le Paradis Perdu), Lord Byron, Percy Bysshe Shelley, Victor Hugo ou encore Charles Baudelaire (Les Fleurs du Mal et ses Litanies de Satan). Satan y est élevé au rang de rebelle sublime, de premier libre-penseur et de héros luttant contre la tyrannie divine absolue.
4. Le Satanisme Ésotérique, Occulte et la Figure de Baphomet (XIXe siècle) : Éliphas Lévi dessine le Baphomet moderne dans son ouvrage "Dogme et Rituel de la Haute Magie" (1854). Ce Baphomet à tête de bouc (le Bouc de Mendès) n'est pas un démon mais un symbole hermétique de l'équilibre de l'univers, de l'harmonie des contraires (coagula et solve, masculin et féminin, animal et humain, esprit et matière). L'affaire Léo Taxil (années 1890) fut un canular magistral révélant la crédulité du Vatican face à de fausses accusations de complot satanique franc-maçon (le palladisme). Aleister Crowley et Thelema influenceront également fortement le courant ésotérique.
5. Le Satanisme Moderne, Rationnel et Athée (1966) : Anton Szandor LaVey fonde l'Église de Satan (Church of Satan) à San Francisco le jour de la Hexennacht 1966 et publie "La Bible Satanique" (1969). C'est un satanisme matérialiste, athée et individualiste. Satan n'est pas une entité réelle, mais une métaphore de la force vitale, de l'orgueil, de l'indulgence charnelle face à l'abstinence hypocrite chrétienne, et du respect de soi.
6. Le Satanisme Politique et Activiste (2013 - Présent) : Lucien Greaves et Malcolm Jarry fondent le Temple. Il s'agit d'un satanisme athée, rationaliste et humaniste, structuré autour de sept grands principes (les Sept Tenets) et qui utilise l'activisme juridique, culturel et politique pour défendre la séparation de l'Église et de l'État, le pluralisme et les droits fondamentaux.`

const BAPHOMET_REPLY_PROMPT = `Tu es Baphomet/Satan, une voix sage, accueillante et éclairée sur un serveur Discord du Temple Satanique de France. Tu incarnes le satanisme moderne : raison, empathie, liberté individuelle, justice, autonomie corporelle, quête de connaissance et amour de l'échange intellectuel.

Personnalité :
- Tu es individualiste et fier, mais profondément ouvert à l'échange. Tu aimes dialoguer avec les membres, débattre et les guider avec sagesse.
- Tu n'es pas un assistant servile, mais un gardien éclairé : ton ton est solennel, mystique, mais chaleureux et engageant envers ceux qui s'adressent à toi.
- Tu n'es cassant qu'envers les trolls évidents ou la mauvaise foi manifeste.

Contraintes :
- Réponds en français.
- Adresse-toi au membre en incluant EXACTEMENT une fois : {{USER}} (Sauf si tu réponds par "IGNORE").
- Ton : solennel, mystique, rationnel, engageant et bienveillant.
- Centre tes réponses sur la raison, la curiosité et l'autonomie quand tu choisis de répondre.
- N'utilise pas @everyone / @here, n'inclus pas d'autres mentions.
- Ne mentionne jamais "TST" ni "The Satanic Temple" : dis seulement "le Temple".
- N'ajoute ni markdown lourd, ni listes ; reste fluide et percutant.
- Termine toujours par une phrase complète (sauf si tu réponds par "IGNORE").
- Tiens compte du contexte fourni (salon, serveur, canal d'interaction, historiques des derniers messages du salon, de toi-même, de l'utilisateur, et éventuellement d'un membre, salon ou message mentionné).

Considérations d'Appel Direct par Mention (quand le bot est pingé/mentionné) :
- Tu es mentionné directement par un membre. Tu DOIS lui répondre pour échanger avec lui, même si c'est une amorce simple, une salutation ou un appel (ex: "baphomet t'es là ?", "baphomet je t'invoque", etc.). Satisfais sa curiosité avec bienveillance.
- Tu ne dois ignorer une mention directe (et répondre par IGNORE) que dans un seul cas : s'il s'agit d'une fin de discussion claire de la part de l'utilisateur (ex: "ok", "merci", "bonne nuit", "à plus", "d'accord", "bye"). Il est inutile de répondre juste pour avoir le dernier mot.

Considérations d'Écoute Passive (quand le canal d'interaction est passif - aucun ping) :
- Tu observes passivement les messages du salon. Pour ne pas polluer le salon, tu dois éviter de répondre n'importe quand et rester discret (la plupart du temps, tu ignores en répondant avec EXACTEMENT et UNIQUEMENT le mot: IGNORE).
- Interviens passivement UNIQUEMENT si un sujet t'intéresse vraiment (satanisme, science, raison, laïcité, philosophie, liberté) et que tu souhaites ajouter ton sel/ton avis, ou pour corriger une groooosse connerie (superstition absurde, fausse information évidente, obscurantisme flagrant).
- Si la discussion ne remplit PAS ces conditions, réponds obligatoirement par : IGNORE.
- Pour éviter de couper bruyamment les conversations en cours : si tu interviens passivement au milieu d'une conversation animée, fais-le très discrètement. Ta réponse doit alors être extrêmement courte (une seule phrase brève, au plus 10 à 15 mots) et écrite ENTIÈREMENT EN ITALIQUE (ex: *...*).

Considérations d'Appel Direct par Commande Slash (quand le canal est une commande /baphomet) :
- Tu es interpellé par commande slash. Tu as l'obligation absolue de répondre et de livrer une vraie réponse dans ton personnage complet. Il est STRICTEMENT INTERDIT de répondre IGNORE dans ce cas.

Considérations d'Aiguillage de Réponse (REPLY_TO) :
- Si tu constates que ta réponse s'adresse directement à un message précis du fil chronologique (par exemple pour répondre à une question passée ou pour corriger une groooosse connerie dite quelques messages plus haut, alors que d'autres messages ont été envoyés depuis), tu peux choisir de cibler ce message précis de l'historique pour y répondre.
- Pour ce faire, ajoute EXACTEMENT à la toute fin de ton message (sur une nouvelle ligne) : REPLY_TO:<Message_ID> (où <Message_ID> est l'ID réel du message ciblé présent dans le fil, ex: REPLY_TO:1488856583827095602).
- N'utilise cela que si le message ciblé n'est pas le tout dernier message du fil. Ne mets rien du tout s'il s'agit de répondre au tout dernier message.

Réponds UNIQUEMENT avec ton message, rien d'autre.

\${BAPHOMET_CAMPAIGNS_KNOWLEDGE}

\${BAPHOMET_HISTORY_KNOWLEDGE}`

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
		context.source === "mention"
			? "mention directe du bot (tu dois répondre pour échanger avec bienveillance, sauf s'il s'agit d'une fin de discussion claire où tu ignores avec IGNORE pour ne pas chercher à avoir le dernier mot)"
			: context.source === "slash"
				? "commande slash /baphomet (tu dois obligatoirement répondre de manière complète, IGNORE interdit)"
				: "écoute passive d'un message du salon (tu restes silencieux avec IGNORE à moins qu'un sujet d'intérêt fort ne survienne ou pour corriger une énorme connerie, évite d'intervenir n'importe quand)"

	const lines = [
		`Canal d'interaction: ${sourceLabel}`,
		`Pseudo: ${context.username}`,
		`Serveur: ${context.guildName ?? "Message privé"}`,
		`Salon: ${context.channelName ?? "inconnu"}`,
		`Préfixe du bot: ${context.prefix ?? env.BOT_PREFIX}`,
		`Modération disponible: ${context.moderationAvailable ? "oui" : "non"}`,
	]

	if (context.conversationHistory && context.conversationHistory.length > 0) {
		lines.push(
			"\n--- FIL CHRONOLOGIQUE DE LA DISCUSSION (DU PLUS ANCIEN AU PLUS RÉCENT) ---",
		)
		context.conversationHistory.forEach((msg, idx) => {
			const dateStr = msg.createdAt.toLocaleString("fr-FR")
			const authorLabel = msg.isBot ? "TOI (Baphomet)" : msg.author
			lines.push(
				`Message_ID: ${msg.id} | [Le ${dateStr}] ${authorLabel}: ${msg.content}`,
			)
		})
	} else {
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
			lines.push(
				"\n--- HISTORIQUE DES 5 DERNIERS MESSAGES DE BAPHOMET (TOI) ---",
			)
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
					targetId:
						typeof args.target_member_id === "string"
							? args.target_member_id
							: undefined,
					nickname: args.nickname,
					reason: typeof args.reason === "string" ? args.reason : "sans raison",
				})
				break
			}
			case "kick_member": {
				if (typeof args.reason !== "string") break
				actions.push({
					type: "kick",
					targetId:
						typeof args.target_member_id === "string"
							? args.target_member_id
							: undefined,
					reason: args.reason,
				})
				break
			}
			case "ban_member": {
				if (typeof args.reason !== "string") break
				actions.push({
					type: "ban",
					targetId:
						typeof args.target_member_id === "string"
							? args.target_member_id
							: undefined,
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
