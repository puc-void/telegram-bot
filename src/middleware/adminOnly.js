const { db } = require('../config/firebase');

/**
 * Telegraf middleware to restrict bot actions to admin users only.
 */
async function adminOnly(ctx, next) {
    const telegramId = String(ctx.from.id);

    try {
        const userDoc = await db.collection('users').doc(telegramId).get();

        if (!userDoc.exists) {
            return ctx.answerCbQuery('❌ Access Denied: Please sign up first.');
        }

        const userData = userDoc.data();
        if (userData.role !== 'admin') {
            return ctx.answerCbQuery('❌ Admin Only Action');
        }

        return next();
    } catch (error) {
        console.error('Admin middleware authorization error:', error);
        return ctx.answerCbQuery('❌ Error checking permissions.');
    }
}

module.exports = adminOnly;
