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
   DATA
========================= */

const settings = new Map();
const conversations = new Map();
const cooldowns = new Map();

/* =========================
   DEFAULT SETTINGS
========================= */

function getSettings(guildId) {
  if (!settings.has(guildId)) {
    settings.set(guildId, {
      channelId: null,
      participation: "natural",
      enabled: true
    });
  }

  return settings.get(guildId);
}

/* =========================
   ONLY /ALY COMMAND
========================= */

const commands = [
  new SlashCommandBuilder()
    .setName("aly")
    .setDescription("Open Aly's control panel.")
].map(command => command.toJSON());

/* =========================
   REGISTER COMMANDS
========================= */

async function registerCommands() {
  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    {
      body: commands
    }
  );

  console.log("Aly command list updated.");
}

/* =========================
   READY
========================= */

client.once("ready", async () => {
  console.log(`Aly is online as ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (error) {
    console.error("Failed to register commands:", error);
  }
});

/* =========================
   ALY PANEL
========================= */

function createPanel(guildId) {
  const data = getSettings(guildId);

  const channelText = data.channelId
    ? `<#${data.channelId}>`
    : "Not selected";

  const participationText = {
    faster: "Faster",
    natural: "Natural",
    reduced: "Reduced"
  }[data.participation];

  const statusText = data.enabled
    ? "Enabled"
    : "Stopped";

  const embed = new EmbedBuilder()
    .setTitle("Aly")
    .setDescription(
      "Configure Aly for this server.\n\n" +
      `**Status:** ${statusText}\n` +
      `**Channel:** ${channelText}\n` +
      `**Participation:** ${participationText}`
    );

  const participationMenu =
    new StringSelectMenuBuilder()
      .setCustomId("aly_participation")
      .setPlaceholder("Participation")
      .addOptions(
        {
          label: "Faster",
          description: "Aly participates more often.",
          value: "faster"
        },
        {
          label: "Natural",
          description: "Aly decides naturally when to participate.",
          value: "natural"
        },
        {
          label: "Reduced",
          description: "Aly participates less often.",
          value: "reduced"
        }
      );

  const channelMenu =
    new ChannelSelectMenuBuilder()
      .setCustomId("aly_channel")
      .setPlaceholder("Choose Aly's channel")
      .setChannelTypes(ChannelType.GuildText);

  const mainButtons =
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
        )
    );

  const secondButtons =
    new ActionRowBuilder().addComponents(
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
      new ActionRowBuilder().addComponents(
        participationMenu
      ),

      new ActionRowBuilder().addComponents(
        channelMenu
      ),

      mainButtons,
      secondButtons
    ]
  };
}

/* =========================
   INTERACTIONS
========================= */

client.on("interactionCreate", async interaction => {

  /* /aly */

  if (
    interaction.isChatInputCommand() &&
    interaction.commandName === "aly"
  ) {

    if (!interaction.guild) {
      return interaction.reply({
        content:
          "This command can only be used inside a server.",
        ephemeral: true
      });
    }

    await interaction.reply({
      ...createPanel(interaction.guildId),
      ephemeral: true
    });

    return;
  }

  /* PARTICIPATION */

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "aly_participation"
  ) {

    const data =
      getSettings(interaction.guildId);

    data.participation =
      interaction.values[0];

    await interaction.update(
      createPanel(interaction.guildId)
    );

    return;
  }

  /* CHANNEL */

  if (
    interaction.isChannelSelectMenu() &&
    interaction.customId === "aly_channel"
  ) {

    const data =
      getSettings(interaction.guildId);

    data.channelId =
      interaction.values[0];

    await interaction.update(
      createPanel(interaction.guildId)
    );

    return;
  }

  /* BUTTONS */

  if (interaction.isButton()) {

    const data =
      getSettings(interaction.guildId);

    /* APPLY */

    if (interaction.customId === "aly_apply") {

      if (!data.channelId) {
        return interaction.reply({
          content:
            "Select a channel first.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content:
          `Aly settings applied.\n\n` +
          `Channel: <#${data.channelId}>\n` +
          `Participation: ${data.participation}\n` +
          `Status: ${data.enabled ? "Enabled" : "Stopped"}`,
        ephemeral: true
      });

      return;
    }

    /* START / STOP */

    if (interaction.customId === "aly_toggle") {

      data.enabled = !data.enabled;

      await interaction.update(
        createPanel(interaction.guildId)
      );

      return;
    }

    /* CLEAR MEMORY */

    if (interaction.customId === "aly_clear") {

      conversations.delete(
        interaction.guildId
      );

      await interaction.reply({
        content:
          "Aly's memory for this server has been cleared.",
        ephemeral: true
      });

      return;
    }

    /* HELP */

    if (interaction.customId === "aly_help") {

      const helpEmbed =
        new EmbedBuilder()
          .setTitle("Aly Help")
          .setDescription(
            "**Participation**\n" +
            "Faster — Aly joins conversations more often.\n" +
            "Natural — Aly chooses when to participate.\n" +
            "Reduced — Aly joins conversations less often.\n\n" +

            "**Channel**\n" +
            "Choose the channel where Aly should talk.\n\n" +

            "**Start / Stop**\n" +
            "Temporarily enable or disable Aly.\n\n" +

            "**Clear Memory**\n" +
            "Deletes Aly's current conversation memory for this server."
          );

      await interaction.reply({
        embeds: [helpEmbed],
        ephemeral: true
      });

      return;
    }
  }
});

