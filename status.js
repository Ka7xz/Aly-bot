const { ActivityType } = require("discord.js");

const statuses = [
  {
    type: ActivityType.Custom,
    state: "FEEL FREE TO TALK"
  },
  {
    type: ActivityType.Watching,
    name: "SERVER_COUNT Servers"
  },
  {
    type: ActivityType.Listening,
    name: "MEMBER_COUNT Members"
  },
  {
    type: ActivityType.Streaming,
    state: "Powered by Aly"
  }
];

let currentStatus = 0;
let statusInterval = null;

function getMemberCount(client) {
  let total = 0;

  for (const guild of client.guilds.cache.values()) {
    total += guild.memberCount || 0;
  }

  return total;
}

function updateAlyStatus(client) {
  if (!client.user) return;

  const status = statuses[currentStatus];

  const serverCount = client.guilds.cache.size;
  const memberCount = getMemberCount(client);

  if (status.type === ActivityType.Custom) {
    client.user.setPresence({
      status: "online",
      activities: [
        {
          type: ActivityType.Custom,
          name: "Aly",
          state: status.state
        }
      ]
    });
  } else {
    let activityName = status.name
      .replace("SERVER_COUNT", serverCount.toLocaleString())
      .replace("MEMBER_COUNT", memberCount.toLocaleString());

    client.user.setPresence({
      status: "online",
      activities: [
        {
          type: status.type,
          name: activityName
        }
      ]
    });
  }

  console.log(
    `[Status] ${currentStatus + 1}/${statuses.length}`
  );

  currentStatus =
    (currentStatus + 1) % statuses.length;
}

function setAlyStatus(client) {
  if (!client.user) return;

  if (statusInterval) {
    clearInterval(statusInterval);
  }

  updateAlyStatus(client);

  statusInterval = setInterval(() => {
    updateAlyStatus(client);
  }, 10000);
}

module.exports = {
  setAlyStatus
};
