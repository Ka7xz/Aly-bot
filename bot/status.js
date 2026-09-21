const { ActivityType } = require("discord.js");

module.exports = (client) => {
  const updateStatus = () => {
    const members = client.guilds.cache.reduce(
      (total, guild) => total + guild.memberCount,
      0
    );

    client.user.setPresence({
      status: "online",
      activities: [
        {
          type: ActivityType.Custom,
          name: "custom",
          state: "FEEL FREE TO TALK"
        },
        {
          type: ActivityType.Listening,
          name: `${members} Members`
        }
      ]
    });
  };

  updateStatus();

  setInterval(updateStatus, 5 * 60 * 1000);
};
