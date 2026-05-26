require('dotenv').config()

const { Telegraf, Markup } = require('telegraf')
const admin = require('firebase-admin')

/*
========================================
FIREBASE SETUP
========================================
*/

admin.initializeApp({

    credential: admin.credential.cert({

        projectId:
            process.env.FIREBASE_PROJECT_ID,

        clientEmail:
            process.env.FIREBASE_CLIENT_EMAIL,

        privateKey:
            process.env.FIREBASE_PRIVATE_KEY
                .replace(/\\n/g, '\n')

    })

})

const db = admin.firestore()

/*
========================================
BOT SETUP
========================================
*/

const bot = new Telegraf(
    process.env.BOT_TOKEN
)

/*
========================================
TEMP STATES
========================================
*/

const waitingForSignup = {}
const uploadStates = {}
const searchStates = {}
const broadcastStates = {}

/*
========================================
HOME MENU
========================================
*/

async function showHome(ctx) {

    const text =

        `🎓 University Question Collection Bot

Choose an option 👇`

    const keyboard = Markup.inlineKeyboard([

        [
            Markup.button.callback(
                '💻 CSE',
                'cse'
            ),

            Markup.button.callback(
                '📤 Upload',
                'upload_pdf'
            )
        ],

        [
            Markup.button.callback(
                '🔍 Search',
                'search_menu'
            ),

            Markup.button.callback(
                '👨‍💼 Admin',
                'admin'
            )
        ],

        [
            Markup.button.callback(
                '🚪 Logout',
                'logout'
            )
        ]

    ])

    try {

        await ctx.editMessageText(
            text,
            keyboard
        )

    } catch {

        await ctx.reply(
            text,
            keyboard
        )

    }

}

/*
========================================
START COMMAND
========================================
*/

bot.start(async (ctx) => {

    const telegramId =
        String(ctx.from.id)

    const userDoc = await db
        .collection('users')
        .doc(telegramId)
        .get()

    /*
    NEW USER
    */

    if (!userDoc.exists) {

        waitingForSignup[telegramId] = true

        return ctx.reply(

            `🎓 Welcome

Please signup first.

Send your University Student ID 👇`

        )

    }

    /*
    LOGIN
    */

    await ctx.reply(

        `🎓 Welcome Back

Choose an option 👇`,

        Markup.inlineKeyboard([

            [
                Markup.button.callback(
                    '💻 CSE',
                    'cse'
                ),

                Markup.button.callback(
                    '📤 Upload',
                    'upload_pdf'
                )
            ],

            [
                Markup.button.callback(
                    '🔍 Search',
                    'search_menu'
                ),

                Markup.button.callback(
                    '👨‍💼 Admin',
                    'admin'
                )
            ],

            [
                Markup.button.callback(
                    '🚪 Logout',
                    'logout'
                )
            ]

        ])

    )

})

/*
========================================
TEXT SYSTEM
========================================
*/

