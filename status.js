function setAlyStatus(client) {
  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "/aly",
        type: 3
      }
    ]
  });
}

module.exports = {
  setAlyStatus
};
