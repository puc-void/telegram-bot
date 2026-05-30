const { Markup } = require('telegraf');
const { db } = require('../config/firebase');
const { searchStates } = require('../states');

/**
 * Renders the home screen/menu of the bot.
 */
async function showHome(ctx) {
    const text = `🎓 <b>University Question Collection Bot</b>\n\nWelcome! Please choose an option from the menu below 👇`;
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('💻 CSE Dept', 'cse'),
            Markup.button.callback('📤 Upload Question', 'upload_pdf')
        ],
        [
            Markup.button.callback('🔍 Guided Search', 'search_menu'),
            Markup.button.callback('⚡ Fast Search', 'fast_search_prompt')
        ],
        [
            Markup.button.callback('👤 My Profile', 'view_profile'),
            Markup.button.callback('📚 All Approved', 'all_approved_page_0')
        ],
        [
            Markup.button.callback('👨‍💼 Admin Panel', 'admin'),
            Markup.button.callback('🚪 Logout', 'logout')
        ]
    ]);

    try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
    } catch (error) {
        await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
    }
}

/**
 * Reusable helper to render paginated approved questions.
 */
async function renderApprovedPage(ctx, page, isEdit = true) {
    const limit = 5;

    try {
        const snapshot = await db.collection('questions')
            .where('status', '==', 'approved')
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            const emptyText = `📚 <b>Approved Questions Repository</b>\n\nNo approved questions found in the system yet.`;
            const emptyKB = Markup.inlineKeyboard([[Markup.button.callback('⬅ Back to Menu', 'home')]]);
            if (isEdit) {
                return ctx.editMessageText(emptyText, { parse_mode: 'HTML', ...emptyKB });
            } else {
                return ctx.reply(emptyText, { parse_mode: 'HTML', ...emptyKB });
            }
        }

        const totalItems = snapshot.size;
        const totalPages = Math.ceil(totalItems / limit);
        const startIndex = page * limit;
        const endIndex = startIndex + limit;

        const questions = [];
        snapshot.forEach((doc) => {
            questions.push({ id: doc.id, ...doc.data() });
        });

        const pageItems = questions.slice(startIndex, endIndex);

        const listText = `📚 <b>Approved Questions Repository</b>\n` +
            `Page <b>${page + 1}</b> of <b>${totalPages}</b> (Total: ${totalItems})\n\n` +
            `Click on any question below to retrieve the PDF file 👇`;

        const keyboardButtons = [];
        
        pageItems.forEach((q) => {
            const label = `📁 [${q.courseCode}] ${q.questionType.toUpperCase()} (${q.semester})`;
            keyboardButtons.push([Markup.button.callback(label, `get_doc_${q.id}`)]);
        });

        const navigationRow = [];
        if (page > 0) {
            navigationRow.push(Markup.button.callback('◀️ Prev', `all_approved_page_${page - 1}`));
        }
        navigationRow.push(Markup.button.callback(`📄 ${page + 1}/${totalPages}`, 'noop'));
        if (page < totalPages - 1) {
            navigationRow.push(Markup.button.callback('Next ▶️', `all_approved_page_${page + 1}`));
        }
        
        keyboardButtons.push(navigationRow);
        keyboardButtons.push([Markup.button.callback('⬅ Back to Menu', 'home')]);

        const options = {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(keyboardButtons)
        };

        if (isEdit) {
            await ctx.editMessageText(listText, options);
        } else {
            await ctx.reply(listText, options);
        }
    } catch (error) {
        console.error('Error rendering approved page:', error);
        ctx.reply('❌ Failed to retrieve questions list.');
    }
}

/**
 * Registers home, logout, profile, fast search and paginated all approved actions and commands.
 */
