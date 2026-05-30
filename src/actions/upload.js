const { Markup } = require('telegraf');
const { uploadStates } = require('../states');

/**
 * Helper to show the upload type selection menu.
 */
async function showUploadMenu(ctx, isEdit = true) {
    const text = `📤 <b>Upload Question PDF</b>\n\nChoose Question Type 👇`;
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('📄 Mid Exam', 'upload_mid'),
            Markup.button.callback('📄 Final Exam', 'upload_final')
        ],
        [
            Markup.button.callback('🎤 Viva Voce', 'upload_viva'),
            Markup.button.callback('🧪 Lab Exam', 'upload_lab')
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
 * Registers upload configuration action and command routes.
 */
module.exports = (bot) => {
    // --- Commands ---

    // /upload Command
    bot.command('upload', async (ctx) => {
        await showUploadMenu(ctx, false);
    });

    // --- Actions ---

    // Initial Upload Menu callback
    bot.action('upload_pdf', async (ctx) => {
        await ctx.answerCbQuery();
        await showUploadMenu(ctx, true);
    });

    // Select session for selected type
    bot.action(/^upload_(.+)$/, async (ctx) => {
        const telegramId = String(ctx.from.id);
        const type = ctx.match[1];

        // Reset or set uploadState for the current user
        uploadStates[telegramId] = {
            questionType: type
        };

        await ctx.answerCbQuery();
        await ctx.editMessageText(
            `📅 <b>Select Academic Session</b> 👇`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('Fall-2023', 'session_Fall-2023'),
                        Markup.button.callback('Spring-2024', 'session_Spring-2024')
                    ],
                    [
                        Markup.button.callback('Fall-2024', 'session_Fall-2024'),
                        Markup.button.callback('Spring-2025', 'session_Spring-2025')
                    ],
                    [
                        Markup.button.callback('⬅ Back to Types', 'upload_pdf')
                    ]
                ])
            }
        );
    });

    // Prompt user for the Course Code
    bot.action(/^session_(.+)$/, async (ctx) => {
        const telegramId = String(ctx.from.id);

        if (!uploadStates[telegramId]) return;

        const session = ctx.match[1];
        uploadStates[telegramId].semester = session;
        uploadStates[telegramId].waitingCourse = true;

        await ctx.answerCbQuery();
        await ctx.editMessageText(
            `📚 <b>Send Course Code</b>\n\nPlease type the course code (e.g. <code>CSE221</code>) and send it directly 👇`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('⬅ Cancel', 'upload_pdf')
                    ]
                ])
            }
        );
    });
};
