const { db } = require('../config/firebase');
const { waitingForSignup } = require('../states');

/**
 * Global authentication middleware to verify user registration.
 * Prompts unregistered users to sign up before letting them access bot features.
 */
async function authMiddleware(ctx, next) {
    const telegramId = String(ctx.from?.id);
    if (!telegramId) return; // Ignore updates without user context

    // Allow /start command to bypass registration check
    if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/start')) {
        return next();
    }

    // Allow active signup inputs to pass through
    if (waitingForSignup[telegramId]) {
        return next();
    }

    try {
        const userDoc = await db.collection('users').doc(telegramId).get();

        if (!userDoc.exists) {
            waitingForSignup[telegramId] = true;
            return ctx.reply(
                `🎓 <b>Welcome</b>\n\nPlease signup first.\n\nSend your University Student ID 👇`,
                { parse_mode: 'HTML' }
            );
        }

        // Cache user info in context state for downstream handlers
        ctx.state.user = userDoc.data();
        return next();
    } catch (error) {
        console.error('Authentication middleware error:', error);
        return ctx.reply('❌ An error occurred while validating your registration.');
    }
}

module.exports = authMiddleware;