module.exports = {
    showHome,
    register: (bot) => {
        // --- Commands ---

        // /home Command
        bot.command('home', async (ctx) => {
            await showHome(ctx);
        });

        // /logout Command
        bot.command('logout', async (ctx) => {
            await ctx.reply(
                `✅ <b>Logged Out Successfully</b>\n\nSend /start to log back in.`,
                { parse_mode: 'HTML' }
            );
        });

        // /profile Command
        bot.command('profile', async (ctx) => {
            const telegramId = String(ctx.from.id);

            try {
                const userDoc = await db.collection('users').doc(telegramId).get();
                if (!userDoc.exists) {
                    return ctx.reply('❌ User profile not found. Please run /start to register.');
                }

                const userData = userDoc.data();
                const regDate = userData.createdAt 
                    ? userData.createdAt.toDate().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) 
                    : 'N/A';

                const profileText = `👤 <b>Your Profile Summary</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🆔 <b>Student ID:</b> <code>${userData.studentId || 'N/A'}</code>\n` +
                    `👤 <b>Name:</b> ${userData.firstName || ctx.from.first_name || 'N/A'}\n` +
                    `🔗 <b>Username:</b> ${userData.username ? '@' + userData.username : 'N/A'}\n` +
                    `🏷️ <b>Role:</b> ${userData.role ? userData.role.toUpperCase() : 'STUDENT'}\n` +
                    `📤 <b>Contribution:</b> ${userData.uploads || 0} PDF Upload(s)\n` +
                    `📅 <b>Joined:</b> ${regDate}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━`;

                await ctx.reply(profileText, {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('⬅ Back to Menu', 'home')]
                    ])
                });
            } catch (error) {
                console.error('Error in /profile command:', error);
                ctx.reply('❌ Failed to fetch profile details.');
            }
        });

        // /approved Command
        bot.command('approved', async (ctx) => {
            await renderApprovedPage(ctx, 0, false);
        });

        // --- Inline Action Callbacks ---

        // Home Menu Callback
        bot.action('home', async (ctx) => {
            await ctx.answerCbQuery();
            await showHome(ctx);
        });

        // Logout Callback
        bot.action('logout', async (ctx) => {
            await ctx.answerCbQuery('🚪 Logged Out');
            await ctx.editMessageText(
                `✅ <b>Logged Out Successfully</b>\n\nSend /start to log back in.`,
                { parse_mode: 'HTML' }
            );
        });

        // Profile View Callback
        bot.action('view_profile', async (ctx) => {
            await ctx.answerCbQuery();
            const telegramId = String(ctx.from.id);

            try {
                const userDoc = await db.collection('users').doc(telegramId).get();
                if (!userDoc.exists) {
                    return ctx.reply('❌ User profile not found. Please run /start to register.');
                }

                const userData = userDoc.data();
                const regDate = userData.createdAt 
                    ? userData.createdAt.toDate().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) 
                    : 'N/A';

                const profileText = `👤 <b>Your Profile Summary</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🆔 <b>Student ID:</b> <code>${userData.studentId || 'N/A'}</code>\n` +
                    `👤 <b>Name:</b> ${userData.firstName || ctx.from.first_name || 'N/A'}\n` +
                    `🔗 <b>Username:</b> ${userData.username ? '@' + userData.username : 'N/A'}\n` +
                    `🏷️ <b>Role:</b> ${userData.role ? userData.role.toUpperCase() : 'STUDENT'}\n` +
                    `📤 <b>Contribution:</b> ${userData.uploads || 0} PDF Upload(s)\n` +
                    `📅 <b>Joined:</b> ${regDate}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━`;

                await ctx.editMessageText(profileText, {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('⬅ Back to Menu', 'home')]
                    ])
                });
            } catch (error) {
                console.error('Error fetching user profile:', error);
                ctx.reply('❌ Failed to fetch profile details.');
            }
        });

        // Fast Search Prompt Callback
        bot.action('fast_search_prompt', async (ctx) => {
            await ctx.answerCbQuery();
            const telegramId = String(ctx.from.id);

            searchStates[telegramId] = {
                waitingFastSearch: true
            };

            await ctx.editMessageText(
                `⚡ <b>Fast Question Search</b>\n\nSend the <b>Course Code</b> directly (e.g., <code>CSE221</code>, <code>CSE111</code>) to fetch all approved questions across all semesters!`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('⬅ Back to Menu', 'home')]
                    ])
                }
            );
        });

        // Paginated Approved List Callbacks
        bot.action(/^all_approved_page_(\d+)$/, async (ctx) => {
            const page = parseInt(ctx.match[1], 10);
            await renderApprovedPage(ctx, page, true);
        });

        // No-op action
        bot.action('noop', async (ctx) => {
            await ctx.answerCbQuery();
        });

        // Retrieve Question Document Callback
        bot.action(/^get_doc_(.+)$/, async (ctx) => {
            const questionId = ctx.match[1];

            try {
                const doc = await db.collection('questions').doc(questionId).get();
                if (!doc.exists) {
                    return ctx.answerCbQuery('❌ Question file not found.');
                }

                const data = doc.data();
                
                await ctx.answerCbQuery(`Sending ${data.fileName}...`);

                await ctx.replyWithDocument(
                    data.fileId,
                    {
                        caption: `📚 <b>Course:</b> ${data.courseCode}\n` +
                            `📄 <b>Type:</b> ${data.questionType.toUpperCase()}\n` +
                            `📅 <b>Semester/Session:</b> ${data.semester}\n` +
                            `📁 <b>File Name:</b> <code>${data.fileName}</code>`,
                        parse_mode: 'HTML'
                    }
                );
            } catch (error) {
                console.error('Error sending document:', error);
                await ctx.answerCbQuery('❌ Failed to send document.');
            }
        });
    }
};
