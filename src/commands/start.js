const { db } = require('../config/firebase');
const { waitingForSignup } = require('../states');
const { showHome } = require('../actions/home');

/**
 * Registers the bot's /start command handler.
 */
module.exports = (bot) => {
    bot.start(async (ctx) => {
        const telegramId = String(ctx.from.id);

        try {
            const userDoc = await db.collection('users').doc(telegramId).get();

            // Handle registration flow if user does not exist in db
            if (!userDoc.exists) {
                waitingForSignup[telegramId] = true;
                return ctx.reply(
                    `🎓 <b>Welcome</b>\n\nPlease signup first.\n\nSend your University Student ID 👇`,
                    { parse_mode: 'HTML' }
                );
            }

            // Existing users are shown the main home menu
            await showHome(ctx);
        } catch (error) {
            console.error('Error in /start command:', error);
            ctx.reply('❌ An error occurred. Please try again later.');
        }
    });
};
