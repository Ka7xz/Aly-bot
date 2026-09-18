function setAlyStatus(client) {
  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "Kinda Busy In Chats",
        type: 0
      }
    ]
  });
}

module.exports = {
  setAlyStatus
};
