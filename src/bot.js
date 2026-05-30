const { Telegraf } = require('telegraf');

// Instantiate Telegraf bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Global bot error handler
bot.catch((err, ctx) => {
    console.error(`Error for update ${ctx.update.update_id}:`, err);
});

// Import and register global authentication middleware
const authMiddleware = require('./middleware/auth');
bot.use(authMiddleware);

// Import and register sub-handlers
const startCommand = require('./commands/start');
const homeActions = require('./actions/home');
const uploadActions = require('./actions/upload');
const searchActions = require('./actions/search');
const cseActions = require('./actions/cse');
const adminActions = require('./actions/admin');
const textHandler = require('./handlers/text');
const documentHandler = require('./handlers/document');

// 1. Commands
startCommand(bot);

// 2. Button Callback Actions
homeActions.register(bot);
uploadActions(bot);
searchActions(bot);
cseActions(bot);
adminActions(bot);

// 3. Global Event Handlers
textHandler(bot);
documentHandler(bot);

module.exports = bot;
