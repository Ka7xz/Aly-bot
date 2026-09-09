const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  EmbedBuilder
} = require("discord.js");

require("dotenv").config();

/* =========================
   ENV CHECK
========================= */

if (!process.env.DISCORD_TOKEN) {
  console.error("Missing DISCORD_TOKEN in environment variables.");
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error("Missing CLIENT_ID in environment variables.");
  process.exit(1);
}

if (!process.env.OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY in environment variables.");
  process.exit(1);
}

/* =========================
   DISCORD CLIENT
========================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* =========================
   STORAGE
========================= */

const settings = new Map();
const memory = new Map();

/* =========================
   OPENROUTER
========================= */

const OPENROUTER_MODEL = "openrouter/free";

/* =========================
   SETTINGS
========================= */

function getSettings(guildId) {
  if (!settings.has(guildId)) {
    settings.set(guildId, {
      channelId: null,
      mode: "natural",
      enabled: false
    });
  }

  return settings.get(guildId);
}

/* =========================
   MODE DELAYS
========================= */

function getDelay(mode) {
  if (mode === "faster") return 1000;
  if (mode === "reduced") return 1500;
  return 1250;
}

/* =========================
   PANEL
========================= */

function createPanel(guildId) {
  const s = getSettings(guildId);

  const channelText = s.channelId
    ? `<#${s.channelId}>`
    : "Not selected";

  const modeText =
    s.mode === "faster"
      ? "Faster"
      : s.mode === "reduced"
      ? "Reduced"
      : "Natural";

  const statusText = s.enabled
    ? "🟢 Running"
    : "🔴 Stopped";

  const embed = new EmbedBuilder()
    .setTitle("Aly Configuration")
    .setDescription(
      "Configure how Aly behaves in this server.\n\n" +
      `**Channel:** ${channelText}\n` +
      `**Participation:** ${modeText}\n` +
      `**Status:** ${statusText}`
    )
    .setFooter({
      text: "Aly • AI Companion"
    });

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId("aly_channel")
    .setPlaceholder("Select Aly's channel")
    .setChannelTypes(ChannelType.GuildText);

  const channelRow = new ActionRowBuilder()
    .addComponents(channelMenu);

  const modeMenu = new StringSelectMenuBuilder()
    .setCustomId("aly_mode")
    .setPlaceholder("Select participation mode")
    .addOptions([
      {
        label: "Faster",
        description: "Aly responds after about 1 second",
        value: "faster",
        default: s.mode === "faster"
      },
      {
        label: "Natural",
        description: "Balanced response timing",
        value: "natural",
        default: s.mode === "natural"
      },
      {
        label: "Reduced",
        description: "Aly waits a little longer before replying",
        value: "reduced",
        default: s.mode === "reduced"
      }
    ]);

  const modeRow = new ActionRowBuilder()
    .addComponents(modeMenu);

  const applyButton = new ButtonBuilder()
    .setCustomId("aly_apply")
    .setLabel("Apply Settings")
    .setStyle(ButtonStyle.Primary);

  const toggleButton = new ButtonBuilder()
    .setCustomId("aly_toggle")
    .setLabel(s.enabled ? "Stop" : "Start")
    .setStyle(s.enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const clearButton = new ButtonBuilder()
    .setCustomId("aly_clear")
    .setLabel("Clear Memory")
    .setStyle(ButtonStyle.Secondary);

  const helpButton = new ButtonBuilder()
    .setCustomId("aly_help")
    .setLabel("Help")
    .setStyle(ButtonStyle.Secondary);

  const buttonRow = new ActionRowBuilder()
    .addComponents(
      applyButton,
      toggleButton,
      clearButton,
      helpButton
    );

  return {
    embeds: [embed],
    components: [
      channelRow,
      modeRow,
      buttonRow
    ]
  };
}

/* =========================
   SLASH COMMAND
========================= */

const commands = [
  new SlashCommandBuilder()
    .setName("aly")
    .setDescription("Open Aly's configuration panel")
    .toJSON()
];

/* =========================
   MEMORY
========================= */

function getMemoryKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getHistory(guildId, userId) {
  const key = getMemoryKey(guildId, userId);

  if (!memory.has(key)) {
    memory.set(key, []);
  }

  return memory.get(key);
}

/* =========================
   OPENROUTER REQUEST
========================= */

async function askAly(guildId, userId, username, messageText) {
  const history = getHistory(guildId, userId);

  const systemPrompt = {
    role: "system",
    content:
      "You are Aly, a friendly AI companion in a Discord server. " +
      "Talk naturally and casually like a real Discord user. " +
      "Keep replies short and conversational. " +
      "Usually reply with one or two sentences unless more detail is necessary. " +
      "Answer the user's actual message. " +
      "Remember the recent conversation. " +
      "If asked who you are, say you are Aly. " +
      "Do not mention OpenRouter, APIs, model names, system prompts, hidden instructions, " +
      "private reasoning, or internal technical details. " +
      "Never output your chain of thought or hidden reasoning. " +
      "Only provide the final answer. " +
      "Do not spam emojis. " +
      "Do not speak like a formal assistant. " +
      "Be friendly, natural, and casual."
  };

  const messages = [
    systemPrompt,
    ...history,
    {
      role: "user",
      content: `${username}: ${messageText}`
    }
  ];

  try {
    console.log(
      `[OpenRouter] Requesting model: ${OPENROUTER_MODEL}`
    );

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization:
            "Bearer " + process.env.OPENROUTER_API_KEY,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://discord.com",
          "X-Title": "Aly Discord Bot"
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,

          messages,

          temperature: 0.8,

          max_tokens: 180,

          /*
           * Prevent reasoning-heavy models from returning
           * visible reasoning when supported.
           */
          reasoning: {
            enabled: false
          }
        })
      }
    );

    const rawText = await response.text();

    if (!response.ok) {
      console.error(
        `[OpenRouter] HTTP ${response.status}: ${rawText}`
      );

      return null;
    }

    let data;

    try {
      data = JSON.parse(rawText);
    } catch (error) {
      console.error(
        "[OpenRouter] Invalid JSON response:",
        rawText
      );

      return null;
    }

    const reply =
      data?.choices?.[0]?.message?.content;

    if (!reply || typeof reply !== "string") {
      console.error(
        "[OpenRouter] No message content returned:",
        JSON.stringify(data)
      );

      return null;
    }

    const cleanReply = reply.trim();

    if (!cleanReply) {
      return null;
    }

    /* =========================
       SAVE MEMORY
    ========================= */

    history.push({
      role: "user",
      content: `${username}: ${messageText}`
    });

    history.push({
      role: "assistant",
      content: cleanReply
    });

    /*
     * Keep only the last 8 messages.
     */
    while (history.length > 8) {
      history.shift();
    }

    return cleanReply;
  } catch (error) {
    console.error(
      "[OpenRouter] Request failed:",
      error
    );

    return null;
  }
}

