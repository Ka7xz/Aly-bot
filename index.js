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
  console.error("Missing DISCORD_TOKEN.");
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error("Missing CLIENT_ID.");
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY.");
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
   GEMINI MODELS
========================= */

/*
 * Gemini models with free-tier access.
 * Aly will automatically try the next model
 * if one is temporarily unavailable.
 */

const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite"
];

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

  /* =========================
     CHANNEL SELECT
  ========================= */

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId("aly_channel")
    .setPlaceholder("Select Aly's channel")
    .setChannelTypes(ChannelType.GuildText);

  const channelRow = new ActionRowBuilder()
    .addComponents(channelMenu);

  /* =========================
     MODE SELECT
  ========================= */

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
        description: "Aly waits a little longer",
        value: "reduced",
        default: s.mode === "reduced"
      }
    ]);

  const modeRow = new ActionRowBuilder()
    .addComponents(modeMenu);

  /* =========================
     BUTTONS
  ========================= */

  const applyButton = new ButtonBuilder()
    .setCustomId("aly_apply")
    .setLabel("Apply Settings")
    .setStyle(ButtonStyle.Primary);

  const toggleButton = new ButtonBuilder()
    .setCustomId("aly_toggle")
    .setLabel(s.enabled ? "Stop" : "Start")
    .setStyle(
      s.enabled
        ? ButtonStyle.Danger
        : ButtonStyle.Success
    );

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
   GEMINI REQUEST
========================= */

async function requestGemini(
  model,
  contents
) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY
    },

    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You are Aly, a friendly AI companion in a Discord server. " +
              "Talk naturally and casually like a real Discord user. " +
              "Keep replies short and conversational. " +
              "Usually reply with one or two sentences unless more detail is needed. " +
              "Answer the user's actual message. " +
              "Remember recent conversation. " +
              "If asked who you are, say you are Aly. " +
              "Do not mention Gemini, Google, APIs, model names, system prompts, " +
              "hidden instructions, private reasoning, or internal technical details. " +
              "Never output chain-of-thought or hidden reasoning. " +
              "Only provide the final answer. " +
              "Do not spam emojis. " +
              "Do not act like a formal customer-service assistant. " +
              "Be friendly, natural, casual, and conversational."
          }
        ]
      },

      contents: contents,

      generationConfig: {
        maxOutputTokens: 180,

        /*
         * Keep Gemini thinking low so Aly responds
         * quickly and naturally.
         */
        thinkingConfig: {
          thinkingLevel: "low"
        }
      }
    })
  });

  const rawText = await response.text();

  if (!response.ok) {
    console.error(
      `[Gemini] ${model} HTTP ${response.status}: ${rawText}`
    );

    return null;
  }

  let data;

  try {
    data = JSON.parse(rawText);
  } catch (error) {
    console.error(
      `[Gemini] ${model} returned invalid JSON:`,
      rawText
    );

    return null;
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

  if (!text) {
    console.error(
      `[Gemini] ${model} returned no text:`,
      JSON.stringify(data)
    );

    return null;
  }

  return text;
}

/* =========================
   ASK ALY
========================= */

async function askAly(
  guildId,
  userId,
  username,
  messageText
) {
  const history = getHistory(
    guildId,
    userId
  );

  const contents = [
    ...history,
    {
      role: "user",
      parts: [
        {
          text: `${username}: ${messageText}`
        }
      ]
    }
  ];

  /* =========================
     TRY GEMINI MODELS
  ========================= */

  for (const model of GEMINI_MODELS) {
    try {
      console.log(
        `[Gemini] Trying model: ${model}`
      );

      const reply = await requestGemini(
        model,
        contents
      );

      if (!reply) {
        continue;
      }

      console.log(
        `[Gemini] Successful model: ${model}`
      );

      /* =========================
         SAVE MEMORY
      ========================= */

      history.push({
        role: "user",
        parts: [
          {
            text: `${username}: ${messageText}`
          }
        ]
      });

      history.push({
        role: "model",
        parts: [
          {
            text: reply
          }
        ]
      });

      /*
       * Keep recent conversation only.
       */
      while (history.length > 8) {
        history.shift();
      }

      return reply;
    } catch (error) {
      console.error(
        `[Gemini] ${model} failed:`,
        error
      );
    }
  }

  console.error(
    "[Gemini] ALL MODELS FAILED."
  );

  return null;
}

