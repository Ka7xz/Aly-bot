const statuses = [
  {
    type: "custom",
    text: "FEEL FREE TO TALK"
  },
  {
    type: "watching",
    text: "SERVER_COUNT"
  },
  {
    type: "listening",
    text: "MEMBER_COUNT"
  },
  {
    type: "streaming",
    text: "Powered by Aly"
  }
];

let currentStatus = 0;
let statusInterval = null;

function getMemberCount(client) {
  let totalMembers = 0;

  for (const guild of client.guilds.cache.values()) {
    totalMembers += guild.memberCount || 0;
  }

  return totalMembers;
}

function setAlyStatus(client) {
  if (!client.user) return;

  if (statusInterval) {
    clearInterval(statusInterval);
  }

  function updateStatus() {
    const status = statuses[currentStatus];

    const serverCount =
      client.guilds.cache.size;

    const memberCount =
      getMemberCount(client);

    let activity;

    if (status.type === "watching") {
      activity = {
        name: `${serverCount} Servers`,
        type: 3
      };
    } else if (status.type === "listening") {
      activity = {
        name: `${memberCount} Members`,
        type: 2
      };
    } else {
      activity = {
        name: "Aly",
        state: status.text,
        type: 4
      };
    }

    client.user.setPresence({
      status: "online",
      activities: [activity]
    });

    currentStatus =
      (currentStatus + 1) % statuses.length;
  }

  updateStatus();

  statusInterval = setInterval(
    updateStatus,
    10000
  );
}

module.exports = {
  setAlyStatus
};
