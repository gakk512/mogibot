const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Web server is running");
});
const discord = require('discord.js');

const client = new discord.Client({
  intents: Object.values(discord.GatewayIntentBits)
});

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require("discord.js");

const lobbies = new Map();
const MAX = 6;

client.on(Events.ClientReady, () => {
  console.log("Logged in as " + client.user.tag);
});

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

  // Player list
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

  // Reset
  if (message.content === "!reset") {

    lobby.players.clear();
    lobby.closed = false;
    lobby.voting = false;
    lobby.votes = {};

    message.channel.send("🔄 The mock match has been reset.");

    return;
  }

  // Join
  if (message.content === "!c") {

    if (lobby.closed)
      return message.reply("The match is already closed.");

    if (lobby.players.has(message.author.id))
      return message.reply("You have already joined.");

    lobby.players.add(message.author.id);

    message.channel.send(
      `✅ ${message.author.username} joined the match (${lobby.players.size}/6)`
    );

    if (lobby.players.size === MAX) {

      lobby.closed = true;

      const names = [...lobby.players]
        .map(id => `<@${id}>`)
        .join("\n");

      message.channel.send(
        `🔒 6 players have joined\n${names}`
      );

      startVote(message.channel, lobby);
    }

    return;
  }

  // Leave
  if (message.content === "!d") {

    if (lobby.closed)
      return message.reply("⚠️ The match is closed so you cannot leave.");

    if (!lobby.players.has(message.author.id))
      return message.reply("You are not participating.");

    lobby.players.delete(message.author.id);

    message.channel.send(
      `❌ ${message.author.username} left the match (${lobby.players.size}/6)`
    );

    return;
  }

});

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

  const winners = Object.keys(count)
    .filter(k => count[k] === max);

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

function shuffle(arr) {

  for (let i = arr.length - 1; i > 0; i--) {

    const j = Math.floor(Math.random() * (i + 1));

    [arr[i], arr[j]] = [arr[j], arr[i]];

  }

  return arr;
}

function createTeams(channel, lobby, type) {

  const players = shuffle([...lobby.players]);

  if (type === "ffa") {

    channel.send(
      "🎮 Starting FFA\n" +
      players.map(p => `<@${p}>`).join("\n")
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

client.login(process.env.BOT_TOKEN)