bot.on('text', async (ctx) => {

    const telegramId =
        String(ctx.from.id)

    const message =
        ctx.message.text

    /*
    SIGNUP
    */

    if (waitingForSignup[telegramId]) {

        if (message.length < 5) {

            return ctx.reply(
                '❌ Invalid Student ID'
            )

        }

        let role = 'student'

        if (
            telegramId ===
            process.env.ADMIN_ID
        ) {

            role = 'admin'

        }

        await db
            .collection('users')
            .doc(telegramId)
            .set({

                studentId: message,

                telegramId: telegramId,

                firstName:
                    ctx.from.first_name || '',

                username:
                    ctx.from.username || '',

                role: role,

                uploads: 0,

                createdAt: new Date()

            })

        delete waitingForSignup[telegramId]

        return ctx.reply(

            `✅ Signup Successful

Now send /start again.`

        )

    }

    /*
    COURSE INPUT FOR UPLOAD
    */

    if (
        uploadStates[telegramId] &&
        uploadStates[telegramId]
            .waitingCourse
    ) {

        uploadStates[
            telegramId
        ].courseCode =
            message.toUpperCase()

        uploadStates[
            telegramId
        ].waitingCourse = false

        uploadStates[
            telegramId
        ].readyForPDF = true

        return ctx.reply(

            `✅ Course Saved

📚 ${message.toUpperCase()}

Now send PDF file 👇`

        )

    }

    /*
    SEARCH COURSE INPUT
    */

    if (
        searchStates[telegramId] &&
        searchStates[telegramId]
            .waitingCourse
    ) {

        const searchData =
            searchStates[telegramId]

        const courseCode =
            message.toUpperCase()

        const snapshot = await db
            .collection('questions')
            .where(
                'courseCode',
                '==',
                courseCode
            )
            .where(
                'semester',
                '==',
                searchData.session
            )
            .where(
                'questionType',
                '==',
                searchData.questionType
            )
            .where(
                'status',
                '==',
                'approved'
            )
            .get()

        if (snapshot.empty) {

            delete searchStates[telegramId]

            return ctx.reply(
                '❌ No Questions Found'
            )

        }

        await ctx.reply(

            `✅ ${snapshot.size} Question(s) Found

📚 ${courseCode}
📅 ${searchData.session}
📄 ${searchData.questionType.toUpperCase()}`

        )

        snapshot.forEach(async (doc) => {

            const data = doc.data()

            await ctx.replyWithDocument(

                data.fileId,

                {
                    caption:

                        `📚 ${data.courseCode}

📄 ${data.questionType}

📅 ${data.semester}

📁 ${data.fileName}`

                }

            )

        })

        delete searchStates[telegramId]

    }

    /*
    BROADCAST
    */

    if (broadcastStates[telegramId]) {

        const users = await db
            .collection('users')
            .get()

        users.forEach(async (user) => {

            const userData = user.data()

            try {

                await ctx.telegram.sendMessage(

                    userData.telegramId,

                    `📢 Notice

${message}`

                )

            } catch (error) {

                console.log(error)

            }

        })

        delete broadcastStates[telegramId]

        return ctx.reply(
            '✅ Notice Broadcasted'
        )

    }

})

/*
========================================
UPLOAD MENU
========================================
*/

bot.action(
    'upload_pdf',
    async (ctx) => {

        await ctx.answerCbQuery()

        await ctx.editMessageText(

            `📤 Upload Question PDF

Choose Question Type 👇`,

            Markup.inlineKeyboard([

                [
                    Markup.button.callback(
                        '📄 Mid',
                        'upload_mid'
                    ),

                    Markup.button.callback(
                        '📄 Final',
                        'upload_final'
                    )
                ],

                [
                    Markup.button.callback(
                        '🎤 Viva',
                        'upload_viva'
                    ),

                    Markup.button.callback(
                        '🧪 Lab',
                        'upload_lab'
                    )
                ],

                [
                    Markup.button.callback(
                        '⬅ Back',
                        'home'
                    )
                ]

            ])

        )

    }
)

/*
========================================
UPLOAD TYPE
========================================
*/

bot.action(
    /^upload_(.+)$/,
    async (ctx) => {

        const telegramId =
            String(ctx.from.id)

        const type =
            ctx.match[1]

        uploadStates[telegramId] = {

            questionType: type

        }

        await ctx.answerCbQuery()

        await ctx.editMessageText(

            `📅 Choose Session 👇`,

            Markup.inlineKeyboard([

                [
                    Markup.button.callback(
                        'Fall-2023',
                        'session_Fall-2023'
                    ),

                    Markup.button.callback(
                        'Spring-2024',
                        'session_Spring-2024'
                    )
                ],

                [
                    Markup.button.callback(
                        'Fall-2024',
                        'session_Fall-2024'
                    ),

                    Markup.button.callback(
                        'Spring-2025',
                        'session_Spring-2025'
                    )
                ],

                [
                    Markup.button.callback(
                        '⬅ Back',
                        'upload_pdf'
                    )
                ]

            ])

        )

    }
)

