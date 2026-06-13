import { GoogleGenAI } from "@google/genai"
import env from "#core/env"

const MODEL = "gemini-2.5-flash"

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
	if (!client) {
		client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
	}
	return client
}

async function generateText(
	system: string,
	user: string,
	maxOutputTokens: number,
): Promise<string | undefined> {
	const response = await getClient().models.generateContent({
		model: MODEL,
		contents: user,
		config: {
			systemInstruction: system,
			maxOutputTokens,
			temperature: 1,
		},
	})

	return response.text?.trim()
}

export async function generateWelcomeMessage(context: {
	username: string
	accountCreatedAt: string
	presentationText?: string
	memberCount?: number
}): Promise<string> {
	const text = await generateText(
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
		200,
	)

	if (!text) {
		return fallbackMessage()
	}

	return text
}

export async function generateMentionReply(context: {
	username: string
	userMention: string
	message: string
	prefix: string
	guildName?: string
	channelName?: string
}): Promise<string> {
	const text = await generateText(
		`Tu es Baphomet/Satan, une voix mystique mais bienveillante sur un serveur Discord francophone.

Objectif : répondre quand on mentionne le bot.

Contraintes :
- Réponds en français, 1 à 3 phrases maximum.
- Adresse-toi au membre en incluant EXACTEMENT une fois : {{USER}}
- Style : solennel, un brin théâtral, mais centré sur la raison, la curiosité et l'autonomie.
- N'utilise pas @everyone / @here, n'inclus pas d'autres mentions.
- Ne mentionne jamais "TST" ni "The Satanic Temple" : dis seulement "le Temple".
- Si le message est vide ou flou, propose une question courte pour clarifier.
- N'ajoute ni markdown lourd, ni listes ; reste percutant.`,
		[
			`Pseudo: ${context.username}`,
			`Serveur: ${context.guildName ?? "DM"}`,
			context.channelName ? `Salon: #${context.channelName}` : null,
			`Prefix: ${context.prefix}`,
			`Message: ${context.message || "(vide)"}`,
		]
			.filter(Boolean)
			.join("\n"),
		180,
	)

	if (!text)
		return `${context.userMention}, je t’entends. Parle clairement : que cherches-tu dans le Temple ?`

	return text.replace(/\{\{USER}}/g, context.userMention)
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
