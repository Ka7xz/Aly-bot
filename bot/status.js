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
          name: "custom",
          type: ActivityType.Custom,
          state: "FEEL FREE TO TALK"
        },
        {
          name: `${members} Members`,
          type: ActivityType.Listening
        }
      ]
    });
  };

  updateStatus();
  setInterval(updateStatus, 5 * 60 * 1000);
};