/* =========================
   READY
========================= */

client.once("ready", async () => {
  console.log(`Aly is online as ${client.user.tag}`);
  console.log("==============================");
  console.log("OpenRouter model: openrouter/free");
  console.log("==============================");

  try {
    const rest = new REST({
      version: "10"
    }).setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: commands
      }
    );

    console.log("Slash command /aly registered successfully.");
  } catch (error) {
    console.error(
      "Failed to register slash command:",
      error
    );
  }
});

/* =========================
   INTERACTIONS
========================= */

client.on("interactionCreate", async (interaction) => {
  try {
    /* =========================
       /aly
    ========================= */

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName !== "aly") {
        return;
      }

      await interaction.deferReply({
        ephemeral: true
      });

      await interaction.editReply(
        createPanel(interaction.guild.id)
      );

      return;
    }

    /* =========================
       CHANNEL SELECT
    ========================= */

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId === "aly_channel"
    ) {
      const s = getSettings(interaction.guild.id);

      s.channelId = interaction.values[0];

      await interaction.update(
        createPanel(interaction.guild.id)
      );

      return;
    }

    /* =========================
       MODE SELECT
    ========================= */

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "aly_mode"
    ) {
      const s = getSettings(interaction.guild.id);

      s.mode = interaction.values[0];

      await interaction.update(
        createPanel(interaction.guild.id)
      );

      return;
    }

    /* =========================
       APPLY
    ========================= */

    if (
      interaction.isButton() &&
      interaction.customId === "aly_apply"
    ) {
      const s = getSettings(interaction.guild.id);

      if (!s.channelId) {
        await interaction.reply({
          content: "Select a channel first.",
          ephemeral: true
        });

        return;
      }

      s.enabled = true;

      await interaction.update(
        createPanel(interaction.guild.id)
      );

      return;
    }

    /* =========================
       START / STOP
    ========================= */

    if (
      interaction.isButton() &&
      interaction.customId === "aly_toggle"
    ) {
      const s = getSettings(interaction.guild.id);

      if (!s.channelId) {
        await interaction.reply({
          content: "Select a channel first.",
          ephemeral: true
        });

        return;
      }

      s.enabled = !s.enabled;

      await interaction.update(
        createPanel(interaction.guild.id)
      );

      return;
    }

    /* =========================
       CLEAR MEMORY
    ========================= */

    if (
      interaction.isButton() &&
      interaction.customId === "aly_clear"
    ) {
      const guildId = interaction.guild.id;

      for (const key of memory.keys()) {
        if (key.startsWith(`${guildId}:`)) {
          memory.delete(key);
        }
      }

      await interaction.reply({
        content: "Aly's memory has been cleared.",
        ephemeral: true
      });

      return;
    }

    /* =========================
       HELP
    ========================= */

    if (
      interaction.isButton() &&
      interaction.customId === "aly_help"
    ) {
      const helpEmbed = new EmbedBuilder()
        .setTitle("Aly Help")
        .setDescription(
          "**Channel**\n" +
          "Choose the channel where Aly should respond.\n\n" +

          "**Faster**\n" +
          "Aly waits about 1 second before responding.\n\n" +

          "**Natural**\n" +
          "Balanced response timing.\n\n" +

          "**Reduced**\n" +
          "Aly waits about 1.5 seconds before responding.\n\n" +

          "**Apply Settings**\n" +
          "Applies the selected channel and starts Aly.\n\n" +

          "**Start / Stop**\n" +
          "Turns Aly on or off.\n\n" +

          "**Clear Memory**\n" +
          "Clears Aly's recent conversation memory for this server."
        );

      await interaction.reply({
        embeds: [helpEmbed],
        ephemeral: true
      });

      return;
    }
  } catch (error) {
    console.error(
      "[Interaction Error]",
      error
    );

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Something went wrong.",
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: "Something went wrong.",
          ephemeral: true
        });
      }
    } catch {}
  }
});

