function setAlyStatus(client) {
  if (!client.user) return;

  client.user.setPresence({
    status: "online",

    activities: [
      {
        name: "Custom Status",
        state: "FEEL FREE TO TALK",
        type: 4
      }
    ]
  });
}

module.exports = {
  setAlyStatus
};
