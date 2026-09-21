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
          name: "FEEL FREE TO TALK",
          type: 4,
          state: "FEEL FREE TO TALK"
        },
        {
          name: `${membercount} Members`,
          type: 2
        }
      ]
    });
  };

  updateStatus();

  // Update member count every 5 minutes
  setInterval(updateStatus, 5 * 60 * 1000);
};
