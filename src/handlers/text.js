const { db } = require('../config/firebase');
const {
    waitingForSignup,
    uploadStates,
    searchStates,
    broadcastStates
} = require('../states');

/**
 * Registers text message listener for bot state flows.
 */
module.exports = (bot) => {
    bot.on('text', async (ctx) => {
        const telegramId = String(ctx.from.id);
        const message = ctx.message.text;

        try {
            /*
            1. SIGNUP FLOW
            */
            if (waitingForSignup[telegramId]) {
                if (message.length < 5) {
                    return ctx.reply('❌ Invalid Student ID');
                }

                let role = 'student';
                if (telegramId === process.env.ADMIN_ID) {
                    role = 'admin';
                }

                await db.collection('users').doc(telegramId).set({
                    studentId: message,
                    telegramId: telegramId,
                    firstName: ctx.from.first_name || '',
                    username: ctx.from.username || '',
                    role: role,
                    uploads: 0,
                    createdAt: new Date()
                });

                delete waitingForSignup[telegramId];

                return ctx.reply(`✅ Signup Successful\n\nNow send /start again.`);
            }

            /*
            2. UPLOAD - COURSE CODE INPUT
            */
            if (uploadStates[telegramId] && uploadStates[telegramId].waitingCourse) {
                uploadStates[telegramId].courseCode = message.toUpperCase();
                uploadStates[telegramId].waitingCourse = false;
                uploadStates[telegramId].readyForPDF = true;

                return ctx.reply(
                    `✅ Course Saved\n\n📚 ${message.toUpperCase()}\n\nNow send PDF file 👇`
                );
            }

            /*
            3. SEARCH - COURSE CODE INPUT
            */
            if (searchStates[telegramId] && searchStates[telegramId].waitingCourse) {
                const searchData = searchStates[telegramId];
                const courseCode = message.toUpperCase();

                const snapshot = await db.collection('questions')
                    .where('courseCode', '==', courseCode)
                    .where('semester', '==', searchData.session)
                    .where('questionType', '==', searchData.questionType)
                    .where('status', '==', 'approved')
                    .get();

                if (snapshot.empty) {
                    delete searchStates[telegramId];
                    return ctx.reply('❌ No Questions Found');
                }

                await ctx.reply(
                    `✅ Found ${snapshot.size} Question(s) for 📚 ${courseCode}:`
                );

                snapshot.forEach(async (doc) => {
                    const data = doc.data();
                    await ctx.replyWithDocument(
                        data.fileId,
                        {
                            caption: `📚 <b>Course:</b> ${data.courseCode}\n` +
                                `📄 <b>Type:</b> ${data.questionType.toUpperCase()}\n` +
                                `📅 <b>Semester/Session:</b> ${data.semester}\n` +
                                `📁 <b>File:</b> <code>${data.fileName}</code>`,
                            parse_mode: 'HTML'
                        }
                    );
                });

                delete searchStates[telegramId];
                return;
            }

            /*
            3.5 FAST SEARCH - DIRECT COURSE CODE INPUT
            */
            if (searchStates[telegramId] && searchStates[telegramId].waitingFastSearch) {
                const courseCode = message.toUpperCase();

                const snapshot = await db.collection('questions')
                    .where('courseCode', '==', courseCode)
                    .where('status', '==', 'approved')
                    .get();

                if (snapshot.empty) {
                    delete searchStates[telegramId];
                    return ctx.reply(`❌ No Questions Found for Course Code "${courseCode}"`);
                }

                await ctx.reply(
                    `✅ Found ${snapshot.size} Question(s) for 📚 ${courseCode}:`
                );

                snapshot.forEach(async (doc) => {
                    const data = doc.data();
                    await ctx.replyWithDocument(
                        data.fileId,
                        {
                            caption: `📚 <b>Course:</b> ${data.courseCode}\n` +
                                `📄 <b>Type:</b> ${data.questionType.toUpperCase()}\n` +
                                `📅 <b>Semester/Session:</b> ${data.semester}\n` +
                                `📁 <b>File:</b> <code>${data.fileName}</code>`,
                            parse_mode: 'HTML'
                        }
                    );
                });

                delete searchStates[telegramId];
                return;
            }

            /*
            4. ADMIN - BROADCAST
            */
            if (broadcastStates[telegramId]) {
                const usersSnapshot = await db.collection('users').get();

                usersSnapshot.forEach(async (userDoc) => {
                    const userData = userDoc.data();
                    try {
                        await ctx.telegram.sendMessage(
                            userData.telegramId,
                            `📢 Notice\n\n${message}`
                        );
                    } catch (error) {
                        console.error(`Failed to send broadcast to user ${userData.telegramId}:`, error);
                    }
                });

                delete broadcastStates[telegramId];
                return ctx.reply('✅ Notice Broadcasted');
            }
        } catch (error) {
            console.error('Error in text handler:', error);
            ctx.reply('❌ An error occurred while processing your message.');
        }
    });
};
