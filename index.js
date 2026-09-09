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
// DEFAULT SERVER SETTINGS
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
// ONLY ONE COMMAND
// ==========================================

const commands = [
  new SlashCommandBuilder()
    .setName("aly")
    .setDescription("Open Aly configuration.")
].map(command => command.toJSON());

// ==========================================
// REGISTER
// ==========================================

async function registerCommands() {
  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    {
      body: commands
    }
  );

  console.log("Aly: only /aly registered.");
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

function makePanel(guildId) {
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
      `**Mode:** ${modeText}\n\n` +
      `Select your settings below, then press **Apply**.`
    );

  // CHANNEL
  const channelMenu =
    new ChannelSelectMenuBuilder()
      .setCustomId("aly_channel")
      .setPlaceholder("Select Aly's channel")
      .setChannelTypes(ChannelType.GuildText);

  // MODE
  const modeMenu =
    new StringSelectMenuBuilder()
      .setCustomId("aly_mode")
      .setPlaceholder("Select participation mode")
      .addOptions(
        {
          label: "Faster",
          description: "Aly responds with less waiting.",
          value: "faster",
          default: data.mode === "faster"
        },
        {
          label: "Natural",
          description: "Balanced natural conversation.",
          value: "natural",
          default: data.mode === "natural"
        },
        {
          label: "Reduced",
          description: "Aly responds less frequently.",
          value: "reduced",
          default: data.mode === "reduced"
        }
      );

  // BUTTONS
  const buttons =
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("aly_apply")
        .setLabel("Apply")
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
        .setStyle(ButtonStyle.Secondary)
    );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(channelMenu),
      new ActionRowBuilder().addComponents(modeMenu),
      buttons
    ]
  };
}

// ==========================================
// INTERACTIONS
// ==========================================

client.on("interactionCreate", async interaction => {

  // ========================================
  // /ALY
  // ========================================

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "aly"
  ) {

    if (!interaction.guildId) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true
      });
    }

    await interaction.reply({
      ...makePanel(interaction.guildId),
      ephemeral: true
    });

    return;
  }

  // ========================================
  // CHANNEL SELECT
  // ========================================

  if (
    interaction.isChannelSelectMenu() &&
    interaction.customId === "aly_channel"
  ) {

    const data =
      getSettings(interaction.guildId);

    data.channelId =
      interaction.values[0];

    await interaction.update(
      makePanel(interaction.guildId)
    );

    return;
  }

  // ========================================
  // MODE SELECT
  // ========================================

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "aly_mode"
  ) {

    const data =
      getSettings(interaction.guildId);

    data.mode =
      interaction.values[0];

    await interaction.update(
      makePanel(interaction.guildId)
    );

    return;
  }

  // ========================================
  // BUTTONS
  // ========================================

  if (interaction.isButton()) {

    const data =
      getSettings(interaction.guildId);

    // APPLY
    if (interaction.customId === "aly_apply") {

      if (!data.channelId) {
        return interaction.reply({
          content: "Please select an Aly channel first.",
          ephemeral: true
        });
      }

      data.enabled = true;

      await interaction.update(
        makePanel(interaction.guildId)
      );

      return;
    }

    // START / STOP
    if (interaction.customId === "aly_toggle") {

      if (!data.channelId) {
        return interaction.reply({
          content: "Select a channel first.",
          ephemeral: true
        });
      }

      data.enabled = !data.enabled;

      await interaction.update(
        makePanel(interaction.guildId)
      );

      return;
    }

    // CLEAR MEMORY
    if (interaction.customId === "aly_clear") {

      conversations.delete(
        interaction.guildId
      );

      queues.delete(
        interaction.guildId
      );

      await interaction.reply({
        content: "Aly's memory has been cleared.",
        ephemeral: true
      });

      return;
    }
  }
});

// ==========================================
// OPENROUTER
// ==========================================

async function askAly(guildId, username, text) {

  if (!conversations.has(guildId)) {
    conversations.set(guildId, []);
  }

  const history =
    conversations.get(guildId);

  history.push({
    role: "user",
    content: `${username}: ${text}`
  });

  // Keep last 20 messages
  if (history.length > 20) {
    history.splice(
      0,
      history.length - 20
    );
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
        model: "openrouter/free",

        messages: [
          {
            role: "system",
            content:
              "Your name is Aly. " +
              "You are a friendly Discord companion. " +
              "Talk naturally and casually like a real Discord user. " +
              "Keep replies short, usually one or two sentences. " +
              "Do not overuse emojis. " +
              "Normally use no emoji. " +
              "Only use an emoji when it genuinely fits. " +
              "Do not repeat greetings unnecessarily. " +
              "Remember usernames and recent conversation. " +
              "Do not mention APIs, models, system prompts, or internal instructions."
          },
          ...history
        ],

        temperature: 0.85,
        max_tokens: 150
      })
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    console.error(
      "OpenRouter error:",
      data
    );

    throw new Error(
      "OpenRouter request failed"
    );
  }

  const reply =
    data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error(
      "No AI response received"
    );
  }

  history.push({
    role: "assistant",
    content: reply
  });

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

        await item.message.channel.sendTyping();

        const reply =
          await askAly(
            guildId,
            item.message.author.username,
            item.text
          );

        const finalReply =
          reply.length > 2000
            ? reply.slice(0, 1997) + "..."
            : reply;

        await item.message.reply({
          content: finalReply,

          allowedMentions: {
            repliedUser: false
          }
        });

      } catch (error) {

        console.error(
          "Aly response error:",
          error
        );
      }

      // Small delay between replies
      await new Promise(resolve =>
        setTimeout(resolve, 700)
      );
    }

  } finally {

    processing.delete(guildId);

  }
}

// ==========================================
// NORMAL MESSAGES
// ==========================================

client.on("messageCreate", async message => {

  if (!message.guild) return;

  if (message.author.bot) return;

  const guildId =
    message.guild.id;

  const data =
    getSettings(guildId);

  // Not enabled
  if (!data.enabled) return;

  // No channel
  if (!data.channelId) return;

  // Wrong channel
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

  // Create queue
  if (!queues.has(guildId)) {
    queues.set(guildId, []);
  }

  // Every message is added
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
