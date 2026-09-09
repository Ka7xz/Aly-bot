function setAlyStatus(client) {
  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "Favorite collectible?",
        type: 4,
        state: "Favorite collectible?"
      }
    ]
  });
}

module.exports = {
  setAlyStatus
};
