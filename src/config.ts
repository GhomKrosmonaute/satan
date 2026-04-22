import { Options, Partials } from "discord.js"
import { z } from "zod"
import { Config } from "#core/config"

export const config = new Config({
	ignoreBots: true,
	openSource: true,
	envSchema: z.object({
		OPENAI_API_KEY: z.string({
			message:
				"You need to add your OPENAI_API_KEY in the .env file. Get one at https://platform.openai.com/api-keys",
		}),
	}),
	permissions: ["Administrator"],
	client: {
		intents: [
			"Guilds",
			"GuildMembers",
			"GuildMessages",
			"GuildMessageReactions",
			"GuildMessageTyping",
			"DirectMessages",
			"DirectMessageReactions",
			"DirectMessageTyping",
			"MessageContent",
		],
		partials: [Partials.Channel, Partials.Message, Partials.Reaction],
		makeCache: Options.cacheWithLimits({
			...Options.DefaultMakeCacheSettings,

			// don't cache reactions
			ReactionManager: 0,
		}),
		sweepers: {
			...Options.DefaultSweeperSettings,
			messages: {
				// every hour (in second)
				interval: 60 * 60,

				// 6 hours
				lifetime: 60 * 60 * 6,
			},
		},
	},
})

export default config.options
