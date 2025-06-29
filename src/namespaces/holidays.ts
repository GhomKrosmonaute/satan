import discord from "discord.js"
import {getSendableChannel, guildID} from "#namespaces/tst"

interface Holiday {
	emoji: string
	name: string
	description: string
	onCelebrate?: () => Promise<void>
	date: Date
}

type Holidays = Record<string, Holiday>

type HolidayName = keyof typeof holidays

export const holidays = {
	Lupercalia: {
		emoji: "💘",
		name: "Lupercales",
		description:
			"Célébration de l’autonomie corporelle, de la libération sexuelle et de la reproduction. Inspirée de la fête romaine de même nom, Lupercalia tombe le 15 février. Conformément à la tradition ancienne, les 13 et 14 février sont observés comme jours de fête préparatoire. Pour le TST, c’est une « journée de glorification de soi », parallèle aux traditions centrées sur les autres comme Sol Invictus.",
		date: new Date("2025-02-15"),
	},
	Hexennacht: {
		emoji: "🧙‍♀️",
		name: "Nuit des sorcières",
		description:
			"Occasion pour honorer ceux qui furent victimes de superstition et pseudo-science, que ce soit pendant une chasse aux sorcières, une panique satanique ou d’autres injustices. Basée sur la Walpurgisnacht telle que décrite dans Faust de Goethe, c’est une fête solennelle pour commémorer ces victimes.",
		date: new Date("2025-04-30"),
	},
	UnveilingDay: {
		emoji: "🗿",
		name: "Journée du dévoilement",
		description:
			"Célébration de la pluralité religieuse et du rejet de la superstition archaïque. Monument central du mouvement satanique moderne, la statue de Baphomet avec des enfants a été commandée en 2014 et dévoilée le 25 juillet 2015 à Detroit. Cette date marque le début de la nouvelle ère sataniste.",
		date: new Date("2025-07-25"),
	},
	Halloween: {
		emoji: "🎃",
		name: "Halloween",
		description:
			"Fête pour célébrer l’indulgence, embrasser l’obscurité et son esthétique. Halloween est souvent qualifiée de maléfique, démoniaque et satanique par les dogmatismes religieux. Costumes, bonbons et affronter ses peurs sont encouragés.",

		date: new Date("2025-10-31"),
	},
	SolInvictus: {
		emoji: "🌞",
		name: "Sol Invictus",
		description:
			"Célébration d’être invaincu par la superstition et de la poursuite constante, ainsi que du partage du savoir. Le culte de Sol existait à Rome depuis la république, Invictus étant un épithète pour Jupiter, Mars et Apollon. La fête honorait ces dieux et était probablement liée au solstice d’hiver.",

		date: new Date("2025-12-25"),
	},
} as const satisfies Holidays

export function celebrateEmbed(holiday: Holiday) {
	return new discord.EmbedBuilder()
		.setTitle(`${holiday.emoji} ${holiday.name}`)
		.setDescription(holiday.description)
		.setColor(0x8b0000)
		.setTimestamp()
}

export async function celebrate(holidayName: HolidayName) {
	const holiday = holidays[holidayName] as Holiday
	const announcements = await getSendableChannel("announcements")
	await announcements.send({ content: `<@${guildID}>`, embeds: [celebrateEmbed(holiday)] })
	await holiday.onCelebrate?.()
}
