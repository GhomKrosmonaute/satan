![Bot avatar](https://cdn.discordapp.com/avatars/1388839175205425232/aee2993ff84634308b2a3d004cb88aeb.png?size=128&fit=cover&mask=circle)

# satan

> Made with [bot.ts](https://ghom.gitbook.io/bot-ts/) by **ghom**  
> CLI version: `9.0.14`  
> Bot.ts version: `v9.0.0-Nirbose`  
> Licence: `ISC`

## Description

Satan en personne 🤘  
This bot is private and cannot be invited in other servers.

## Specifications

You can find the documentation of bot.ts [here](https://ghom.gitbook.io/bot-ts/).  
Below you will find the specifications for **satan**.

## Configuration file

```ts
import { Options, Partials } from "discord.js"
import { z } from "zod"
import { Config } from "#core/config"

export const config = new Config({
	ignoreBots: true,
	openSource: true,
	envSchema: z.object({}),
	permissions: ["Administrator"],
	client: {
		intents: [
			"Guilds",
			"GuildMessages",
			"GuildMessageReactions",
			"GuildMessageTyping",
			"DirectMessages",
			"DirectMessageReactions",
			"DirectMessageTyping",
			"MessageContent",
		],
		partials: [Partials.Channel],
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

```

## Cron jobs

- [holidayHalloween](src/cron/holidayHalloween.ts) - The Halloween holiday  
- [holidayHexennacht](src/cron/holidayHexennacht.ts) - The Hexennacht holiday  
- [holidayLupercalia](src/cron/holidayLupercalia.ts) - The Lupercalia holiday  
- [holidaySolInvictus](src/cron/holidaySolInvictus.ts) - The Sol Invictus holiday  
- [holidayUnveilingDay](src/cron/holidayUnveilingDay.ts) - The Unveiling Day

## Commands

### Slash commands

- [/help](src/slash/help.native.ts) - Show slash command details or list all slash commands  
- [/ping](src/slash/ping.native.ts) - Get the bot ping

### Textual commands

- [database](src/commands/database.native.ts) - Run SQL query on database  
- [eval](src/commands/eval.native.ts) - JS code evaluator  
- [help](src/commands/help.native.ts) - Help menu  
- [info](src/commands/info.native.ts) - Get information about bot  
- [terminal](src/commands/terminal.native.ts) - Run shell command from Discord  
- [turn](src/commands/turn.native.ts) - Turn on/off command handling

## Buttons

- [pagination](src/buttons/pagination.native.ts) - The pagination button

## Listeners

### Button  

- [interactionCreate](src/listeners/button.interactionCreate.native.ts) - Handle the interactions for buttons  

### Command  

- [messageCreate](src/listeners/command.messageCreate.native.ts) - Handle the messages for commands  

### Cron  

- [ready](src/listeners/cron.ready.native.ts) - Launch all cron jobs  

### Log  

- [afterReady](src/listeners/log.afterReady.native.ts) - Just log that bot is ready  

### Pagination  

- [messageDelete](src/listeners/pagination.messageDelete.native.ts) - Remove existing deleted paginator  
- [messageReactionAdd](src/listeners/pagination.messageReactionAdd.native.ts) - Handle the reactions for pagination  

### Slash  

- [guildCreate](src/listeners/slash.guildCreate.native.ts) - Deploy the slash commands to the new guild  
- [interactionCreate](src/listeners/slash.interactionCreate.native.ts) - Handle the interactions for slash commands  
- [ready](src/listeners/slash.ready.native.ts) - Deploy the slash commands

## Database

Using **pg@latest** as database.  
Below you will find a list of all the tables used by **satan**.

> No tables have been created yet.

## Information

This readme.md is dynamic, it will update itself with the latest information.  
If you see a mistake, please report it and an update will be made as soon as possible.

- Used by: **1** Discord guild
- Last update date: **6/29/2025**
