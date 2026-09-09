const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
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

/* =========================
   SERVER SETTINGS
========================= */

const settings = new Map();
const conversations = new Map();
const cooldowns = new Map();

function getSettings(guildId) {
  if (!settings.has(guildId)) {
    settings.set(guildId, {
      channelId: null,
      participation: "natural",
      enabled: true,
      timezone: "UTC+05:30"
    });
  }

  return settings.get(guildId);
}

/* =========================
   SLASH COMMAND
========================= */

const commands = [
  new SlashCommandBuilder()
    .setName("aly")
    .setDescription("Open Aly's settings panel.")
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );

  console.log("Aly slash commands registered.");
}

/* =========================
   READY
========================= */

client.once("ready", async () => {
  console.log(`Aly is online as ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (error) {
    console.error("Command registration error:", error);
  }
});

/* =========================
   ALY PANEL
========================= */

function createPanel(guildId) {
  const data = getSettings(guildId);

  const channelText = data.channelId
    ? `<#${data.channelId}>`
    : "Not configured";

  const participationText = {
    faster: "⚡ Faster",
    natural: "💬 Natural",
    reduced: "🌙 Reduced"
  }[data.participation];

  const statusText = data.enabled
    ? "🟢 Enabled"
    : "🔴 Stopped";

  const embed = new EmbedBuilder()
    .setTitle("Aly")
    .setDescription(
      "Configure how Aly behaves in your server.\n\n" +
      `**Status:** ${statusText}\n` +
      `**Channel:** ${channelText}\n` +
      `**Participation:** ${participationText}\n` +
      `**Timezone:** ${data.timezone}`
    );

  const participation = new StringSelectMenuBuilder()
    .setCustomId("aly_participation")
    .setPlaceholder("Select participation level")
    .addOptions(
      {
        label: "Faster",
        description: "Aly participates more often.",
        value: "faster",
        emoji: "⚡"
      },
      {
        label: "Natural",
        description: "Aly decides naturally when to participate.",
        value: "natural",
        emoji: "💬"
      },
      {
        label: "Reduced",
        description: "Aly participates less often.",
        value: "reduced",
        emoji: "🌙"
      }
    );

  const channel = new ChannelSelectMenuBuilder()
    .setCustomId("aly_channel")
    .setPlaceholder("Choose Aly's channel")
    .setChannelTypes(ChannelType.GuildText);

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("aly_apply")
      .setLabel("Apply Settings")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("aly_stop")
      .setLabel(data.enabled ? "Stop" : "Start")
      .setStyle(data.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
  );

  const buttons2 = new ActionRowBuilder().addComponents(
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
      new ActionRowBuilder().addComponents(participation),
      new ActionRowBuilder().addComponents(channel),
      buttons,
      buttons2
    ]
  };
}

/* =========================
   INTERACTIONS
========================= */

client.on("interactionCreate", async interaction => {

  /* /aly */
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "aly") {

      if (!interaction.guild) {
        return interaction.reply({
          content: "Aly can only be configured inside a server.",
          ephemeral: true
        });
      }

      await interaction.reply({
        ...createPanel(interaction.guildId),
        ephemeral: true
      });
    }

    return;
  }

  /* Participation */
  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === "aly_participation") {

      const data = getSettings(interaction.guildId);

      data.participation = interaction.values[0];

      await interaction.update(
        createPanel(interaction.guildId)
      );

      return;
    }
  }

  /* Channel */
  if (interaction.isChannelSelectMenu()) {

    if (interaction.customId === "aly_channel") {

      const data = getSettings(interaction.guildId);

      data.channelId = interaction.values[0];

      await interaction.update(
        createPanel(interaction.guildId)
      );

      return;
    }
  }

  /* Buttons */
  if (interaction.isButton()) {

    const data = getSettings(interaction.guildId);

    /* Apply */
    if (interaction.customId === "aly_apply") {

      if (!data.channelId) {
        return interaction.reply({
          content: "Please select an Aly channel first.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content: `Aly settings applied.\nChannel: <#${data.channelId}>`,
        ephemeral: true
      });

      return;
    }

    /* Stop / Start */
    if (interaction.customId === "aly_stop") {

      data.enabled = !data.enabled;

      await interaction.update(
        createPanel(interaction.guildId)
      );

      return;
    }

    /* Clear memory */
    if (interaction.customId === "aly_clear") {

      conversations.delete(interaction.guildId);

      await interaction.reply({
        content: "🧹 Aly's memory for this server has been cleared.",
        ephemeral: true
      });

      return;
    }

    /* Help */
    if (interaction.customId === "aly_help") {

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Aly Help")
            .setDescription(
              "**Participation**\n" +
              "⚡ Faster — Aly talks more often.\n" +
              "💬 Natural — Aly chooses naturally when to talk.\n" +
              "🌙 Reduced — Aly talks less often.\n\n" +

              "**Channel**\n" +
              "Choose the channel where Aly should participate.\n\n" +

              "**Stop**\n" +
              "Temporarily stops Aly from responding.\n\n" +

              "**Clear Memory**\n" +
              "Deletes Aly's current conversation memory for this server."
            )
        ],
        ephemeral: true
      });

      return;
    }
  }
});

