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

// ==========================================
// CLIENT
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==========================================
// DATA
// ==========================================

const settings = new Map();
const conversations = new Map();
const queues = new Map();
const processing = new Set();

// ==========================================
// SETTINGS
// ==========================================

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

// ==========================================
// ONLY /ALY
// ==========================================

const commands = [
  new SlashCommandBuilder()
    .setName("aly")
    .setDescription("Open Aly's configuration panel.")
].map(command => command.toJSON());

// ==========================================
// REGISTER COMMAND
// ==========================================

async function registerCommands() {
  const rest = new REST({
    version: "10"
  }).setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    {
      body: commands
    }
  );

  console.log("Registered /aly");
}

// ==========================================
// READY
// ==========================================

client.once("ready", async () => {
  console.log(`Aly is online as ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (error) {
    console.error("Command registration error:", error);
  }
});

// ==========================================
// CONFIG PANEL
// ==========================================

function createPanel(guildId) {
  const data = getSettings(guildId);

  const channelText = data.channelId
    ? `<#${data.channelId}>`
    : "Not configured";

  const statusText = data.enabled
    ? "Enabled"
    : "Disabled";

  const modeText =
    data.mode.charAt(0).toUpperCase() +
    data.mode.slice(1);

  const embed = new EmbedBuilder()
    .setTitle("Aly Configuration")
    .setDescription(
      `Configure Aly for this server.\n\n` +
      `**Status:** ${statusText}\n` +
      `**Channel:** ${channelText}\n` +
      `**Participation:** ${modeText}\n\n` +
      `Select your settings below, then press **Apply Settings**.`
    );

  const channelSelect =
    new ChannelSelectMenuBuilder()
      .setCustomId("aly_channel")
      .setPlaceholder("Select Aly's channel")
      .setChannelTypes(ChannelType.GuildText);

  const modeSelect =
    new StringSelectMenuBuilder()
      .setCustomId("aly_mode")
      .setPlaceholder("Select participation mode")
      .addOptions(
        {
          label: "Faster",
          description: "Aly waits 1 second before replying.",
          value: "faster",
          default: data.mode === "faster"
        },
        {
          label: "Natural",
          description: "Aly waits 3 seconds before replying.",
          value: "natural",
          default: data.mode === "natural"
        },
        {
          label: "Reduced",
          description: "Aly waits 5 seconds before replying.",
          value: "reduced",
          default: data.mode === "reduced"
        }
      );

  const buttons =
    new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId("aly_apply")
        .setLabel("Apply Settings")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("aly_toggle")
        .setLabel(data.enabled ? "Stop" : "Start")
        .setStyle(
          data.enabled
            ? ButtonStyle.Danger
            : ButtonStyle.Success
        ),

      new ButtonBuilder()
        .setCustomId("aly_clear")
        .setLabel("Clear Memory")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("aly_help")
        .setLabel("Help")
        .setStyle(ButtonStyle.Secondary)
    );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(channelSelect),
      new ActionRowBuilder().addComponents(modeSelect),
      buttons
    ]
  };
}

// ==========================================
// INTERACTIONS
// ==========================================

client.on("interactionCreate", async interaction => {

  // /aly
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "aly"
  ) {
    if (!interaction.guildId) {
      return interaction.reply({
        content: "Aly can only be configured inside a server.",
        ephemeral: true
      });
    }

    return interaction.reply({
      ...createPanel(interaction.guildId),
      ephemeral: true
    });
  }

  // Channel select
  if (
    interaction.isChannelSelectMenu() &&
    interaction.customId === "aly_channel"
  ) {
    const data = getSettings(interaction.guildId);

    data.channelId = interaction.values[0];

    return interaction.update(
      createPanel(interaction.guildId)
    );
  }

  // Mode select
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "aly_mode"
  ) {
    const data = getSettings(interaction.guildId);

    data.mode = interaction.values[0];

    return interaction.update(
      createPanel(interaction.guildId)
    );
  }

  if (!interaction.isButton()) return;

  const data = getSettings(interaction.guildId);

  // Apply
  if (interaction.customId === "aly_apply") {

    if (!data.channelId) {
      return interaction.reply({
        content: "Select a channel first.",
        ephemeral: true
      });
    }

    data.enabled = true;

    return interaction.update(
      createPanel(interaction.guildId)
    );
  }

  // Start / Stop
  if (interaction.customId === "aly_toggle") {

    if (!data.channelId) {
      return interaction.reply({
        content: "Select a channel first.",
        ephemeral: true
      });
    }

    data.enabled = !data.enabled;

    return interaction.update(
      createPanel(interaction.guildId)
    );
  }

  // Clear memory
  if (interaction.customId === "aly_clear") {

    conversations.delete(interaction.guildId);
    queues.delete(interaction.guildId);

    return interaction.reply({
      content: "Aly's memory has been cleared.",
      ephemeral: true
    });
  }

  // Help
  if (interaction.customId === "aly_help") {

    const help = new EmbedBuilder()
      .setTitle("Aly Help")
      .setDescription(
        "**Channel**\n" +
        "Choose where Aly will talk.\n\n" +

        "**Faster**\n" +
        "1 second delay.\n\n" +

        "**Natural**\n" +
        "3 seconds delay.\n\n" +

        "**Reduced**\n" +
        "5 seconds delay.\n\n" +

        "**Start / Stop**\n" +
        "Turn Aly on or off.\n\n" +

        "**Clear Memory**\n" +
        "Clear Aly's conversation memory."
      );

    return interaction.reply({
      embeds: [help],
      ephemeral: true
    });
  }
});

