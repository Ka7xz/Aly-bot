const { ActivityType } = require("discord.js");

module.exports = (client) => {
  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "custom",
        type: ActivityType.Custom,
        state: "FEEL FREE TO TALK"
      }
    ]
  });
};
