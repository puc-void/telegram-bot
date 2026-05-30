const { Markup } = require('telegraf');
const { searchStates } = require('../states');

/**
 * Reusable helper to show the guided search session selection menu.
 */
async function showSearchMenu(ctx, isEdit = true) {
    const text = `🔍 <b>Search Questions Repository</b>\n\nChoose Academic Session 👇`;
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('Fall-2023', 'search_session_Fall-2023'),
            Markup.button.callback('Spring-2024', 'search_session_Spring-2024')
        ],
        [
            Markup.button.callback('Fall-2024', 'search_session_Fall-2024'),
            Markup.button.callback('Spring-2025', 'search_session_Spring-2025')
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
 * Reusable helper to prompt for fast search.
 */
async function showFastSearchPrompt(ctx, isEdit = true) {
    const telegramId = String(ctx.from.id);

    searchStates[telegramId] = {
        waitingFastSearch: true
    };

    const text = `⚡ <b>Fast Question Search</b>\n\nSend the <b>Course Code</b> directly (e.g., <code>CSE221</code>, <code>CSE111</code>) to fetch all approved questions across all semesters!`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⬅ Back to Menu', 'home')]
    ]);

    const options = { parse_mode: 'HTML', ...keyboard };

    if (isEdit) {
        await ctx.editMessageText(text, options);
    } else {
        await ctx.reply(text, options);
    }
}

/**
 * Registers search configuration actions and commands.
 */
module.exports = (bot) => {
    // --- Commands ---

    // /search Command
    bot.command('search', async (ctx) => {
        await showSearchMenu(ctx, false);
    });

    // /fastsearch and /fsearch Commands
    bot.command(['fastsearch', 'fsearch'], async (ctx) => {
        await showFastSearchPrompt(ctx, false);
    });

    // --- Actions ---

    // Initial Search Menu Callback
    bot.action('search_menu', async (ctx) => {
        await ctx.answerCbQuery();
        await showSearchMenu(ctx, true);
    });

    // Select Question Type for Selected Session
    bot.action(/^search_session_(.+)$/, async (ctx) => {
        const session = ctx.match[1];
        await ctx.answerCbQuery();
        await ctx.editMessageText(
            `📅 <b>Session:</b> <code>${session}</code>\n\nChoose Question Type 👇`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('📄 Mid Exam', `search_type_mid_${session}`),
                        Markup.button.callback('📄 Final Exam', `search_type_final_${session}`)
                    ],
                    [
                        Markup.button.callback('🎤 Viva Voce', `search_type_viva_${session}`),
                        Markup.button.callback('🧪 Lab Exam', `search_type_lab_${session}`)
                    ],
                    [
                        Markup.button.callback('⬅ Back to Sessions', 'search_menu')
                    ]
                ])
            }
        );
    });

    // Prompt user for the Course Code to execute search
    bot.action(/^search_type_(.+)_(.+)$/, async (ctx) => {
        const telegramId = String(ctx.from.id);
        const type = ctx.match[1];
        const session = ctx.match[2];

        searchStates[telegramId] = {
            questionType: type,
            session: session,
            waitingCourse: true
        };

        await ctx.answerCbQuery();
        await ctx.editMessageText(
            `📚 <b>Send Course Code</b>\n\nType the course code (e.g. <code>CSE221</code>) to execute the search:\n\n📅 <b>Session:</b> <code>${session}</code>\n📄 <b>Type:</b> <code>${type.toUpperCase()}</code>`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('⬅ Back to Types', `search_session_${session}`)
                    ]
                ])
            }
        );
    });

    // Expose the helper so other parts of the code can trigger the prompt
    bot.action('fast_search_prompt', async (ctx) => {
        await ctx.answerCbQuery();
        await showFastSearchPrompt(ctx, true);
    });
};
