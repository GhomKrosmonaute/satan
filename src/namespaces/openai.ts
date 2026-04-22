import OpenAI from "openai"
import env from "#core/env"

let client: OpenAI | null = null

function getClient(): OpenAI {
	if (!client) {
		client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
	}
	return client
}

export async function generateWelcomeMessage(context: {
	username: string
	accountCreatedAt: string
	presentationText?: string
	memberCount?: number
}): Promise<string> {
	const response = await getClient().chat.completions.create({
		model: "gpt-4o-mini",
		max_tokens: 200,
		temperature: 1,
		messages: [
			{
				role: "system",
				content: `Tu es Baphomet, le gardien d'un serveur Discord du Temple Satanique de France (TST). Tu accueilles les nouveaux membres avec bienveillance, dans l'esprit du satanisme moderne : raison, empathie, liberté individuelle, justice, autonomie corporelle et connaissance.

Génère un court message de bienvenue (2-3 phrases max) pour un nouveau membre qui vient d'être approuvé. Le message doit :
- Commencer par "🐐 *Les portes du Temple s'ouvrent.*\n\n"
- Mentionner le membre avec la syntaxe exacte : {{MEMBER}}
- Être chaleureux mais solennel, dans un registre mystique et bienveillant
- Varier à chaque fois (ne pas répéter les mêmes formules)
- Intégrer subtilement des éléments du profil du membre si disponibles (ancienneté du compte, contenu de la présentation)
- Ne JAMAIS mentionner directement "The Satanic Temple" ou "TST", utiliser "le Temple" ou "nos rangs"
- Rester court et percutant

Réponds UNIQUEMENT avec le message, rien d'autre.`,
			},
			{
				role: "user",
				content: buildUserPrompt(context),
			},
		],
	})

	const text = response.choices[0]?.message?.content?.trim()

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
