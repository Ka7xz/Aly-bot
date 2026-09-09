function setAlyStatus(client) {
  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "Custom Status",
        state: "lost in the chat.",
        type: 4
      }
    ]
  });
}

module.exports = {
  setAlyStatus
};
