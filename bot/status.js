const { ActivityType } = require("discord.js");

function updateStatus(client) {
  const members = client.guilds.cache.reduce(
    (total, guild) => total + guild.memberCount,
    0
  );

  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "FEEL FREE TO TALK",
        type: ActivityType.Playing
      },
      {
        name: `${members} Members`,
        type: ActivityType.Listening
      }
    ]
  });
}

module.exports = updateStatus;
