const { Markup } = require('telegraf');
const { db } = require('../config/firebase');

/**
 * Reusable helper to show the CSE session selection menu.
 */
async function showCseMenu(ctx, isEdit = true) {
    const text = `💻 <b>CSE Department Repository</b>\n\nChoose Academic Session 👇`;
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('Fall-2023', 'cse_session_Fall-2023'),
            Markup.button.callback('Spring-2024', 'cse_session_Spring-2024')
        ],
        [
            Markup.button.callback('Fall-2024', 'cse_session_Fall-2024'),
            Markup.button.callback('Spring-2025', 'cse_session_Spring-2025')
        ],
        [
            Markup.button.callback('⬅ Back to Menu', 'home')
        ]
    ]);

    const options = { parse_mode: 'HTML', ...keyboard };

    if (isEdit) {
        await ctx.editMessageText(text, options);
    } else {
        await ctx.reply(text, options);
    }
}

/**
 * Registers CSE department action callbacks and commands.
 */
module.exports = (bot) => {
    // --- Commands ---

    // /cse Command
    bot.command('cse', async (ctx) => {
        await showCseMenu(ctx, false);
    });

    // --- Actions ---

    // CSE Menu Callback
    bot.action('cse', async (ctx) => {
        await ctx.answerCbQuery();
        await showCseMenu(ctx, true);
    });

    // Select Question Type for Selected Session
    bot.action(/^cse_session_(.+)$/, async (ctx) => {
        const session = ctx.match[1];
        await ctx.answerCbQuery();
        await ctx.editMessageText(
            `📅 <b>Session:</b> <code>${session}</code>\n\nChoose Question Type 👇`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('📄 Mid Exam', `view_mid_${session}`),
                        Markup.button.callback('📄 Final Exam', `view_final_${session}`)
                    ],
                    [
                        Markup.button.callback('🎤 Viva Voce', `view_viva_${session}`),
                        Markup.button.callback('🧪 Lab Exam', `view_lab_${session}`)
                    ],
                    [
                        Markup.button.callback('⬅ Back to Sessions', 'cse')
                    ]
                ])
            }
        );
    });

    // View questions list & documents
    bot.action(/^view_(.+)_(.+)$/, async (ctx) => {
        const type = ctx.match[1];
        const session = ctx.match[2];

        try {
            await ctx.answerCbQuery();

            const snapshot = await db.collection('questions')
                .where('questionType', '==', type)
                .where('semester', '==', session)
                .where('status', '==', 'approved')
                .get();

            if (snapshot.empty) {
                return ctx.reply('❌ No Questions Found');
            }

            await ctx.reply(
                `✅ <b>Found ${snapshot.size} Question(s)</b>\n\n📅 <b>Session:</b> <code>${session}</code>\n📄 <b>Type:</b> <code>${type.toUpperCase()}</code>`,
                { parse_mode: 'HTML' }
            );

            // Send each file document
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
        } catch (error) {
            console.error('Error fetching CSE questions:', error);
            ctx.reply('❌ An error occurred while retrieving questions.');
        }
    });
};
