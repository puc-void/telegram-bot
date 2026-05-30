const { Markup } = require('telegraf');
const { db } = require('../config/firebase');
const { broadcastStates } = require('../states');
const adminOnly = require('../middleware/adminOnly');

/**
 * Reusable helper to route users to the admin interface or contact directory.
 */
async function handleAdminRoute(ctx, isEdit = true) {
    const telegramId = String(ctx.from.id);

    try {
        const userDoc = await db.collection('users').doc(telegramId).get();
        if (!userDoc.exists) {
            return ctx.reply('❌ Please run /start to register.');
        }

        const userData = userDoc.data();
        if (userData.role === 'admin') {
            // Show Admin Panel
            const text = `👨‍💼 <b>Admin Management Panel</b>\n\nChoose an administrative action below 👇`;
            const keyboard = Markup.inlineKeyboard([
                [
                    Markup.button.callback('📄 Pending Questions', 'pending'),
                    Markup.button.callback('👥 Manage Users', 'admin_users_page_0')
                ],
                [
                    Markup.button.callback('📢 Broadcast Notice', 'broadcast'),
                    Markup.button.callback('📊 Stats Dashboard', 'admin_stats')
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
        } else {
            // Show Admin Directory list to regular students
            const adminsSnapshot = await db.collection('users')
                .where('role', '==', 'admin')
                .get();

            let adminListText = `👨‍💼 <b>Administrator Directory</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `If you have questions pending approval, you can contact the administrators below:\n\n`;

            if (adminsSnapshot.empty) {
                adminListText += `<i>No administrators registered in the system yet.</i>\n`;
            } else {
                let counter = 1;
                adminsSnapshot.forEach((doc) => {
                    const adminData = doc.data();
                    const contact = adminData.username 
                        ? `@${adminData.username}` 
                        : `<a href="tg://user?id=${adminData.telegramId}">Profile Link</a>`;
                    
                    adminListText += `${counter}. <b>${adminData.firstName || 'Admin'}</b> (ID: <code>${adminData.studentId || 'N/A'}</code>) - ${contact}\n`;
                    counter++;
                });
            }

            adminListText += `━━━━━━━━━━━━━━━━━━━━━`;

            const options = {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅ Back to Menu', 'home')]
                ])
            };

            if (isEdit) {
                await ctx.editMessageText(adminListText, options);
            } else {
                await ctx.reply(adminListText, options);
            }
        }
    } catch (error) {
        console.error('Error in admin action route:', error);
        ctx.reply('❌ An error occurred.');
    }
}

/**
 * Registers Admin panel callbacks and commands.
 */
module.exports = (bot) => {
    // --- Commands ---

    // /admin Command
    bot.command('admin', async (ctx) => {
        await handleAdminRoute(ctx, false);
    });

    // --- Actions ---

    // Admin Panel Callback
    bot.action('admin', async (ctx) => {
        await ctx.answerCbQuery();
        await handleAdminRoute(ctx, true);
    });

    // 2. System Stats Dashboard
    bot.action('admin_stats', adminOnly, async (ctx) => {
        await ctx.answerCbQuery();

        try {
            // Get user stats
            const usersSnapshot = await db.collection('users').get();
            const totalUsers = usersSnapshot.size;

            // Get questions stats
            const questionsSnapshot = await db.collection('questions').get();
            const totalQuestions = questionsSnapshot.size;

            let pendingCount = 0;
            let approvedCount = 0;
            let rejectedCount = 0;

            questionsSnapshot.forEach((doc) => {
                const status = doc.data().status;
                if (status === 'pending') pendingCount++;
                else if (status === 'approved') approvedCount++;
                else if (status === 'rejected') rejectedCount++;
            });

            const statsText = `📊 <b>System Statistics Dashboard</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `👥 <b>Total Registered Users:</b> ${totalUsers}\n` +
                `📚 <b>Total Questions Uploaded:</b> ${totalQuestions}\n\n` +
                `⏳ <b>Pending Approval:</b> ${pendingCount}\n` +
                `✅ <b>Approved:</b> ${approvedCount}\n` +
                `❌ <b>Rejected:</b> ${rejectedCount}\n` +
                `━━━━━━━━━━━━━━━━━━━━━`;

            await ctx.editMessageText(statsText, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅ Back to Admin', 'admin')]
                ])
            });
        } catch (error) {
            console.error('Error fetching admin statistics:', error);
            ctx.reply('❌ Failed to retrieve stats.');
        }
    });

    // 3. Pending Questions List
    bot.action('pending', adminOnly, async (ctx) => {
        try {
            const snapshot = await db.collection('questions')
                .where('status', '==', 'pending')
                .get();

            if (snapshot.empty) {
                return ctx.reply('✅ No Pending Questions');
            }

            snapshot.forEach(async (doc) => {
                const data = doc.data();
                await ctx.reply(
                    `📄 <b>File:</b> <code>${data.fileName}</code>\n\n` +
                    `📚 <b>Course:</b> ${data.courseCode}\n` +
                    `📄 <b>Type:</b> ${data.questionType.toUpperCase()}\n` +
                    `📅 <b>Semester:</b> ${data.semester}`,
                    {
                        parse_mode: 'HTML',
                        ...Markup.inlineKeyboard([
                            [
                                Markup.button.callback('✅ Approve', `approve_${doc.id}`),
                                Markup.button.callback('❌ Reject', `reject_${doc.id}`)
                            ]
                        ])
                    }
                );
            });
        } catch (error) {
            console.error('Error fetching pending questions:', error);
            ctx.reply('❌ Error fetching pending questions.');
        }
    });

    // 4. Approve Action
    bot.action(/^approve_(.+)$/, adminOnly, async (ctx) => {
        const questionId = ctx.match[1];

        try {
            await db.collection('questions').doc(questionId).update({
                status: 'approved'
            });

            await ctx.answerCbQuery('✅ Approved');
            await ctx.editMessageText('✅ Question Approved');
        } catch (error) {
            console.error('Error approving question:', error);
            await ctx.answerCbQuery('❌ Error approving question.');
        }
    });

    // 5. Reject Action
    bot.action(/^reject_(.+)$/, adminOnly, async (ctx) => {
        const questionId = ctx.match[1];

        try {
            await db.collection('questions').doc(questionId).update({
                status: 'rejected'
            });

            await ctx.answerCbQuery('❌ Rejected');
            await ctx.editMessageText('❌ Question Rejected');
        } catch (error) {
            console.error('Error rejecting question:', error);
            await ctx.answerCbQuery('❌ Error rejecting question.');
        }
    });

    // 6. Trigger Broadcast Flow
    bot.action('broadcast', adminOnly, async (ctx) => {
        const telegramId = String(ctx.from.id);
        broadcastStates[telegramId] = true;

        await ctx.answerCbQuery();
        await ctx.reply('📢 Send Notice Message');
    });

    // 7. Manage Users - Paginated List
    bot.action(/^admin_users_page_(\d+)$/, adminOnly, async (ctx) => {
        await ctx.answerCbQuery();
        const page = parseInt(ctx.match[1], 10);
        const limit = 5;

        try {
            const snapshot = await db.collection('users').get();
            if (snapshot.empty) {
                return ctx.editMessageText(
                    `👥 <b>User Management Panel</b>\n\nNo registered users found.`,
                    {
                        parse_mode: 'HTML',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('⬅ Back to Admin', 'admin')]
                        ])
                    }
                );
            }

            const totalItems = snapshot.size;
            const totalPages = Math.ceil(totalItems / limit);
            const startIndex = page * limit;
            const endIndex = startIndex + limit;

            const users = [];
            snapshot.forEach((doc) => {
                users.push(doc.data());
            });

            // Sort users: admins first, then by upload count descending
            users.sort((a, b) => {
                if (a.role === 'admin' && b.role !== 'admin') return -1;
                if (a.role !== 'admin' && b.role === 'admin') return 1;
                return (b.uploads || 0) - (a.uploads || 0);
            });

            const pageItems = users.slice(startIndex, endIndex);

            let listText = `👥 <b>User Management Panel</b> (Page <b>${page + 1}</b> of <b>${totalPages}</b>)\n` +
                `Total Registered: ${totalItems}\n\n` +
                `Select a user below to inspect details, modify role, or delete profile 👇`;

            const keyboardButtons = [];
            
            pageItems.forEach((u) => {
                const label = `${u.role === 'admin' ? '⭐' : '👤'} ID: ${u.studentId || 'N/A'} - ${u.firstName || 'User'}`;
                keyboardButtons.push([Markup.button.callback(label, `inspect_user_${u.telegramId}`)]);
            });

            // Navigation Controls
            const navigationRow = [];
            if (page > 0) {
                navigationRow.push(Markup.button.callback('◀️ Prev', `admin_users_page_${page - 1}`));
            }
            navigationRow.push(Markup.button.callback(`📄 ${page + 1}/${totalPages}`, 'noop'));
            if (page < totalPages - 1) {
                navigationRow.push(Markup.button.callback('Next ▶️', `admin_users_page_${page + 1}`));
            }
            keyboardButtons.push(navigationRow);
            keyboardButtons.push([Markup.button.callback('⬅ Back to Admin', 'admin')]);

            await ctx.editMessageText(listText, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(keyboardButtons)
            });
        } catch (error) {
            console.error('Error listing users for admin:', error);
            ctx.reply('❌ Failed to fetch user list.');
        }
    });

    // 8. Inspect Specific User
    bot.action(/^inspect_user_(.+)$/, adminOnly, async (ctx) => {
        await ctx.answerCbQuery();
        const targetUserId = ctx.match[1];

        try {
            const doc = await db.collection('users').doc(targetUserId).get();
            if (!doc.exists) {
                return ctx.editMessageText(
                    `❌ User not found.`,
                    {
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('⬅ Back to List', 'admin_users_page_0')]
                        ])
                    }
                );
            }

            const u = doc.data();
            const regDate = u.createdAt 
                ? u.createdAt.toDate().toLocaleDateString() 
                : 'N/A';

            const userDetailText = `👤 <b>Detailed User Information</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 <b>Student ID:</b> <code>${u.studentId || 'N/A'}</code>\n` +
                `👤 <b>Name:</b> ${u.firstName || 'N/A'}\n` +
                `🔗 <b>Username:</b> ${u.username ? '@' + u.username : 'N/A'}\n` +
                `📱 <b>Telegram ID:</b> <code>${u.telegramId}</code>\n` +
                `🏷️ <b>System Role:</b> <b>${(u.role || 'student').toUpperCase()}</b>\n` +
                `📤 <b>PDFs Contributed:</b> ${u.uploads || 0}\n` +
                `📅 <b>Registered On:</b> ${regDate}\n` +
                `━━━━━━━━━━━━━━━━━━━━━`;

            const keyboardButtons = [];

            // Toggle Role Action Button
            if (u.role === 'admin') {
                keyboardButtons.push([Markup.button.callback('👤 Demote to Student', `user_role_student_${targetUserId}`)]);
            } else {
                keyboardButtons.push([Markup.button.callback('🔑 Promote to Admin', `user_role_admin_${targetUserId}`)]);
            }

            // User Delete Button
            keyboardButtons.push([Markup.button.callback('🗑️ Delete User Profile', `user_delete_confirm_${targetUserId}`)]);
            keyboardButtons.push([Markup.button.callback('⬅ Back to Users List', 'admin_users_page_0')]);

            await ctx.editMessageText(userDetailText, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(keyboardButtons)
            });
        } catch (error) {
            console.error('Error inspecting user:', error);
            ctx.reply('❌ Failed to load user details.');
        }
    });

    // 9. Change Role Actions
    bot.action(/^user_role_(student|admin)_(.+)$/, adminOnly, async (ctx) => {
        const newRole = ctx.match[1];
        const targetUserId = ctx.match[2];

        try {
            await db.collection('users').doc(targetUserId).update({
                role: newRole
            });

            await ctx.answerCbQuery(`✅ Role changed to ${newRole}`);
            
            // Redirect back to user inspect to refresh view
            ctx.editMessageText(`Processing update...`);
            
            const doc = await db.collection('users').doc(targetUserId).get();
            const u = doc.data();
            const regDate = u.createdAt ? u.createdAt.toDate().toLocaleDateString() : 'N/A';
            const userDetailText = `👤 <b>Detailed User Information</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 <b>Student ID:</b> <code>${u.studentId || 'N/A'}</code>\n` +
                `👤 <b>Name:</b> ${u.firstName || 'N/A'}\n` +
                `🔗 <b>Username:</b> ${u.username ? '@' + u.username : 'N/A'}\n` +
                `📱 <b>Telegram ID:</b> <code>${u.telegramId}</code>\n` +
                `🏷️ <b>System Role:</b> <b>${(u.role || 'student').toUpperCase()}</b>\n` +
                `📤 <b>PDFs Contributed:</b> ${u.uploads || 0}\n` +
                `📅 <b>Registered On:</b> ${regDate}\n` +
                `━━━━━━━━━━━━━━━━━━━━━`;

            const keyboardButtons = [];
            if (u.role === 'admin') {
                keyboardButtons.push([Markup.button.callback('👤 Demote to Student', `user_role_student_${targetUserId}`)]);
            } else {
                keyboardButtons.push([Markup.button.callback('🔑 Promote to Admin', `user_role_admin_${targetUserId}`)]);
            }
            keyboardButtons.push([Markup.button.callback('🗑️ Delete User Profile', `user_delete_confirm_${targetUserId}`)]);
            keyboardButtons.push([Markup.button.callback('⬅ Back to Users List', 'admin_users_page_0')]);

            await ctx.editMessageText(userDetailText, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(keyboardButtons)
            });
        } catch (error) {
            console.error('Error changing user role:', error);
            ctx.answerCbQuery('❌ Failed to update role.');
        }
    });

    // 10. Delete User Profile - Confirmation Screen
    bot.action(/^user_delete_confirm_(.+)$/, adminOnly, async (ctx) => {
        await ctx.answerCbQuery();
        const targetUserId = ctx.match[1];

        try {
            const doc = await db.collection('users').doc(targetUserId).get();
            const u = doc.data();

            const confirmText = `⚠️ <b>Confirm Deletion</b>\n\n` +
                `Are you sure you want to delete the user account for:\n` +
                `👤 <b>Name:</b> ${u.firstName || 'User'}\n` +
                `🆔 <b>Student ID:</b> <code>${u.studentId || 'N/A'}</code>?\n\n` +
                `<b>Warning:</b> This is permanent and removes the user registration from the database.`;

            await ctx.editMessageText(confirmText, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('🗑️ Yes, Delete User', `user_delete_execute_${targetUserId}`),
                        Markup.button.callback('❌ Cancel', `inspect_user_${targetUserId}`)
                    ]
                ])
            });
        } catch (error) {
            console.error('Error displaying delete confirmation:', error);
            ctx.reply('❌ Error loading delete confirmation.');
        }
    });

    // 11. Delete User Profile - Execute Deletion
    bot.action(/^user_delete_execute_(.+)$/, adminOnly, async (ctx) => {
        const targetUserId = ctx.match[1];

        try {
            await db.collection('users').doc(targetUserId).delete();
            await ctx.answerCbQuery('✅ User Account Deleted');

            await ctx.editMessageText(
                `✅ <b>User Registration Deleted Successfully</b>`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('⬅ Back to Users List', 'admin_users_page_0')]
                    ])
                }
            );
        } catch (error) {
            console.error('Error deleting user:', error);
            ctx.answerCbQuery('❌ Failed to delete user.');
        }
    });
};
