function setAlyStatus(client) {
  const statuses = [
    "Chatting with the server",
    "Hanging out on Discord",
    "Talking with everyone",
    "Just being Aly"
  ];

  let index = 0;

  const updateStatus = () => {
    if (!client.user) return;

    client.user.setPresence({
      activities: [
        {
          name: statuses[index],
          type: 0
        }
      ],
      status: "online"
    });

    index =
      (index + 1) % statuses.length;
  };

  updateStatus();

  setInterval(
    updateStatus,
    60000
  );
}

module.exports = {
  setAlyStatus
};
