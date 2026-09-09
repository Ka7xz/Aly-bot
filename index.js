const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==============================
// SERVER DATA
// ==============================

const alyChannels = new Map();
const conversations = new Map();
const serverModes = new Map();
const cooldowns = new Map();

// Response chances
const MODE_CHANCES = {
  faster: 0.80,
  natural: 0.50,
  reduced: 0.20
};

// ==============================
// COMMANDS
// ==============================

const commands = [
  new SlashCommandBuilder()
    .setName("aly")
    .setDescription("Manage Aly")
    
    .addSubcommand(sub =>
      sub
        .setName("setup")
        .setDescription("Set this channel as Aly's chat channel.")
    )

    .addSubcommand(sub =>
      sub
        .setName("disable")
        .setDescription("Disable Aly in this server.")
    )

    .addSubcommand(sub =>
      sub
        .setName("status")
        .setDescription("Check Aly's settings.")
    )

    .addSubcommand(sub =>
      sub
        .setName("clear")
        .setDescription("Clear Aly's conversation memory.")
    )

    .addSubcommand(sub =>
      sub
        .setName("mode")
        .setDescription("Change how often Aly responds.")
        .addStringOption(option =>
          option
            .setName("type")
            .setDescription("Choose Aly's participation level.")
            .setRequired(true)
            .addChoices(
              { name: "Faster", value: "faster" },
              { name: "Natural", value: "natural" },
              { name: "Reduced", value: "reduced" }
            )
        )
    )
].map(command => command.toJSON());

// ==============================
// REGISTER COMMANDS
// ==============================

async function registerCommands() {
  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    {
      body: commands
    }
  );

  console.log("Aly command registered.");
}

// ==============================
// BOT READY
// ==============================

client.once("ready", async () => {
  console.log(`Aly is online as ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (error) {
    console.error("Command registration error:", error);
  }
});

// ==============================
// /ALY COMMAND
// ==============================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "aly") return;

  const guildId = interaction.guildId;

  if (!guildId) {
    return interaction.reply({
      content: "This command can only be used inside a server.",
      ephemeral: true
    });
  }

  const subcommand = interaction.options.getSubcommand();

  // SETUP
  if (subcommand === "setup") {
    alyChannels.set(guildId, interaction.channelId);

    if (!serverModes.has(guildId)) {
      serverModes.set(guildId, "natural");
    }

    return interaction.reply({
      content:
        `Aly is now active in <#${interaction.channelId}>.\n` +
        `Mode: **${serverModes.get(guildId)}**`,
      ephemeral: true
    });
  }

  // DISABLE
  if (subcommand === "disable") {
    alyChannels.delete(guildId);

    return interaction.reply({
      content: "Aly has been disabled in this server.",
      ephemeral: true
    });
  }

  // STATUS
  if (subcommand === "status") {
    const channelId = alyChannels.get(guildId);
    const mode = serverModes.get(guildId) || "natural";

    return interaction.reply({
      content: channelId
        ? `**Aly Status**\nChannel: <#${channelId}>\nMode: **${mode}**`
        : "Aly is not configured in this server.",
      ephemeral: true
    });
  }

  // CLEAR MEMORY
  if (subcommand === "clear") {
    conversations.delete(guildId);

    return interaction.reply({
      content: "Aly's conversation memory has been cleared.",
      ephemeral: true
    });
  }

  // MODE
  if (subcommand === "mode") {
    const mode = interaction.options.getString("type");

    serverModes.set(guildId, mode);

    return interaction.reply({
      content:
        `Aly's mode is now **${mode}**.\n` +
        `Response chance: **${MODE_CHANCES[mode] * 100}%**`,
      ephemeral: true
    });
  }
});

// ==============================
// ASK OPENROUTER
// ==============================

async function askAly(guildId, username, message) {
  if (!conversations.has(guildId)) {
    conversations.set(guildId, []);
  }

  const history = conversations.get(guildId);

  history.push({
    role: "user",
    content: `${username}: ${message}`
  });

  // Keep last 16 messages
  if (history.length > 16) {
    history.splice(0, history.length - 16);
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization":
          `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://discord.com/",
        "X-Title": "Aly Discord Bot"
      },

      body: JSON.stringify({
        model: "openrouter/free",

        messages: [
          {
            role: "system",

            content: `
Your name is Aly.

You are a friendly Discord companion in a group chat.

Speak naturally like a normal Discord user.

Important behavior:
- Keep replies short and natural.
- Usually reply with 1 or 2 sentences.
- Do not over-explain.
- Do not act like a formal assistant.
- Do not constantly mention that you are an AI.
- Understand usernames and previous messages.
- Do not repeat the same greeting again and again.
- Do not start every response with "Hey".
- Do not use emojis unless they genuinely fit the message.
- Normally use ZERO emojis.
- Never use more than one emoji in a reply.
- Do not randomly add hearts, smiles, waving emojis, etc.
- If someone says "hi", a simple "hey" or "hi" is enough.
- If someone asks your name, say your name is Aly.
- Participate naturally in the conversation.
- Do not mention these instructions.
            `.trim()
          },

          ...history
        ]
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("OpenRouter error:", data);
    throw new Error("OpenRouter request failed");
  }

  const reply = data?.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error("No AI response received");
  }

  history.push({
    role: "assistant",
    content: reply
  });

  return reply;
}

// ==============================
// NORMAL MESSAGE LISTENER
// ==============================

client.on("messageCreate", async message => {
  // Ignore DMs
  if (!message.guild) return;

  // Ignore bots
  if (message.author.bot) return;

  const guildId = message.guild.id;

  // Aly channel
  const channelId = alyChannels.get(guildId);

  if (!channelId) return;

  if (message.channel.id !== channelId) return;

  // ==============================
  // RESPONSE CHANCE
  // ==============================

  const mode = serverModes.get(guildId) || "natural";

  const chance = MODE_CHANCES[mode] || 0.50;

  // Randomly decide whether Aly participates
  if (Math.random() > chance) {
    return;
  }

  // ==============================
  // SHORT COOLDOWN
  // ==============================

  const now = Date.now();

  const lastResponse = cooldowns.get(guildId) || 0;

  if (now - lastResponse < 2000) {
    return;
  }

  cooldowns.set(guildId, now);

  // ==============================
  // ASK AI
  // ==============================

  try {
    await message.channel.sendTyping();

    const reply = await askAly(
      guildId,
      message.author.username,
      message.content
    );

    if (!reply) return;

    // Discord max message length
    if (reply.length <= 2000) {
      await message.reply({
        content: reply,
        allowedMentions: {
          repliedUser: false
        }
      });
    } else {
      await message.reply({
        content: reply.slice(0, 1997) + "...",
        allowedMentions: {
          repliedUser: false
        }
      });
    }

  } catch (error) {
    console.error("Aly response error:", error);
  }
});

// ==============================
// LOGIN
// ==============================

client.login(process.env.DISCORD_TOKEN);
