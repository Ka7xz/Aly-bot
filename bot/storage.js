const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "aly-data.json");

function createDefaultData() {
  return {
    settings: {},
    profiles: {},
    memory: {}
  };
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(createDefaultData(), null, 2),
      "utf8"
    );
  }
}

function loadData() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");

    if (!raw.trim()) {
      return createDefaultData();
    }

    const data = JSON.parse(raw);

    return {
      settings: data.settings || {},
      profiles: data.profiles || {},
      memory: data.memory || {}
    };
  } catch (error) {
    console.error("[Storage] Failed to load data:", error);

    return createDefaultData();
  }
}

let data = loadData();

function saveData() {
  ensureDataFile();

  const tempFile = `${DATA_FILE}.tmp`;

  try {
    fs.writeFileSync(
      tempFile,
      JSON.stringify(data, null, 2),
      "utf8"
    );

    fs.renameSync(tempFile, DATA_FILE);
  } catch (error) {
    console.error("[Storage] Failed to save data:", error);

    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch {}
  }
}

/* =========================
   SETTINGS
========================= */

function getSettings(guildId) {
  if (!data.settings[guildId]) {
    data.settings[guildId] = {
      channelId: null,
      mode: "natural",
      enabled: false
    };

    saveData();
  }

  return data.settings[guildId];
}

/* =========================
   PROFILE
========================= */

function getProfile(guildId) {
  if (!data.profiles[guildId]) {
    data.profiles[guildId] = {
      name: "Aly",
      profile: null,
      banner: null,
      bio: "Your friendly server AI."
    };

    saveData();
  }

  return data.profiles[guildId];
}

function updateProfile(guildId, changes) {
  const profile = getProfile(guildId);

  if (changes.name !== undefined) {
    profile.name = changes.name;
  }

  if (changes.profile !== undefined) {
    profile.profile = changes.profile;
  }

  if (changes.banner !== undefined) {
    profile.banner = changes.banner;
  }

  if (changes.bio !== undefined) {
    profile.bio = changes.bio;
  }

  saveData();

  return profile;
}

/* =========================
   MEMORY
========================= */

function getMemory(channelId) {
  if (!data.memory[channelId]) {
    data.memory[channelId] = [];
    saveData();
  }

  return data.memory[channelId];
}

function clearMemory(channelId) {
  delete data.memory[channelId];
  saveData();
}

function saveMemory() {
  saveData();
}

module.exports = {
  getSettings,
  getProfile,
  updateProfile,
  getMemory,
  clearMemory,
  saveMemory,
  saveData
};
