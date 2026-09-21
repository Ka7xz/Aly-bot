const { ActivityType } = require("discord.js");

/* =========================
   SET BOT STATUS
========================= */

function setAlyStatus(client, type, name) {
  if (!client.user) return false;

  const types = {
    playing: ActivityType.Playing,
    watching: ActivityType.Watching,
    listening: ActivityType.Listening,
    streaming: ActivityType.Streaming,
    custom: ActivityType.Custom
  };

  type = type.toLowerCase();

  if (!types[type]) {
    return false;
  }

  let activity;

  // CUSTOM STATUS
  if (type === "custom") {
    activity = {
      type: ActivityType.Custom,
      name: "Custom Status",
      state: name
    };
  }

  // NORMAL STATUS
  else {
    activity = {
      type: types[type],
      name: name
    };
  }

  client.user.setPresence({
    status: "dnd",
    activities: [activity]
  });

  console.log(`[STATUS] ${type} - ${name}`);

  return true;
}

module.exports = {
  setAlyStatus
};
