const {
  ActivityType
} = require("discord.js");

let currentStatus = 0;
let rotationInterval = null;

/* =========================
   GET TOTAL MEMBER COUNT
========================= */

function getMemberCount(client) {
  let count = 0;

  for (const guild of client.guilds.cache.values()) {
    count += guild.memberCount || 0;
  }

  return count;
}

/* =========================
   UPDATE STATUS
========================= */

function updateStatus(client) {
  if (!client.user) return;

  const serverCount =
    client.guilds.cache.size;

  const memberCount =
    getMemberCount(client);

  const statuses = [
    {
      type: ActivityType.Custom,
      name: "Custom Status",
      state: "FEEL FREE TO TALK"
    },

    {
      type: ActivityType.Watching,
      name: `${serverCount} Servers`
    },

    {
      type: ActivityType.Listening,
      name: `${memberCount} Members`
    }
  ];

  const activity =
    statuses[currentStatus];

  client.user.setPresence({
    status: "online",
    activities: [
      activity
    ]
  });

  console.log(
    `[STATUS] ${currentStatus + 1}/${statuses.length} - ${
      activity.state || activity.name
    }`
  );

  currentStatus =
    (currentStatus + 1) %
    statuses.length;
}

/* =========================
   START STATUS ROTATION
========================= */

function setAlyStatus(client) {
  if (!client.user) return;

  if (rotationInterval) {
    clearInterval(rotationInterval);
  }

  currentStatus = 0;

  // Set the first status immediately
  updateStatus(client);

  // Change every 10 seconds
  rotationInterval = setInterval(() => {
    updateStatus(client);
  }, 10000);
}

/* =========================
   EXPORT
========================= */

module.exports = {
  setAlyStatus
};