/* =========================
   AI
========================= */

async function askAly(guildId, username, message) {

  if (!conversations.has(guildId)) {
    conversations.set(guildId, []);
  }

  const history = conversations.get(guildId);

  history.push({
    role: "user",
    content: `${username}: ${message}`
  });

  if (history.length > 12) {
    history.splice(0, history.length - 12);
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
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
              "You are a friendly Discord AI companion. " +
              "Talk naturally like a real Discord user. " +
              "Keep responses short and conversational. " +
              "Do not constantly mention that you are an AI. " +
              "You are participating in a group conversation. " +
              "Pay attention to usernames and previous messages. " +
              "Do not write huge paragraphs."
          },
          ...history
        ]
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("OpenRouter:", result);
    throw new Error("OpenRouter request failed");
  }

  const reply = result?.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error("AI returned no response");
  }

  history.push({
    role: "assistant",
    content: reply
  });

  return reply;
}

/* =========================
   PARTICIPATION
========================= */

function shouldParticipate(mode) {

  const random = Math.random();

  if (mode === "faster") {
    return random < 0.70;
  }

  if (mode === "reduced") {
    return random < 0.15;
  }

  return random < 0.35;
}

/* =========================
   NORMAL MESSAGES
========================= */

client.on("messageCreate", async message => {

  if (!message.guild) return;
  if (message.author.bot) return;
  if (!message.content.trim()) return;

  const data = getSettings(message.guild.id);

  if (!data.enabled) return;

  if (!data.channelId) return;

  if (message.channel.id !== data.channelId) return;

  /* Aly mentions/replies always get a response */
  const mentioned =
    message.mentions.has(client.user.id);

  const repliedToAly =
    message.reference &&
    message.mentions.repliedUser &&
    message.mentions.repliedUser.id === client.user.id;

  /* Ignore some messages randomly */
  if (!mentioned && !repliedToAly) {

    if (!shouldParticipate(data.participation)) {
      return;
    }
  }

  /* Server cooldown */
  const now = Date.now();
  const cooldown = cooldowns.get(message.guild.id) || 0;

  if (now < cooldown && !mentioned && !repliedToAly) {
    return;
  }

  cooldowns.set(message.guild.id, now + 8000);

  try {

    await message.channel.sendTyping();

    const reply = await askAly(
      message.guild.id,
      message.author.username,
      message.content
    );

    if (reply.length <= 2000) {
      await message.reply(reply);
    } else {
      await message.reply(
        reply.slice(0, 1997) + "..."
      );
    }

  } catch (error) {

    console.error(error);

    await message.reply(
      "I couldn't respond right now. Please try again."
    );
  }
});

/* =========================
   LOGIN
========================= */

client.login(process.env.DISCORD_TOKEN);