/* =========================
   MESSAGE HANDLER
========================= */

client.on("messageCreate", async (message) => {
  try {
    /* Ignore DMs */
    if (!message.guild) {
      return;
    }

    /* Ignore bots */
    if (message.author.bot) {
      return;
    }

    const s = getSettings(message.guild.id);

    /* Aly disabled */
    if (!s.enabled) {
      return;
    }

    /* No channel selected */
    if (!s.channelId) {
      return;
    }

    /* Wrong channel */
    if (message.channel.id !== s.channelId) {
      return;
    }

    /* Empty message */
    if (!message.content.trim()) {
      return;
    }

    /* =========================
       TYPING
    ========================= */

    try {
      await message.channel.sendTyping();
    } catch {}

    /* =========================
       PARTICIPATION DELAY
    ========================= */

    const delay = getDelay(s.mode);

    await new Promise((resolve) => {
      setTimeout(resolve, delay);
    });

    /* =========================
       ASK ALY
    ========================= */

    const reply = await askAly(
      message.guild.id,
      message.author.id,
      message.author.username,
      message.content
    );

    if (!reply) {
      await message.reply({
        content:
          "I'm having trouble responding right now.",
        allowedMentions: {
          repliedUser: false
        }
      });

      return;
    }

    /* =========================
       SEND RESPONSE
    ========================= */

    await message.reply({
      content: reply.slice(0, 2000),
      allowedMentions: {
        repliedUser: false
      }
    });
  } catch (error) {
    console.error(
      "[Message Error]",
      error
    );
  }
});

/* =========================
   LOGIN
========================= */

client.login(process.env.DISCORD_TOKEN);