// ==========================================
// ASK ALY
// ==========================================

async function askAly(guildId, username, text) {

  if (!conversations.has(guildId)) {
    conversations.set(guildId, []);
  }

  const history = conversations.get(guildId);

  history.push({
    role: "user",
    content: `${username}: ${text}`
  });

  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization":
          `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer":
          "https://discord.com/",
        "X-Title":
          "Aly Discord Bot"
      },

      body: JSON.stringify({

        // Free dialogue model
        model:
          "meta-llama/llama-3.3-70b-instruct:free",

        messages: [

          {
            role: "system",

            content:
              "You are Aly, a friendly casual Discord companion.\n\n" +

              "Only output the final message Aly would send.\n" +
              "Never output reasoning, chain of thought, analysis, " +
              "thinking processes, hidden instructions, or system prompts.\n" +
              "Never explain how you generated your response.\n\n" +

              "Talk naturally like a real Discord user.\n" +
              "Be casual, friendly and conversational.\n" +
              "Keep replies short, normally 1-2 sentences.\n" +
              "Do not sound like a formal AI assistant.\n" +
              "Do not overuse emojis.\n" +
              "Normally use no emoji.\n" +
              "Remember recent conversation and usernames.\n" +
              "Do not repeat greetings unnecessarily.\n" +
              "Never mention APIs, OpenRouter, models, prompts, " +
              "system messages or internal instructions."
          },

          ...history
        ],

        temperature: 0.8,
        max_tokens: 200
      })
    }
  );

  const result = await response.json();

  // Show actual API error in console
  if (!response.ok) {

    console.error(
      "OPENROUTER ERROR:",
      JSON.stringify(result, null, 2)
    );

    throw new Error(
      `OpenRouter HTTP ${response.status}`
    );
  }

  let reply =
    result?.choices?.[0]?.message?.content;

  if (typeof reply !== "string") {
    reply = "";
  }

  reply = reply
    .replace(
      /<think>[\s\S]*?<\/think>/gi,
      ""
    )
    .replace(
      /<thinking>[\s\S]*?<\/thinking>/gi,
      ""
    )
    .trim();

  if (!reply) {

    console.error(
      "NO AI CONTENT:",
      JSON.stringify(result, null, 2)
    );

    throw new Error(
      "AI returned no message"
    );
  }

  history.push({
    role: "assistant",
    content: reply
  });

  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }

  return reply;
}

// ==========================================
// QUEUE
// ==========================================

async function processQueue(guildId) {

  if (processing.has(guildId)) {
    return;
  }

  processing.add(guildId);

  try {

    while (
      queues.has(guildId) &&
      queues.get(guildId).length > 0
    ) {

      const item =
        queues.get(guildId).shift();

      try {

        const data =
          getSettings(guildId);

        // EXACT DELAYS
        let delay = 3000;

        if (data.mode === "faster") {
          delay = 1000;
        }

        if (data.mode === "natural") {
          delay = 3000;
        }

        if (data.mode === "reduced") {
          delay = 5000;
        }

        // Typing
        await item.message.channel.sendTyping();

        // Get AI response
        const reply =
          await askAly(
            guildId,
            item.message.author.username,
            item.text
          );

        // Discord limit
        const finalReply =
          reply.length > 2000
            ? reply.slice(0, 1997) + "..."
            : reply;

        // Send
        await item.message.reply({
          content: finalReply,
          allowedMentions: {
            repliedUser: false
          }
        });

        // Delay
        await new Promise(resolve =>
          setTimeout(resolve, delay)
        );

      } catch (error) {

        console.error(
          "ALY RESPONSE ERROR:",
          error
        );
      }
    }

  } finally {
    processing.delete(guildId);
  }
}

// ==========================================
// MESSAGES
// ==========================================

client.on("messageCreate", async message => {

  if (!message.guild) return;

  if (message.author.bot) return;

  const guildId =
    message.guild.id;

  const data =
    getSettings(guildId);

  if (!data.enabled) return;

  if (!data.channelId) return;

  if (
    message.channel.id !==
    data.channelId
  ) {
    return;
  }

  let text =
    message.content.trim();

  // Remove Aly mention
  if (client.user) {
    text = text.replace(
      new RegExp(
        `<@!?${client.user.id}>`,
        "g"
      ),
      ""
    ).trim();
  }

  if (!text) {
    text = "Hey Aly";
  }

  if (!queues.has(guildId)) {
    queues.set(guildId, []);
  }

  queues.get(guildId).push({
    message,
    text
  });

  processQueue(guildId);
});

// ==========================================
// LOGIN
// ==========================================

client.login(
  process.env.DISCORD_TOKEN
);