/* =========================
   REMOVE EMOJIS FROM AI
========================= */

function removeEmojis(text) {
  return text
    .replace(
      /[\p{Extended_Pictographic}\uFE0F\u200D]/gu,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* =========================
   ASK ALY
========================= */

async function askAly(
  guildId,
  username,
  message
) {

  if (!conversations.has(guildId)) {
    conversations.set(guildId, []);
  }

  const history =
    conversations.get(guildId);

  history.push({
    role: "user",
    content:
      `${username}: ${message}`
  });

  /* Keep latest 12 messages */

  if (history.length > 12) {
    history.splice(
      0,
      history.length - 12
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
              "Your name is Aly.\n\n" +

              "You are a natural Discord companion.\n" +

              "Talk casually and naturally like a real person in a Discord conversation.\n" +

              "Keep replies short and conversational.\n" +

              "Do not write huge paragraphs unless the user asks for detail.\n" +

              "Do not constantly mention that you are an AI.\n" +

              "Remember recent conversation context and usernames.\n\n" +

              "STYLE:\n" +

              "Do not use emojis.\n" +

              "Do not add emojis to greetings.\n" +

              "Do not add emojis to every sentence.\n" +

              "Avoid excessive excitement.\n" +

              "Use normal punctuation and casual Discord language.\n" +

              "Respond naturally based on the conversation."
          },

          ...history
        ]
      })
    }
  );

  const result =
    await response.json();

  if (!response.ok) {

    console.error(
      "OpenRouter error:",
      result
    );

    throw new Error(
      "OpenRouter request failed"
    );
  }

  let reply =
    result?.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error(
      "AI returned no response"
    );
  }

  /* Remove emojis */

  reply =
    removeEmojis(reply);

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

  const random =
    Math.random();

  if (mode === "faster") {
    return random < 0.70;
  }

  if (mode === "reduced") {
    return random < 0.15;
  }

  /* Natural */

  return random < 0.35;
}

/* =========================
   NORMAL MESSAGES
========================= */

client.on("messageCreate", async message => {

  if (!message.guild) return;
  if (message.author.bot) return;

  if (!message.content.trim()) return;

  const data =
    getSettings(message.guild.id);

  if (!data.enabled) return;

  if (!data.channelId) return;

  if (
    message.channel.id !==
    data.channelId
  ) {
    return;
  }

  /*
    Aly does NOT require:
    - a mention
    - a reply
    - a special prefix

    She simply decides whether
    to participate.
  */

  if (
    !shouldParticipate(
      data.participation
    )
  ) {
    return;
  }

  /* Server cooldown */

  const now =
    Date.now();

  const cooldown =
    cooldowns.get(
      message.guild.id
    ) || 0;

  if (now < cooldown) {
    return;
  }

  cooldowns.set(
    message.guild.id,
    now + 8000
  );

  try {

    await message.channel.sendTyping();

    const reply =
      await askAly(
        message.guild.id,
        message.author.username,
        message.content
      );

    if (!reply) return;

    if (reply.length <= 2000) {

      await message.reply(reply);

    } else {

      await message.reply(
        reply.slice(0, 1997) + "..."
      );
    }

  } catch (error) {

    console.error(
      "Aly message error:",
      error
    );

    /* Don't send an error message to the channel. */
  }
});

/* =========================
   LOGIN
========================= */

client.login(
  process.env.DISCORD_TOKEN
);