/*
========================================
SESSION SELECT
========================================
*/

bot.action(
    /^session_(.+)$/,
    async (ctx) => {

        const telegramId =
            String(ctx.from.id)

        if (
            !uploadStates[telegramId]
        ) return

        const session =
            ctx.match[1]

        uploadStates[
            telegramId
        ].semester = session

        uploadStates[
            telegramId
        ].waitingCourse = true

        await ctx.answerCbQuery()

        await ctx.editMessageText(

            `📚 Send Course Code

Example:
CSE221`,

            Markup.inlineKeyboard([

                [
                    Markup.button.callback(
                        '⬅ Back',
                        'upload_pdf'
                    )
                ]

            ])

        )

    }
)

/*
========================================
PDF UPLOAD
========================================
*/

bot.on(
    'document',
    async (ctx) => {

        const telegramId =
            String(ctx.from.id)

        if (
            !uploadStates[
            telegramId
            ] ||
            !uploadStates[
                telegramId
            ].readyForPDF
        ) return

        const document =
            ctx.message.document

        /*
        PDF CHECK
        */

        if (
            document.mime_type !==
            'application/pdf'
        ) {

            return ctx.reply(
                '❌ Only PDF Allowed'
            )

        }

        /*
        DUPLICATE CHECK
        */

        const existing =
            await db
                .collection(
                    'questions'
                )
                .where(
                    'fileName',
                    '==',
                    document.file_name
                )
                .get()

        if (!existing.empty) {

            return ctx.reply(
                '❌ PDF Already Uploaded'
            )

        }

        const uploadData =
            uploadStates[telegramId]

        /*
        SAVE PDF
        */

        await db
            .collection('questions')
            .add({

                uploadedBy:
                    telegramId,

                fileName:
                    document.file_name,

                fileId:
                    document.file_id,

                department: 'CSE',

                questionType:
                    uploadData.questionType,

                semester:
                    uploadData.semester,

                courseCode:
                    uploadData.courseCode,

                status: 'pending',

                createdAt:
                    new Date()

            })

        /*
        UPDATE USER
        */

        await db
            .collection('users')
            .doc(telegramId)
            .update({

                uploads:
                    admin.firestore
                        .FieldValue
                        .increment(1)

            })

        delete uploadStates[
            telegramId
        ]

        await ctx.reply(

            `✅ PDF Uploaded Successfully

📚 ${uploadData.courseCode}

📄 ${uploadData.questionType}

📅 ${uploadData.semester}

⏳ Waiting For Admin Approval`

        )

    }
)

/*
========================================
SEARCH MENU
========================================
*/

bot.action(
    'search_menu',
    async (ctx) => {

        await ctx.answerCbQuery()

        await ctx.editMessageText(

            `🔍 Search Questions

Choose Session 👇`,

            Markup.inlineKeyboard([

                [
                    Markup.button.callback(
                        'Fall-2023',
                        'search_session_Fall-2023'
                    ),

                    Markup.button.callback(
                        'Spring-2024',
                        'search_session_Spring-2024'
                    )
                ],

                [
                    Markup.button.callback(
                        'Fall-2024',
                        'search_session_Fall-2024'
                    ),

                    Markup.button.callback(
                        'Spring-2025',
                        'search_session_Spring-2025'
                    )
                ],

                [
                    Markup.button.callback(
                        '⬅ Back',
                        'home'
                    )
                ]

            ])

        )

    }
)

/*
========================================
SEARCH SESSION
========================================
*/

bot.action(
    /^search_session_(.+)$/,
    async (ctx) => {

        const session =
            ctx.match[1]

        await ctx.answerCbQuery()

        await ctx.editMessageText(

            `📅 ${session}

Choose Question Type 👇`,

            Markup.inlineKeyboard([

                [
                    Markup.button.callback(
                        '📄 Mid',
                        `search_type_mid_${session}`
                    ),

                    Markup.button.callback(
                        '📄 Final',
                        `search_type_final_${session}`
                    )
                ],

                [
                    Markup.button.callback(
                        '🎤 Viva',
                        `search_type_viva_${session}`
                    ),

                    Markup.button.callback(
                        '🧪 Lab',
                        `search_type_lab_${session}`
                    )
                ],

                [
                    Markup.button.callback(
                        '⬅ Back',
                        'search_menu'
                    )
                ]

            ])

        )

    }
)

