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

  const activity = {
    type: types[type],
    name: name
  };

  // Custom status uses "state"
  if (type === "custom") {
    activity.state = name;
  }

  client.user.setPresence({
    status: "dnd",
    activities: [activity]
  });

  console.log(
    `[STATUS] ${type} - ${name}`
  );

  return true;
}

/* =========================
   EXPORT
========================= */

module.exports = {
  setAlyStatus
};
