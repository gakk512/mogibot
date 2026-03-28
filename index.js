const express = require("express");
const app = express();

// ===== Web server for Render =====
app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Web server is running");
});

// ===== Discord.js =====
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require("discord.js");

// 必要最低限のIntentだけにする
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const lobbies = new Map();
const MAX = 6;

// ===== 起動ログ =====
client.on(Events.ClientReady, () => {
  console.log("Logged in as " + client.user.tag);
});

client.on("error", console.error);

process.on("unhandledRejection", error => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("Uncaught exception:", error);
});

// ===== メッセージコマンド =====
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  const channelId = message.channel.id;

  if (!lobbies.has(channelId)) {
    lobbies.set(channelId, {
      players: new Set(),
      closed: false,
      votes: {},
      voting: false
    });
  }

  const lobby = lobbies.get(channelId);

  // ===== !list =====
  if (message.content === "!list") {
    if (lobby.players.size === 0) {
      return message.reply("There are currently no participants.");
    }

    const names = [...lobby.players]
      .map(id => `<@${id}>`)
      .join("\n");

    message.channel.send(
      `📋 Current participants (${lobby.players.size}/6)\n${names}`
    );

    return;
  }

  // ===== !reset =====
  if (message.content === "!reset") {
    lobby.players.clear();
    lobby.closed = false;
    lobby.voting = false;
    lobby.votes = {};

    message.channel.send("🔄 The mock match has been reset.");
    return;
  }

  // ===== !c (join) =====
  if (message.content === "!c") {
    if (lobby.closed) {
      return message.reply("The match is already closed.");
    }

    if (lobby.players.has(message.author.id)) {
      return message.reply("You have already joined.");
    }

    lobby.players.add(message.author.id);

    message.channel.send(
      `✅ ${message.author.username} joined the match (${lobby.players.size}/6)`
    );

    if (lobby.players.size === MAX) {
      lobby.closed = true;

      const names = [...lobby.players]
        .map(id => `<@${id}>`)
        .join("\n");

      message.channel.send(`🔒 6 players have joined\n${names}`);

      startVote(message.channel, lobby);
    }

    return;
  }

  // ===== !d (leave) =====
  if (message.content === "!d") {
    if (lobby.closed) {
      return message.reply("⚠️ The match is closed so you cannot leave.");
    }

    if (!lobby.players.has(message.author.id)) {
      return message.reply("You are not participating.");
    }

    lobby.players.delete(message.author.id);

    message.channel.send(
      `❌ ${message.author.username} left the match (${lobby.players.size}/6)`
    );

    return;
  }
});

// ===== 投票開始 =====
function startVote(channel, lobby) {
  lobby.voting = true;
  lobby.votes = {};

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("vote_ffa")
      .setLabel("FFA")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("vote_2v2")
      .setLabel("2v2")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("vote_3v3")
      .setLabel("3v3")
      .setStyle(ButtonStyle.Primary)
  );

  channel.send({
    content: "📊 Match format voting (1 minute)",
    components: [row]
  });

  setTimeout(() => {
    finishVote(channel, lobby);
  }, 60000);
}

// ===== ボタン投票 =====
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("vote_")) return;

  const lobby = lobbies.get(interaction.channel.id);
  if (!lobby) return;

  if (!lobby.players.has(interaction.user.id)) {
    return interaction.reply({
      content: "Only participants can vote.",
      ephemeral: true
    });
  }

  lobby.votes[interaction.user.id] = interaction.customId;

  await interaction.reply({
    content: "Your vote has been recorded.",
    ephemeral: true
  });
});

// ===== 投票終了 =====
function finishVote(channel, lobby) {
  const count = {
    ffa: 0,
    "2v2": 0,
    "3v3": 0
  };

  for (const v of Object.values(lobby.votes)) {
    if (v === "vote_ffa") count.ffa++;
    if (v === "vote_2v2") count["2v2"]++;
    if (v === "vote_3v3") count["3v3"]++;
  }

  const max = Math.max(...Object.values(count));
  const winners = Object.keys(count).filter(k => count[k] === max);

  if (winners.length > 1) {
    channel.send("⚠️ It's a tie. Revoting...");
    startVote(channel, lobby);
    return;
  }

  const result = winners[0];

  channel.send(
    `📢 The match format has been decided → **${result.toUpperCase()}**`
  );

  createTeams(channel, lobby, result);
}

// ===== シャッフル =====
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

// ===== チーム作成 =====
function createTeams(channel, lobby, type) {
  const players = shuffle([...lobby.players]);

  if (type === "ffa") {
    channel.send(
      "🎮 Starting FFA\n" + players.map(p => `<@${p}>`).join("\n")
    );
  }

  if (type === "2v2") {
    const team1 = players.slice(0, 2);
    const team2 = players.slice(2, 4);
    const team3 = players.slice(4, 6);

    channel.send(
`🎮 2v2 Teams

Team 1
${team1.map(p => `<@${p}>`).join("\n")}

Team 2
${team2.map(p => `<@${p}>`).join("\n")}

Team 3
${team3.map(p => `<@${p}>`).join("\n")}`
    );
  }

  if (type === "3v3") {
    const team1 = players.slice(0, 3);
    const team2 = players.slice(3, 6);

    channel.send(
`🎮 3v3 Teams

Team 1
${team1.map(p => `<@${p}>`).join("\n")}

Team 2
${team2.map(p => `<@${p}>`).join("\n")}`
    );
  }
}

// ===== ログイン確認ログ =====
console.log("TOKEN exists?", !!process.env.TOKEN);
console.log("TOKEN length:", process.env.TOKEN ? process.env.TOKEN.length : 0);
console.log("About to login Discord...");

// ===== Discordログイン（10秒タイムアウト付き） =====
Promise.race([
  client.login(process.env.TOKEN.trim()),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Discord login timed out after 10 seconds")), 10000)
  )
])
  .then(() => console.log("Bot login success"))
  .catch(err => console.error("Bot login failed:", err));