function setAlyStatus(client) {
  client.user.setPresence({
    activities: [
      {
        name: "Kinda Busy In Chat",
        type: 0
      }
    ],
    status: "online"
  });
}

module.exports = {
  setAlyStatus
};