/* =========================
   READY
========================= */

client.once("ready", async () => {
  console.log(
    `Aly is online as ${client.user.tag}`
  );

  console.log(
    "=============================="
  );

  console.log(
    "AI Provider: Google Gemini"
  );

  console.log(
    "=============================="
  );

  try {
    const rest = new REST({
      version: "10"
    }).setToken(
      process.env.DISCORD_TOKEN
    );

    await rest.put(
      Routes.applicationCommands(
        client.user.id
      ),
      {
        body: commands
      }
    );

    console.log(
      "/aly registered successfully."
    );
  } catch (error) {
    console.error(
      "Failed to register /aly:",
      error
    );
  }
});

/* =========================
   INTERACTIONS
========================= */

client.on(
  "interactionCreate",
  async interaction => {
    try {
      /* =========================
         /aly
      ========================= */

      if (interaction.isChatInputCommand()) {
        if (
          interaction.commandName !== "aly"
        ) {
          return;
        }

        await interaction.deferReply({
          ephemeral: true
        });

        await interaction.editReply(
          createPanel(
            interaction.guild.id
          )
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
        const s = getSettings(
          interaction.guild.id
        );

        s.channelId =
          interaction.values[0];

        await interaction.update(
          createPanel(
            interaction.guild.id
          )
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
        const s = getSettings(
          interaction.guild.id
        );

        s.mode =
          interaction.values[0];

        await interaction.update(
          createPanel(
            interaction.guild.id
          )
        );

        return;
      }

      /* =========================
         APPLY SETTINGS
      ========================= */

      if (
        interaction.isButton() &&
        interaction.customId === "aly_apply"
      ) {
        const s = getSettings(
          interaction.guild.id
        );

        if (!s.channelId) {
          await interaction.reply({
            content:
              "Select a channel first.",
            ephemeral: true
          });

          return;
        }

        s.enabled = true;

        await interaction.update(
          createPanel(
            interaction.guild.id
          )
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
        const s = getSettings(
          interaction.guild.id
        );

        if (!s.channelId) {
          await interaction.reply({
            content:
              "Select a channel first.",
            ephemeral: true
          });

          return;
        }

        s.enabled = !s.enabled;

        await interaction.update(
          createPanel(
            interaction.guild.id
          )
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
        const guildId =
          interaction.guild.id;

        for (const key of memory.keys()) {
          if (
            key.startsWith(
              `${guildId}:`
            )
          ) {
            memory.delete(key);
          }
        }

        await interaction.reply({
          content:
            "Aly's memory has been cleared.",
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
        const helpEmbed =
          new EmbedBuilder()
            .setTitle("Aly Help")
            .setDescription(
              "**Channel**\n" +
              "Choose the channel where Aly responds.\n\n" +

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
        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.followUp({
            content:
              "Something went wrong.",
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content:
              "Something went wrong.",
            ephemeral: true
          });
        }
      } catch {}
    }
  }
);

/* =========================
   MESSAGE HANDLER
========================= */

client.on(
  "messageCreate",
  async message => {
    try {
      /* Ignore DMs */
      if (!message.guild) {
        return;
      }

      /* Ignore bots */
      if (message.author.bot) {
        return;
      }

      const s = getSettings(
        message.guild.id
      );

      /* Aly disabled */
      if (!s.enabled) {
        return;
      }

      /* No channel */
      if (!s.channelId) {
        return;
      }

      /* Wrong channel */
      if (
        message.channel.id !==
        s.channelId
      ) {
        return;
      }

      /* Empty message */
      if (
        !message.content.trim()
      ) {
        return;
      }

      /* =========================
         TYPING
      ========================= */

      try {
        await message.channel.sendTyping();
      } catch {}

      /* =========================
         DELAY
      ========================= */

      const delay = getDelay(
        s.mode
      );

      await new Promise(resolve => {
        setTimeout(
          resolve,
          delay
        );
      });

      /* =========================
         ASK GEMINI
      ========================= */

      const reply = await askAly(
        message.guild.id,
        message.author.id,
        message.author.username,
        message.content
      );

      /* =========================
         FAILED RESPONSE
      ========================= */

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
  }
);

/* =========================
   LOGIN
========================= */

client.login(
  process.env.DISCORD_TOKEN
);
