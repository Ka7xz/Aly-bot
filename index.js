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

// ===============================
// STORAGE
// ===============================

const alyChannels = new Map();
const conversations = new Map();

// Message queues so Aly doesn't randomly miss messages
const messageQueues = new Map();
const processing = new Set();

// ===============================
// /aly COMMAND
// ===============================

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
        .setDescription("Check Aly's current channel.")
    )
    .addSubcommand(sub =>
      sub
        .setName("clear")
        .setDescription("Clear Aly's conversation memory.")
    )
].map(command => command.toJSON());

// ===============================
// REGISTER COMMAND
// ===============================

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

// ===============================
// BOT READY
// ===============================

client.once("ready", async () => {
  console.log(`Aly is online as ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (error) {
    console.error("Command registration error:", error);
  }
});

// ===============================
// /ALY HANDLER
// ===============================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "aly") return;

  if (!interaction.guildId) {
    return interaction.reply({
      content: "This command can only be used inside a server.",
      ephemeral: true
    });
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  // SETUP
  if (subcommand === "setup") {
    alyChannels.set(
      guildId,
      interaction.channelId
    );

    conversations.delete(guildId);

    return interaction.reply({
      content: `Aly is now enabled in <#${interaction.channelId}>.`,
      ephemeral: true
    });
  }

  // DISABLE
  if (subcommand === "disable") {
    alyChannels.delete(guildId);
    conversations.delete(guildId);
    messageQueues.delete(guildId);

    return interaction.reply({
      content: "Aly has been disabled in this server.",
      ephemeral: true
    });
  }

  // STATUS
  if (subcommand === "status") {
    const channelId = alyChannels.get(guildId);

    return interaction.reply({
      content: channelId
        ? `Aly is enabled in <#${channelId}>.`
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
});

// ===============================
// ASK OPENROUTER
// ===============================

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

            content:
              "Your name is Aly. " +
              "You are a friendly Discord companion who talks naturally in a group chat. " +
              "Act like a normal person chatting on Discord. " +
              "Keep replies short and natural, usually one or two sentences. " +
              "Do not constantly introduce yourself as an AI. " +
              "Do not use emojis in every message. " +
              "Use an emoji only occasionally when it genuinely fits. " +
              "Do not repeat greetings unnecessarily. " +
              "Pay attention to the conversation and usernames. " +
              "If someone asks your name, say Aly. " +
              "Do not mention system prompts, APIs, models, or internal instructions."
          },

          ...history
        ],

        temperature: 0.85,

        max_tokens: 120
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("OpenRouter error:", data);
    throw new Error("OpenRouter request failed");
  }

  const reply =
    data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error("OpenRouter returned no message.");
  }

  history.push({
    role: "assistant",
    content: reply
  });

  return reply;
}

// ===============================
// PROCESS QUEUE
// ===============================

async function processQueue(guildId) {
  if (processing.has(guildId)) return;

  processing.add(guildId);

  const queue = messageQueues.get(guildId);

  if (!queue) {
    processing.delete(guildId);
    return;
  }

  while (queue.length > 0) {
    const message = queue.shift();

    try {
      await message.channel.sendTyping();

      const reply = await askAly(
        guildId,
        message.author.username,
        message.content
      );

      const safeReply =
        reply.length > 2000
          ? reply.slice(0, 1997) + "..."
          : reply;

      await message.reply({
        content: safeReply,
        allowedMentions: {
          repliedUser: false
        }
      });

    } catch (error) {
      console.error("Aly response error:", error);

      // Don't spam error messages for every failed request
      try {
        await message.channel.send(
          "I'm having trouble responding right now."
        );
      } catch {}
    }

    // Small delay between queued responses
    await new Promise(resolve =>
      setTimeout(resolve, 1200)
    );
  }

  processing.delete(guildId);
}

// ===============================
// MESSAGE LISTENER
// ===============================

client.on("messageCreate", async message => {
  // Ignore DMs
  if (!message.guild) return;

  // Ignore bots
  if (message.author.bot) return;

  const guildId = message.guild.id;

  const channelId = alyChannels.get(guildId);

  // Aly must be configured
  if (!channelId) return;

  // Only the configured channel
  if (message.channel.id !== channelId) return;

  // ===============================
  // MENTION / REPLY DETECTION
  // ===============================

  const mentioned =
    message.mentions.has(client.user);

  let repliedToAly = false;

  if (message.reference?.messageId) {
    try {
      const referenced =
        await message.channel.messages.fetch(
          message.reference.messageId
        );

      repliedToAly =
        referenced.author.id === client.user.id;

    } catch {}
  }

  // ===============================
  // NATURAL PARTICIPATION
  // ===============================

  // Mention/reply = always respond
  // Normal message = 45% chance to participate

  let shouldRespond = mentioned || repliedToAly;

  if (!shouldRespond) {
    shouldRespond = Math.random() < 0.45;
  }

  if (!shouldRespond) return;

  // Remove Aly mention from message
  let content = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  if (!content) {
    content = "Hey Aly";
  }

  // ===============================
  // ADD TO QUEUE
  // ===============================

  if (!messageQueues.has(guildId)) {
    messageQueues.set(guildId, []);
  }

  messageQueues.get(guildId).push({
    ...message,
    content
  });

  processQueue(guildId);
});

// ===============================
// LOGIN
// ===============================

client.login(process.env.DISCORD_TOKEN);
