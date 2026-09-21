const { ActivityType } = require("discord.js");

let currentStatus = 0;
let rotationInterval = null;

function getMemberCount(client) {
  let count = 0;

  for (const guild of client.guilds.cache.values()) {
    count += guild.memberCount || 0;
  }

  return count;
}

function updateStatus(client) {
  if (!client.user) return;

  const serverCount =
    client.guilds.cache.size;

  const memberCount =
    getMemberCount(client);

  const statuses = [
    {
      type: ActivityType.Custom,
      state: "FEEL FREE TO TALK"
    },
    {
      type: ActivityType.Watching,
      name: `${serverCount} Servers`
    },
    {
      type: ActivityType.Listening,
      name: `${memberCount} Members`
    },
    {
      type: ActivityType.Streaming,
      state: "Powered by Aly"
    }
  ];

  const status =
    statuses[currentStatus];

  if (status.type === ActivityType.Custom) {
    client.user.setPresence({
      status: "online",
      activities: [
        {
          name: "Custom Status",
          state: status.state,
          type: ActivityType.Custom
        }
      ]
    });
  } else {
    client.user.setPresence({
      status: "online",
      activities: [
        {
          name: status.name,
          type: status.type
        }
      ]
    });
  }

  console.log(
    `[STATUS] ${currentStatus + 1}/${statuses.length}`
  );

  currentStatus =
    (currentStatus + 1) % statuses.length;
}

function setAlyStatus(client) {
  if (!client.user) return;

  if (rotationInterval) {
    clearInterval(rotationInterval);
  }

  updateStatus(client);

  rotationInterval = setInterval(() => {
    updateStatus(client);
  }, 10000);
}

module.exports = {
  setAlyStatus
};
