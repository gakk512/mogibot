const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Web server is running");
});

const { Client, GatewayIntentBits, Events } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

client.once(Events.ClientReady, readyClient => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
});

client.on("error", err => {
  console.error("Discord client error:", err);
});

process.on("unhandledRejection", err => {
  console.error("Unhandled Rejection:", err);
});

process.on("uncaughtException", err => {
  console.error("Uncaught Exception:", err);
});

console.log("TOKEN exists?", !!process.env.TOKEN);
console.log("TOKEN length:", process.env.TOKEN ? process.env.TOKEN.length : 0);
console.log("About to login Discord...");

client.login(process.env.TOKEN.trim())
  .then(() => {
    console.log("✅ Bot login success");
  })
  .catch(err => {
    console.error("❌ Bot login failed:", err);
  });