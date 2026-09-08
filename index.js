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

// One Aly channel per server
const alyChannels = new Map();

// Recent conversation memory
const conversations = new Map();

const commands = [
  new SlashCommandBuilder()
    .setName("alysetup")
    .setDescription("Set this channel as Aly's chat channel."),

  new SlashCommandBuilder()
    .setName("alydisable")
    .setDescription("Disable Aly in this server."),

  new SlashCommandBuilder()
    .setName("alystatus")
    .setDescription("Check Aly's current channel.")
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );

  console.log("Aly slash commands registered.");
}

client.once("ready", async () => {
  console.log(`Aly is online as ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (error) {
    console.error("Failed to register commands:", error);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guildId;

  if (interaction.commandName === "alysetup") {
    alyChannels.set(guildId, interaction.channelId);

    await interaction.reply({
      content: `Aly is now enabled in <#${interaction.channelId}>.`,
      ephemeral: true
    });
  }

  if (interaction.commandName === "alydisable") {
    alyChannels.delete(guildId);

    await interaction.reply({
      content: "Aly has been disabled in this server.",
      ephemeral: true
    });
  }

  if (interaction.commandName === "alystatus") {
    const channelId = alyChannels.get(guildId);

    await interaction.reply({
      content: channelId
        ? `Aly is enabled in <#${channelId}>.`
        : "Aly is not configured in this server.",
      ephemeral: true
    });
  }
});

async function askAly(guildId, username, message) {
  if (!conversations.has(guildId)) {
    conversations.set(guildId, []);
  }

  const history = conversations.get(guildId);

  history.push({
    role: "user",
    content: `${username}: ${message}`
  });

  // Keep only the latest 12 messages
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
              "Your name is Aly. You are a friendly Discord AI companion. " +
              "Talk naturally, casually and like a real Discord user. " +
              "Keep replies reasonably short. You can use casual language and light humor. " +
              "Do not
