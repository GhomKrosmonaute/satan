import { Cron, CronMonth } from "#core/cron"
import { celebrate } from "#namespaces/holidays"

/**
 * See the {@link https://ghom.gitbook.io/bot.ts/usage/create-a-cron cron guide} for more information.
 */
export default new Cron({
	name: "holidayLupercalia",
	description: "The Lupercalia holiday",
	schedule: {
		second: 0,
		minute: 0,
		hour: 0,
		dayOfMonth: 15,
		month: CronMonth.February,
		dayOfWeek: "*",
	},
	async run() {
		await celebrate("Lupercalia")
	},
})
