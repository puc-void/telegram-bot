const { admin, db } = require('../config/firebase');
const { uploadStates } = require('../states');

/**
 * Registers document listener for PDF uploads.
 */
module.exports = (bot) => {
    bot.on('document', async (ctx) => {
        const telegramId = String(ctx.from.id);

        // Check if user is in active upload wizard state
        if (!uploadStates[telegramId] || !uploadStates[telegramId].readyForPDF) {
            return;
        }

        const document = ctx.message.document;

        try {
            /*
            1. PDF VALIDATION
            */
            if (document.mime_type !== 'application/pdf') {
                return ctx.reply('❌ Only PDF Allowed');
            }

            /*
            2. DUPLICATE FILE CHECK
            */
            const existing = await db.collection('questions')
                .where('fileName', '==', document.file_name)
                .get();

            if (!existing.empty) {
                return ctx.reply('❌ PDF Already Uploaded');
            }

            const uploadData = uploadStates[telegramId];

            /*
            3. SAVE TO DB (status: pending)
            */
            await db.collection('questions').add({
                uploadedBy: telegramId,
                fileName: document.file_name,
                fileId: document.file_id,
                department: 'CSE',
                questionType: uploadData.questionType,
                semester: uploadData.semester,
                courseCode: uploadData.courseCode,
                status: 'pending',
                createdAt: new Date()
            });

            /*
            4. INCREMENT UPLOADS COUNT ON USER DOC
            */
            await db.collection('users').doc(telegramId).update({
                uploads: admin.firestore.FieldValue.increment(1)
            });

            // Cleanup state
            delete uploadStates[telegramId];

            await ctx.reply(
                `✅ <b>PDF Uploaded Successfully</b>\n\n` +
                `📚 <b>Course:</b> ${uploadData.courseCode}\n` +
                `📄 <b>Type:</b> ${uploadData.questionType.toUpperCase()}\n` +
                `📅 <b>Semester/Session:</b> ${uploadData.semester}\n\n` +
                `⏳ <i>Waiting for Admin approval...</i>`,
                { parse_mode: 'HTML' }
            );
        } catch (error) {
            console.error('Error during document upload:', error);
            ctx.reply('❌ An error occurred while uploading the file.');
        }
    });
};
