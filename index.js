require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');
const cookieParser = require('cookie-parser'); // For handling cookies
const crypto = require('crypto'); // For generating unique IDs

const app = express();
const port = 8145;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Mock database for banned users
let bannedUsers = {};

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname));

// Load index.html at the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Set username and create a UserID cookie
app.post('/set-username', (req, res) => {
  const { username } = req.body;
  const userID = crypto.randomInt(100000, 999999).toString(); // Generate a unique 6-digit ID
  if (!username || username.length === 0) {
    return res.status(400).send('Username is required.');
  }
  if (username.toLowerCase() === 'mojothegoatx') {
    return res.status(400).send('This username is not allowed.');
  }
  if (/[\s!@#$%^&*(),.?":{}|<>]/.test(username)) {
    return res.status(400).send('Username contains invalid characters.');
  }
  res.cookie('UserID', userID, { httpOnly: true, maxAge: 86400000 }); // Set cookie for 1 day
  res.cookie('Username', username, { httpOnly: true, maxAge: 86400000 });
  res.send('Username set and cookie created.');
});

// Handle sending messages
app.post('/send-message', (req, res) => {
  const { message } = req.body;
  const userID = req.cookies.UserID;
  const username = req.cookies.Username;

  if (bannedUsers[userID]) {
    return res.status(403).send('You are banned!');
  }

  const channel = client.channels.cache.get('1280847768444735502');
  if (channel) {
    const formattedMessage = `${username}: ${message}`;
    channel.send(formattedMessage);
    // Also send to backend logging channel
    const backendChannel = client.channels.cache.get('1281198573186318397');
    if (backendChannel) {
      backendChannel.send(`${formattedMessage} (UserID: ${userID})`);
    }
    res.send('Message sent!');
  } else {
    res.status(404).send('Channel not found!');
  }
});

// Handle fetching messages
app.get('/get-messages/:channelId', async (req, res) => {
  const { channelId } = req.params;
  const channel = client.channels.cache.get(channelId);
  if (channel) {
    const messages = await channel.messages.fetch({ limit: 10 });
    res.json(messages.map(m => ({ author: m.author.username, content: m.content })));
  } else {
    res.status(404).send('Channel not found!');
  }
});

// Check if user is banned
app.get('/check-ban/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({ banned: bannedUsers[userId] });
});

// Admin endpoints to ban/unban users
app.post('/ban', (req, res) => {
  const { userId } = req.body;
  bannedUsers[userId] = true;
  res.send(`User ${userId} has been banned.`);
});

app.post('/unban', (req, res) => {
  const { userId } = req.body;
  delete bannedUsers[userId];
  res.send(`User ${userId} has been unbanned.`);
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Discord bot login
client.once('ready', () => {
  console.log('Discord bot is online!');
});

client.login(process.env.DISCORD_TOKEN);