/*
========================================
SEARCH TYPE
========================================
*/

bot.action(
    /^search_type_(.+)_(.+)$/,
    async (ctx) => {

        const telegramId =
            String(ctx.from.id)

        const type =
            ctx.match[1]

        const session =
            ctx.match[2]

        searchStates[telegramId] = {

            questionType: type,

            session: session,

            waitingCourse: true

        }

        await ctx.answerCbQuery()

        await ctx.editMessageText(

            `📚 Send Course Code

Example:
CSE221

📅 ${session}
📄 ${type.toUpperCase()}`,

            Markup.inlineKeyboard([

                [
                    Markup.button.callback(
                        '⬅ Back',
                        `search_session_${session}`
                    )
                ]

            ])

        )

    }
)

/*
========================================
ADMIN PANEL
========================================
*/

bot.action(
    'admin',
    async (ctx) => {

        const telegramId =
            String(ctx.from.id)

        const userDoc =
            await db
                .collection('users')
                .doc(telegramId)
                .get()

        const userData =
            userDoc.data()

        if (
            userData.role !==
            'admin'
        ) {

            return ctx.answerCbQuery(
                '❌ Admin Only'
            )

        }

        await ctx.answerCbQuery()

        await ctx.editMessageText(

            `👨‍💼 Admin Panel`,

            Markup.inlineKeyboard([

                [
                    Markup.button.callback(
                        '📄 Pending',
                        'pending'
                    ),

                    Markup.button.callback(
                        '📢 Broadcast',
                        'broadcast'
                    )
                ],

                [
                    Markup.button.callback(
                        '⬅ Back',
                        'home'
                    )
                ]

            ])

        )

    }
)

/*
========================================
PENDING PDFS
========================================
*/

bot.action(
    'pending',
    async (ctx) => {

        const snapshot =
            await db
                .collection(
                    'questions'
                )
                .where(
                    'status',
                    '==',
                    'pending'
                )
                .get()

        if (snapshot.empty) {

            return ctx.reply(
                '✅ No Pending Questions'
            )

        }

        snapshot.forEach(
            async (doc) => {

                const data =
                    doc.data()

                await ctx.reply(

                    `📄 ${data.fileName}

📚 ${data.courseCode}

📄 ${data.questionType}

📅 ${data.semester}`,

                    Markup.inlineKeyboard([

                        [
                            Markup.button.callback(
                                '✅ Approve',
                                `approve_${doc.id}`
                            ),

                            Markup.button.callback(
                                '❌ Reject',
                                `reject_${doc.id}`
                            )
                        ]

                    ])

                )

            }
        )

    }
)

/*
========================================
APPROVE
========================================
*/

bot.action(
    /^approve_(.+)$/,
    async (ctx) => {

        const questionId =
            ctx.match[1]

        await db
            .collection('questions')
            .doc(questionId)
            .update({

                status:
                    'approved'

            })

        await ctx.answerCbQuery(
            '✅ Approved'
        )

        await ctx.editMessageText(
            '✅ Question Approved'
        )

    }
)

/*
========================================
REJECT
========================================
*/

bot.action(
    /^reject_(.+)$/,
    async (ctx) => {

        const questionId =
            ctx.match[1]

        await db
            .collection('questions')
            .doc(questionId)
            .update({

                status:
                    'rejected'

            })

        await ctx.answerCbQuery(
            '❌ Rejected'
        )

        await ctx.editMessageText(
            '❌ Question Rejected'
        )

    }
)

/*
========================================
BROADCAST
========================================
*/

