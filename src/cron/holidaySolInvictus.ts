import { Cron, CronMonth } from "#core/cron"
import { celebrate } from "#namespaces/holidays"

/**
 * See the {@link https://ghom.gitbook.io/bot.ts/usage/create-a-cron cron guide} for more information.
 */
export default new Cron({
	name: "holidaySolInvictus",
	description: "The Sol Invictus holiday",
	schedule: {
		second: 0,
		minute: 0,
		hour: 0,
		dayOfMonth: 25,
		month: CronMonth.December,
		dayOfWeek: "*",
	},
	async run() {
		await celebrate("SolInvictus")
	},
})
