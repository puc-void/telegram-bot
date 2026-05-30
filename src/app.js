const express = require('express');
const bot = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

// Root health check endpoint
app.get('/', (req, res) => {
    res.send('University Bot Running ✅');
});

// Start web server
app.listen(PORT, () => {
    console.log(`Web Server Running On Port ${PORT}`);
});

// Launch bot
bot.launch().catch((err) => {
    console.error('Failed to launch Telegram bot:', err);
});
console.log('✅ Secure University Bot Running...');

// Enable graceful stop on process termination signals
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