bot.action(
    'broadcast',
    async (ctx) => {

        const telegramId =
            String(ctx.from.id)

        broadcastStates[
            telegramId
        ] = true

        await ctx.answerCbQuery()

        await ctx.reply(
            '📢 Send Notice Message'
        )

    }
)

/*
========================================
CSE MENU
========================================
*/

bot.action(
    'cse',
    async (ctx) => {

        await ctx.answerCbQuery()

        await ctx.editMessageText(

            `💻 CSE Department

Choose Session 👇`,

            Markup.inlineKeyboard([

                [
                    Markup.button.callback(
                        'Fall-2023',
                        'cse_session_Fall-2023'
                    ),

                    Markup.button.callback(
                        'Spring-2024',
                        'cse_session_Spring-2024'
                    )
                ],

                [
                    Markup.button.callback(
                        'Fall-2024',
                        'cse_session_Fall-2024'
                    ),

                    Markup.button.callback(
                        'Spring-2025',
                        'cse_session_Spring-2025'
                    )
                ],

                [
                    Markup.button.callback(
                        '⬅ Back',
                        'home'
                    )
                ]

            ])

        )

    }
)

/*
========================================
CSE SESSION
========================================
*/

bot.action(
    /^cse_session_(.+)$/,
    async (ctx) => {

        const session =
            ctx.match[1]

        await ctx.answerCbQuery()

        await ctx.editMessageText(

            `📅 ${session}

Choose Question Type 👇`,

            Markup.inlineKeyboard([

                [
                    Markup.button.callback(
                        '📄 Mid',
                        `view_mid_${session}`
                    ),

                    Markup.button.callback(
                        '📄 Final',
                        `view_final_${session}`
                    )
                ],

                [
                    Markup.button.callback(
                        '🎤 Viva',
                        `view_viva_${session}`
                    ),

                    Markup.button.callback(
                        '🧪 Lab',
                        `view_lab_${session}`
                    )
                ],

                [
                    Markup.button.callback(
                        '⬅ Back',
                        'cse'
                    )
                ]

            ])

        )

    }
)

/*
========================================
VIEW QUESTIONS
========================================
*/

bot.action(
    /^view_(.+)_(.+)$/,
    async (ctx) => {

        const type =
            ctx.match[1]

        const session =
            ctx.match[2]

        await ctx.answerCbQuery()

        const snapshot =
            await db
                .collection(
                    'questions'
                )
                .where(
                    'questionType',
                    '==',
                    type
                )
                .where(
                    'semester',
                    '==',
                    session
                )
                .where(
                    'status',
                    '==',
                    'approved'
                )
                .get()

        if (snapshot.empty) {

            return ctx.reply(
                '❌ No Questions Found'
            )

        }

        await ctx.reply(

            `✅ ${snapshot.size} Question(s) Found

📅 ${session}
📄 ${type.toUpperCase()}`

        )

        snapshot.forEach(
            async (doc) => {

                const data =
                    doc.data()

                await ctx.replyWithDocument(

                    data.fileId,

                    {
                        caption:

                            `📚 ${data.courseCode}

📄 ${data.questionType}

📅 ${data.semester}

📁 ${data.fileName}`

                    }

                )

            }
        )

    }
)

/*
========================================
HOME BUTTON
========================================
*/

bot.action(
    'home',
    async (ctx) => {

        await ctx.answerCbQuery()

        await showHome(ctx)

    }
)

/*
========================================
LOGOUT
========================================
*/

bot.action(
    'logout',
    async (ctx) => {

        await ctx.answerCbQuery(
            '🚪 Logged Out'
        )

        await ctx.editMessageText(

            `✅ Logged Out

Send /start to login again.`

        )

    }
)

/*
========================================
RUN BOT
========================================
*/

bot.launch()

console.log(
    '✅ Secure University Bot Running...'
)

process.once(
    'SIGINT',
    () => bot.stop('SIGINT')
)

process.once(
    'SIGTERM',
    () => bot.stop('SIGTERM')
)