# Guide de Développement (GEMINI.md) — satan 🤘

Ce document sert de référence pour le développement, le style de code, l'architecture et les bonnes pratiques pour le projet **satan**, développé sur la base du framework **bot.ts** (`@ghom/bot.ts`).

---

## 📖 Sommaire

1. [Présentation & Architecture](#-présentation--architecture)
2. [Style de Code (Biome)](#-style-de-code-biome)
3. [Scripts & Commandes](#-scripts--commandes)
4. [Variables d'Environnement](#-variables-denvironnement)
5. [Règle des Fichiers Natifs (.native.ts)](#-règle-des-fichiers-natifs-nativets)
6. [Guides de Création (Skills)](#-guides-de-création-skills)
    - [Commandes Textuelles (`src/commands/`)](#1-commandes-textuelles-srccommands)
    - [Commandes Slash (`src/slash/`)](#2-commandes-slash-srcslash)
    - [Écouteurs d'Événements (`src/listeners/`)](#3-écouteurs-dévénements-srclisteners)
    - [Boutons Interactifs (`src/buttons/`)](#4-boutons-interactifs-srcbuttons)
    - [Tâches Planifiées / Crons (`src/cron/`)](#5-tâches-planifiées--crons-srccron)
    - [Tables de Base de Données (`src/tables/`)](#6-tables-de-base-de-données-srctables)
    - [Espaces de Noms (`src/namespaces/`) & Middlewares](#7-espaces-de-noms-srcnamespaces--middlewares)
    - [Modules Autonomes (`src/modules/`)](#8-modules-autonomes-srcmodules)

---

## 🏛️ Présentation & Architecture

**bot.ts** est un framework TypeScript structuré et opinionated pour concevoir des bots Discord au-dessus de [discord.js](https://discord.js.org). Il gère automatiquement le chargement de fichiers, la génération de README, l'intégration ORM, et tourne principalement sous le runtime **Bun** pour ce projet.

### Structure du projet

```
src/
├── index.ts              # Bootstrap — initialise les handlers et se connecte à Discord
├── config.ts             # Configuration du client discord.js et schéma Zod de l'env
├── types.ts              # Résolveurs de types personnalisés pour les commandes textuelles
├── core/                 # Internes du framework — NE PAS MODIFIER (*.native.ts)
│   ├── argument.ts       # Moteur de résolution de types
│   ├── button.ts         # Handler des boutons
│   ├── client.ts         # Configuration du client discord.js
│   ├── command.ts        # Handler des commandes textuelles
│   ├── config.ts         # Classe de config
│   ├── cron.ts           # Planificateur Cron
│   ├── database.ts       # ORM (Knex via @ghom/orm)
│   ├── env.ts            # Variables d'environnement (validées par Zod)
│   ├── listener.ts       # Handler des écouteurs d'événements
│   ├── logger.ts         # Logger applicatif
│   ├── module.ts         # Découverte et enregistrement de modules
│   ├── pagination.ts     # Pagination par réactions / boutons
│   ├── slash.ts          # Handler des commandes slash
│   └── util.ts           # Utilitaires globaux
├── commands/             # Commandes textuelles (avec préfixe) — *.ts ou *.native.ts
├── slash/                # Commandes slash — *.ts ou *.native.ts
├── listeners/            # Écouteurs d'événements Discord — categorie.nomEvenement.ts
├── buttons/              # Handlers de boutons d'interaction
├── cron/                 # Tâches planifiées (cron jobs)
├── tables/               # Définitions des tables de base de données (SQLite/PG)
├── namespaces/           # Utilitaires partagés / middlewares
└── modules/              # Modules autonomes (optionnel)
```

### Alias d'Importation (package.json `imports`)

Pour éviter les chemins relatifs verbeux, utilisez toujours les alias suivants :

| Alias | Résolution |
|---|---|
| `#core/*` | `src/core/*` |
| `#config` | `src/config.ts` |
| `#types` | `src/types.ts` |
| `#tables/*` | `src/tables/*` |
| `#buttons/*` | `src/buttons/*` |
| `#namespaces/*` | `src/namespaces/*` |
| `#all` | Ré-exportation de tout l'écosystème (`src/core/index.ts`) |

---

## 🎨 Style de Code (Biome)

Le projet utilise **Biome** pour le formatage et le linting. Règles strictes à appliquer :

* **Indentation** : Tabulations (`tabs`), pas d'espaces.
* **Points-virgules** : Aucun (`no-semi`).
* **Guillemets** : Doubles guillemets `""`.
* **Imports** : Triés et organisés automatiquement par Biome.
* **Pas de `any`** : La règle `no-explicit-any` est activée et obligatoire.
* **Pas d'assertion non-nulle (`!`)** : Autant que possible, évitez de forcer avec `!`.
* **Pas de type `void`** : Utilisez `undefined` pour représenter l'absence de valeur de retour.

> 🛠️ **Commande de formatage** : Exécutez toujours `bun run format` (ou `bunx biome check --write`) après avoir modifié du code.

---

## 🚀 Scripts & Commandes

Toutes les tâches courantes sont scriptées dans le `package.json` :

| Script | Commande | Description |
|---|---|---|
| CLI bot.ts | `bun run bot <cmd>` | Exécute le CLI du framework (ex: `bun run bot add command`) |
| Build | `bun run build` | Compile `src/` vers `dist/` via Rollup et copie les fichiers de conservation |
| Start | `bun run start` | Lance le bot directement depuis les sources avec Bun |
| Test | `bun run test` | Formate le code, vérifie les types (`tsc`) et lance le test d'allumage |
| Format | `bun run format` | Applique le linter/formateur Biome sur tout le projet |
| Watch | `bun run watch` | Lance le bot en mode développement avec rechargement automatique |
| Update | `bun run update` | Met à jour les fichiers internes natifs du framework |
| Readme | `bun run readme` | Génère ou met à jour le fichier README.md à partir des métadonnées du bot |
| Final | `bun run final` | Prépare une build de production optimisée en nettoyant les devDependencies |

---

## 🌐 Variables d'Environnement

Définies dans un fichier `.env` (à copier depuis `.template.env`).

### Variables Standards

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Jeton d'authentification du bot Discord (requis). |
| `BOT_PREFIX` | Préfixe des commandes textuelles (ex: `!`). |
| `BOT_OWNER` | ID Discord du propriétaire du bot. |
| `BOT_ID` | ID de l'application Discord du bot. |
| `BOT_MODE` | `development` \| `production` \| `test` |
| `BOT_GUILD` | ID du serveur de développement (permet l'enregistrement immédiat des commandes slash). |
| `BOT_NAME` | Nom d'affichage du bot. |
| `BOT_TIMEZONE` | Fuseau horaire pour les crons (ex: `Europe/Paris`). |
| `DB_*` | Identifiants de connexion à la base de données. |

### Ajout de Variables Personnalisées

Pour ajouter une variable d'environnement, déclarez-la dans le schéma Zod situé dans `src/config.ts` :

```typescript
envSchema: z.object({
  MA_VARIABLE: z.string(),
})
```

Vous pouvez ensuite y accéder de manière typée via `app.env.MA_VARIABLE`.

---

## 🛡️ Règle des Fichiers Natifs (.native.ts)

Les fichiers se terminant par `.native.ts` (ex: `src/slash/ping.native.ts` ou dans `src/core/`) sont des fichiers de base du framework.
* **Ne modifiez jamais directement un fichier `.native.ts`**.
* Pour personnaliser ou remplacer son comportement, faites-en une copie au même endroit en enlevant le suffixe `.native` (ex: `src/slash/ping.ts`). Le framework chargera automatiquement votre fichier personnalisé à la place de la version native.

---

## 🛠️ Guides de Création (Skills)

### 1. Commandes Textuelles (`src/commands/`)

Permettent de créer des commandes à préfixe (ex: `!ping`). Les fichiers doivent être placés dans `src/commands/` et nommés d'après le nom de la commande.

#### Modèle de base

```typescript
import { Command } from "#core/command"

export default new Command({
  name: "ping",
  description: "Répond par pong",
  channelType: "all", // "guild" | "dm" | "all"
  async run(message) {
    await message.channel.send("Pong !")
  },
})
```

#### Modèle avancé (Arguments & Cooldown)

```typescript
import { Command, CooldownType } from "#core/command"

export default new Command({
  name: "daily-reward",
  description: "Réclamer votre récompense quotidienne",
  channelType: "guild",
  cooldown: {
    duration: 1000 * 60 * 60 * 24, // 24 heures
    type: CooldownType.Global,
  },
  positional: [
    { name: "username", description: "Nom optionnel", type: "string", required: false }
  ],
  options: [
    { name: "multiplier", description: "Multiplicateur de gain", type: "number" }
  ],
  flags: [
    { name: "silent", flag: "s", description: "Ne pas notifier publiquement" }
  ],
  async run(message) {
    // Déclenche le cooldown
    message.triggerCoolDown()

    // Accès aux arguments typés
    const username = message.args.username
    const multiplier = message.args.multiplier
    const isSilent = message.args.silent

    await message.channel.send(`Récompense réclamée pour ${username || message.author} !`)
  },
})
```

#### Règles & Propriétés des arguments :
* **Types d'arguments disponibles** : `string`, `number`, `boolean`, `regex`, `date`, `duration`, `json`, `array`, `string[]`, `number[]`, `boolean[]`, `date[]`, `user`, `member`, `channel`, `role`, `emote`, `invite`, `command`, `slashCommand`.
* Les arguments personnalisés se définissent dans `src/types.ts`.
* On y accède via `message.args.<argName>`.

---

### 2. Commandes Slash (`src/slash/`)

Les commandes slash (`/`) s'enregistrent automatiquement sur Discord. Nommez le fichier en minuscules sans espace dans `src/slash/`.

#### Modèle de base avec options

```typescript
import { SlashCommand } from "#core/slash"

export default new SlashCommand({
  name: "greet",
  description: "Saluer un utilisateur",
  build(builder) {
    builder.addUserOption((opt) =>
      opt.setName("user").setDescription("Qui saluer").setRequired(true)
    )
  },
  async run(interaction) {
    const user = interaction.options.getUser("user", true)
    await interaction.reply({
      content: `Bonjour, ${user} !`,
      ephemeral: true, // Visible uniquement par l'appelant
    })
  },
})
```

#### Modèle avec Sous-Commandes

```typescript
import { SlashCommand } from "#core/slash"

export default new SlashCommand({
  name: "settings",
  description: "Gérer les paramètres",
  build(builder) {
    builder
      .addSubcommand((sub) =>
        sub.setName("show").setDescription("Afficher la configuration")
      )
      .addSubcommand((sub) =>
        sub
          .setName("set")
          .setDescription("Modifier une option")
          .addStringOption((opt) =>
            opt.setName("key").setDescription("Clé de config").setRequired(true)
          )
      )
  },
  async run(interaction) {
    const sub = interaction.options.getSubcommand()
    if (sub === "show") {
      await interaction.reply("Configuration actuelle...")
    } else if (sub === "set") {
      const key = interaction.options.getString("key", true)
      await interaction.reply(`Option ${key} mise à jour !`)
    }
  },
})
```

#### Propriétés Importantes :
* **`guildOnly`** : Limiter la commande aux serveurs.
* **`botOwnerOnly`** : Limiter au créateur du bot.
* **`userPermissions`** : Liste de permissions requises (ex: `["ManageMessages"]`).
* Toujours retourner ou attendre (`await`) l'interaction avec `interaction.reply()` ou `interaction.deferReply()`. Pour les opérations de plus de 3 secondes, faites un `deferReply()` puis `editReply()`.

---

### 3. Écouteurs d'Événements (`src/listeners/`)

Nommez le fichier selon la convention : `<categorie>.<nomEvenement>.ts`.

#### Modèle de base (ex: Accueil de nouveaux membres)

```typescript
import { Listener } from "#core/listener"
import discord from "discord.js"

export default new Listener({
  event: "guildMemberAdd",
  description: "Accueillir les nouveaux membres avec un embed",
  async run(member) {
    const channel = member.guild.systemChannel
    if (!channel) return

    const embed = new discord.EmbedBuilder()
      .setTitle("Bienvenue !")
      .setDescription(`Bienvenue sur **${member.guild.name}**, ${member} !`)
      .setColor(0x5865f2)

    await channel.send({ embeds: [embed] })
  },
})
```

#### Événements spécifiques bot.ts :
* **`afterReady`** : Se déclenche après que TOUS les écouteurs du `clientReady` standard ont terminé leur initialisation. Préférable pour démarrer des services post-connexion.
* **`raw`** : Paquets Gateway bruts.

---

### 4. Boutons Interactifs (`src/buttons/`)

Gèrent les interactions de boutons en évitant les collisions d'IDs.

#### Bouton avec paramètres typés

```typescript
import { Button } from "#core/button"
import { ButtonStyle } from "discord.js"

export type ConfirmDeleteButtonParams = {
  targetId: string
  guildId: string
}

export default new Button<ConfirmDeleteButtonParams>({
  key: "confirm-delete",
  description: "Confirmer la suppression d'une ressource",
  builder: (builder) =>
    builder.setLabel("Confirmer").setStyle(ButtonStyle.Danger),
  async run(interaction, { targetId, guildId }) {
    await interaction.deferUpdate()
    // Code de suppression...
    await interaction.followUp({
      content: `Ressource ${targetId} supprimée du serveur ${guildId}.`,
      ephemeral: true,
    })
  },
})
```

#### Utilisation dans une commande ou un listener

```typescript
import discord from "discord.js"
import confirmDeleteButton from "#buttons/confirm-delete"

await channel.send({
  content: "Êtes-vous sûr de vouloir supprimer cette ressource ?",
  components: [
    new discord.ActionRowBuilder<discord.MessageActionRowComponentBuilder>().addComponents(
      confirmDeleteButton.create({ targetId: "123", guildId: message.guildId! })
    ),
  ],
})
```

#### Règles :
* La propriété `key` doit être unique dans tout le projet.
* Appelez **toujours** `interaction.deferUpdate()` ou `interaction.deferReply()` au début du `run`.
* Les paramètres sont sérialisés dans le `customId` du bouton. Gardez-les courts, car la taille totale du `customId` Discord est limitée à 100 caractères.

---

### 5. Tâches Planifiées / Crons (`src/cron/`)

Permettent de planifier des tâches récurrentes.

#### Intervalle prédéfini (Simplifié)

```typescript
import { Cron } from "#core/cron"

export default new Cron({
  name: "daily-report",
  description: "Envoie un rapport quotidien",
  schedule: "daily", // "minutely" | "hourly" | "daily" | "weekly" | "monthly" | "yearly"
  runOnStart: false,
  async run() {
    // Code exécuté périodiquement
  },
})
```

#### Planification Avancée (Type Cron classique)

```typescript
import { Cron, CronDayOfWeek } from "#core/cron"

export default new Cron({
  name: "weekly-digest",
  description: "Envoie un digest hebdomadaire chaque lundi à 9h30",
  schedule: {
    minute: 30,
    hour: 9,
    dayOfWeek: CronDayOfWeek.Monday,
  },
  runOnStart: false,
  async run() {
    // Exécuté chaque lundi à 9h30
  },
})
```

#### Accès au client Discord global :

```typescript
import { Cron } from "#core/cron"
import * as app from "#all"

export default new Cron({
  name: "status-update",
  description: "Met à jour le statut du bot toutes les heures",
  schedule: "hourly",
  runOnStart: true,
  async run() {
    app.client.user?.setActivity(`surveille ${app.client.guilds.cache.size} serveurs`)
  },
})
```

---

### 6. Tables de Base de Données (`src/tables/`)

Utilise l'ORM `@ghom/orm` basé sur Knex. SQLite3 par défaut (avec possibilité de migrer vers PG ou autre via `bot config database`).

#### Modèle de table avec migrations et cache

```typescript
import { Table, col, migrate } from "@ghom/orm"

export default new Table({
  name: "users",
  description: "Membres enregistrés et scores",
  caching: 300_000, // Active le cache en mémoire pendant 5 minutes (300 000 ms)
  columns: (col) => ({
    id: col.increments(), // Clé primaire auto-incrémentée
    user_id: col.string().unique(),
    username: col.string(),
    score: col.integer().defaultTo(0),
    joined_at: col.timestamp().defaultTo(col.fn.now()),
  }),
  migrations: {
    1: migrate.addColumn("is_premium", col.boolean().defaultTo(false)),
  },
})
```

#### Requêtes usuelles :

```typescript
import usersTable from "#tables/users"

// SELECT
const user = await usersTable.query.where("user_id", "12345").first()

// INSERT
await usersTable.query.insert({ user_id: "123", username: "Alice" })

// UPDATE
await usersTable.query.where("user_id", "123").update({ score: 150 })

// DELETE
await usersTable.query.where("id", 1).delete()

// Utilisation avec Cache
const cachedUser = await usersTable.cache.get("user:123", (q) =>
  q.where("user_id", "123")
)
```

#### Types de colonnes utiles (`col.*`) :
* `increments()`, `string()`, `text()`, `integer()`, `boolean()`, `timestamp()`, `json()`, `enum(["opt1", "opt2"])`.
* Modificateurs chaînables : `.nullable()`, `.defaultTo(value)`, `.unique()`, `.primary()`, `.references("id").inTable("x").onDelete("cascade")`.

---

### 7. Espaces de Noms (`src/namespaces/`) & Middlewares

Les namespaces exportent des fonctions utilitaires, constantes ou middlewares partagés.

#### Modèle de namespace utilitaire / middlewares

```typescript
// src/namespaces/helpers.ts
import { Middleware } from "#core/command"

export const COLORS = {
  primary: 0x5865f2,
  success: 0x57f287,
  error: 0xed4245,
} as const

export function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

// Middleware réutilisable
export const requireAdmin = new Middleware(
  "requireAdmin",
  async (context, data) => {
    if (!context.message.member?.permissions.has("Administrator")) {
      return {
        result: "Vous devez être Administrateur pour utiliser cette commande.",
        data: null,
      }
    }
    return { result: true, data }
  }
)
```

#### Utilisation du middleware dans une commande :

```typescript
import { requireAdmin } from "#namespaces/helpers"

export default new Command({
  name: "admin-only",
  middlewares: [requireAdmin],
  async run(message) {
    // ...
  }
})
```

> ⚠️ **IMPORTANT** : Chaque nouveau namespace créé doit être enregistré dans le champ `imports` de `package.json` afin d'être résolu par `#namespaces/nomFichier`. Le CLI gère cela automatiquement via `bun run bot add namespace <name>`.

---

### 8. Modules Autonomes (`src/modules/`)

Un module est un dossier autonome sous `src/modules/<nom>/` regroupant commandes, slashs, crons, listeners et tables spécifiques à une fonctionnalité.

#### Activation / Désactivation (`modules.json`)

```json
{
  "keepDependencies": [],
  "modules": {
    "leveling": true,
    "moderation": false
  }
}
```

#### Dispatch Automatique à la racine du module

Si vous créez un fichier `.ts` à la racine de votre module (ex: `src/modules/leveling/init.ts`), toutes les instances exportées disposant d'une propriété `type` (`"command"`, `"slash"`, `"listener"`, `"cron"`, `"table"`, `"button"`) seront découvertes et enregistrées automatiquement :

```typescript
import { SlashCommand } from "#core/slash"
import { Listener } from "#core/listener"

export const myCommand = new SlashCommand({ ... })
export const myListener = new Listener({ ... })
```

#### Métadonnées (`module.json`)

Permet de déclarer des dépendances npm spécifiques qui seront injectées automatiquement par le CLI dans le `package.json` du bot :

```json
{
  "name": "leveling",
  "description": "Système d'XP autonome",
  "dependencies": {
    "canvas": "^2.11.2"
  }
}
```

---

## 🚨 Règles et Contraintes de Développement Majeures

1. **Ne modifiez jamais les fichiers `.native.ts`** directement. Faites-en une copie sans le suffixe `.native.ts` pour appliquer des modifications.
2. Utilisez toujours les **alias d'importation** (`#core/*`, `#tables/*`, etc.). Pas de chemins relatifs profonds vers `src/core/`.
3. Lancez systématiquement **`bun run format`** pour aligner le code avec les standards stricts Biome (indentation tabs, double quotes, pas de points-virgules).
4. Pour enregistrer de nouveaux espaces de noms, privilégiez le CLI : **`bun run bot add namespace <nom>`** pour mettre à jour les chemins système dans `package.json`.
5. Si vous ajoutez de nouvelles tables ou migrations de base de données, lancez le bot une fois localement pour déclencher automatiquement les scripts de migration de `@ghom/orm`.
