require('dotenv').config();
const appUrl = process.env.WEB_APP_URL;
const sequelize = require('../BaseData/bdConnect');
const DatabaseService = require(`../BaseData/bdService`)
require('../BaseData/bdModel');
const dbManager = new DatabaseService(sequelize)


const { User, UserRequest, Message, Role, Media, MessageChat, OperatorReq } = require('../BaseData/bdModel');

class BotClass {

    constructor(bot) {

        this.bot = bot;
        
        this.userPhotos = {};

        this.sentMediaGroups = {};

        this.waitingUsers = {};

        this.startBot();
    };

    async startBot() {
        await connectToDatabase();
        await createRoles();

        this.bot.onText('Изменить роль пользователю на оператора', async (msg, match) => {
            try {
                const userId = msg.from.id;
                this.waitingUsers[userId] = true;

                await this.bot.sendMessage(userId, 'Введите ID-телеграма пользователя:');
                const textHandler = async (response) => {
                    if (userId === response.from.id && this.waitingUsers[userId]) {
                        this.waitingUsers[userId] = false;
                        this.bot.off('text', textHandler);
                        const reply = response.text;

                        if (!isNaN(reply)) {
                            const chRole = dbManager.changeRoleUser(reply, 1)
                            await this.bot.sendMessage(reply, 'Роль изменена');
                            this.bot.sendMessage(userId, 'Изменение прошло успешно.');
                        } else {
                            this.bot.sendMessage(userId, 'Ошибка: Введенное значение не соответствует ожидаемому формату ID-телеграма. Пожалуйста, введите корректный ID пользователя.');
                        }
                    }
                };

                this.bot.on('text', textHandler);
            } catch (e) {
                console.log(e)
            }
        });


        this.bot.on('message', async (msg) => {

            console.log(msg)
            const chatId = msg.chat.id
            if (msg.text === 'Изменить роль пользователю на админа') {
                try {
                    const userId = msg.from.id;
                    this.waitingUsers[userId] = true;

                    await this.bot.sendMessage(userId, 'Введите ID-телеграма пользователя:');
                    const textHandler = async (response) => {
                        if (userId === response.from.id && this.waitingUsers[userId]) {
                            this.waitingUsers[userId] = false;
                            this.bot.off('text', textHandler);
                            const reply = response.text;

                            if (!isNaN(reply)) {
                                const chRole = dbManager.changeRoleUser(reply, 3)
                                await this.bot.sendMessage(reply, 'Вам присвоена роль "Администратор"');
                                this.bot.sendMessage(userId, 'Роль пользователя успешно изменена.');
                            } else {
                                this.bot.sendMessage(userId, 'Ошибка: Введите, пожалуйста, корректный ID-телеграма пользователя.');
                            }
                        }
                    };

                    this.bot.on('text', textHandler);
                } catch (e) {
                    console.log(e);
                }
            }
            if (msg.text === '/start') {
                try {
                    const chatId = msg.chat.id;
                    await this.bot.sendMessage(chatId, `Привет, ${msg.from.first_name}!`);
                    await dbManager.createUserWithRole(`${chatId}`, `${msg.from.first_name}`, `User`)
                } catch (e) {
                    console.log(e)
                }
            }

            if (msg.text === '/menu') {
                const chatId = msg.chat.id;

                try {
                    const user = await User.findOne({ where: { telegramId: chatId.toString() } });

                    if (!user) {
                        await this.bot.sendMessage(chatId, 'Пользователь не найден.');
                        return;
                    }

                    let keyboard = [];

                    if (user.RoleId == '2') {
                        keyboard = [
                            [{ text: 'Мои заявки', web_app: { url: appUrl + `/RequestUserList/${chatId}` } }],
                            [{ text: 'Создание заявки', web_app: { url: appUrl + '/FormReq' } }]
                        ];
                    } else if (user.RoleId == '3') {
                        keyboard = [
                            [{ text: 'Мои заявки', web_app: { url: appUrl + `/RequestUserList/${chatId}` } }],
                            [{ text: `Текущие заявки`, web_app: { url: appUrl } }, { text: 'Создание заявки', web_app: { url: appUrl + '/FormReq' } }],
                            [{ text: 'Изменить роль пользователю на админа', callback_data: '/resRole' }, { text: 'Меню админа', web_app: { url: appUrl + `/AdminIndex` } }]
                        ];
                    } else if (user.RoleId == '1') {
                        keyboard = [
                            [{ text: `Текущие заявки`, web_app: { url: appUrl } }]
                        ];
                    }

                    await this.bot.sendMessage(chatId, 'Меню бота', {
                        reply_markup: {
                            keyboard: keyboard
                        }
                    });
                } catch (error) {
                    console.error('Ошибка:', error);
                    await this.bot.sendMessage(chatId, 'Произошла ошибка при обработке команды.');
                }
            }

            try {
                if (msg?.web_app_data?.data) {
                    const regex = /\/handleShowPhoto (\d+)/;
                    const regex1 = /\/resToUserPhoto (\d+)/;
                    const regex2 = /\/resToOperatorPhoto (\d+)/;
                    const regex3 = /\/resToOperator (\d+)/;
                    const regex4 = /\/resToUser (\d+)/;
                    const regex5 = /\/closeReq (\d+)/;
                    const regex6 = /\/resumeReq (\d+)/;
                    if (msg?.web_app_data?.data && regex.test(msg.web_app_data.data)) {
                        const match = msg.web_app_data.data.match(regex);
                        const idMed = match[1];
                        try {
                            const med = await Media.findByPk(idMed);
                            // await this.bot.sendPhoto(msg.chat.id, med.idMedia);
                            console.log('asdPHT')
                            console.log(med)
                            const pht = JSON.parse(med.idMedia);
                            await this.bot.sendMediaGroup(chatId, pht.map(photo => ({
                                type: photo.type,
                                media: photo.media
                            })));
                        } catch (e) {
                            console(e)
                        }
                        console.log(idMed);
                    }
                    if (msg?.web_app_data?.data && regex2.test(msg.web_app_data.data)) {
                        const match = msg.web_app_data.data.match(regex2);
                        const userRequestId = match[1];
                        const chatId = msg.from.id;
                        const userName = msg.from.first_name
                        MethodToOperator(userRequestId, userName, chatId)
                    }
                    if (msg?.web_app_data?.data && regex1.test(msg.web_app_data.data)) {
                        const match = msg.web_app_data.data.match(regex1);
                        const userRequestId = match[1];
                        const chatId = msg.from.id;
                        const userName = msg.from.first_name
                        MethodToUser(userRequestId, userName, chatId)

                    }
                    if (msg?.web_app_data?.data && regex5.test(msg.web_app_data.data)) {
                        const match = msg.web_app_data.data.match(regex5);
                        const userId = msg.from.id;
                        const requestId = match[1];

                        try {
                            const status = 'Заявка закрыта';
                            await dbManager.changeStatusRes(requestId, status);
                            const messages = await Message.findAll({
                                where: { id: requestId },
                                include: [
                                    {
                                        model: UserRequest,
                                        include: [
                                            {
                                                model: User,
                                                attributes: ['username', 'address', 'telegramId']
                                            }
                                        ]
                                    }
                                ]
                            });
                            if (userId === messages[0].UserRequest.User.telegramId) {
                                this.bot.sendMessage(userId, `Вы закрыли заявку №${requestId}`);
                                await this.bot.sendMessage(messages[0].operatorId, `Пользователь закрыл заявку №${requestId}`);
                            } else {
                                this.bot.sendMessage(userId, `Вы закрыли заявку №${requestId} `);
                                this.bot.sendMessage(messages[0].UserRequest.User.telegramId, `Оператор закрыл вашу заявку №${requestId}`)
                            }
                        } catch (e) {
                            console.log(e)
                        }
                    }
                    if (msg?.web_app_data?.data && regex6.test(msg.web_app_data.data)) {
                        const match = msg.web_app_data.data.match(regex6);
                        const userId = msg.from.id;
                        const requestId = match[1];
                        const status = 'ожидает ответа оператора';
                        await dbManager.changeStatusRes(requestId, status);
                        const message = `Возобновлена заявка под номером ${requestId}`;
                        await sendMessagesToUsersWithRoleId(message, requestId);
                    }
                    const userName = msg.from.first_name;
                    try {
                        const data = JSON.parse(msg?.web_app_data?.data);
                        if (data.isSwitchOn) {
                            const userId = msg.from.id;
                            console.log('asd3')
                            // const createdRequest = await dbManager.createUserRequest(`${msg.from.id}`, 'ожидает ответа оператора', data.description, data.category, data.address);
                            const createdRequest = await dbManager.createUserRequest(`${msg.from.id}`, 'ожидает ответа оператора', data.description, data.category, data.address);
                            console.log(createdRequest)
                            const createdRequestId = createdRequest.dataValues.id;
                            const userRequestId = createdRequestId;
                            await this.bot.sendMessage(chatId, 'Пожалуйста, прикрепите фото к вашей заявке.');
                            this.waitingUsers[userId] = true;
                            const textHandler = async (response) => {
                                if (userId === response.from.id && this.waitingUsers[userId]) {
                                    const reply = response;

                                    if (reply?.text === 'Стоп' || reply?.text === 'стоп') {
                                        await this.bot.sendMessage(userId, 'Хорошо');
                                        this.waitingUsers[userId] = false;
                                        return;
                                    }

                                    const timeData = new Date();
                                    const year = timeData.getFullYear();
                                    const month = timeData.getMonth() + 1;
                                    const day = timeData.getDate();
                                    timeData.setHours(timeData.getHours() + 7);
                                    const hours = timeData.getHours();
                                    const minutes = timeData.getMinutes();
                                    const formattedHours = hours < 10 ? '0' + hours : hours;
                                    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

                                    const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}`;
                                    if (reply.photo) {
                                        this.userPhotos[chatId] = this.userPhotos[chatId] || [];
                                        this.userPhotos[chatId].push({
                                            type: 'photo',
                                            media: reply.photo[0].file_id,
                                            mediaGroupId: reply.media_group_id
                                        });
                                        console.log('Получена фотография:');
                                        console.log(this.userPhotos[chatId]);
                                    } else if (reply.document) {
                                        this.userPhotos[chatId].push({
                                            type: 'document',
                                            media: reply.document.file_id,
                                            mediaGroupId: reply.media_group_id
                                        });
                                    } else if (reply.video) {
                                        this.userPhotos[chatId].push({
                                            type: 'video',
                                            media: reply.video.file_id,
                                            mediaGroupId: reply.media_group_id
                                        });
                                    }
                                    if (!this.sentMediaGroups[chatId] && !reply?.text) {

                                        setTimeout(() => {
                                            const op = 'User'
                                            sendMediaGroup(chatId, userName, userRequestId, timeMess, op);
                                            this.waitingUsers[userId] = false;
                                            this.bot.off('message', textHandler);
                                            this.bot.sendMessage(chatId, 'Заявка успешно создана');
                                            const message = `Создана новая заявка под номером ${createdRequestId}`
                                            this.bot.sendMessage(msg.chat.id, `Файл успешно добавлен к заявке №${userRequestId}`);
                                            this.bot.sendMessage(chatId, `Ваша заявка создана с номером ${userRequestId} *проверка regexIsSwitch${data.isSwitchOn}*`, {
                                                reply_markup: {
                                                    inline_keyboard: [
                                                        [{ text: 'Ваша Заявка', web_app: { url: appUrl + `/Inlinerequests/${userRequestId}` } }]
                                                    ]
                                                }
                                            });
                                            sendMessagesToUsersWithRoleId(message, createdRequestId);
                                        }, 1000);
                                        this.sentMediaGroups[chatId] = true;
                                    }

                                    if (!reply || !reply.photo || !reply.photo[0]) {
                                        throw new Error('Не удалось получить фотографию.');
                                    }


                                }
                            };
                            this.bot.on('message', textHandler);
                        } else {
                            const createdRequest = await dbManager.createUserRequest(`${msg.from.id}`, 'ожидает ответа оператора', data.description, data.category, data.address);
                            const createdRequestId = createdRequest.dataValues.id;
                            const userRequestId = createdRequestId;
                            const message = `Создана новая заявка под номером ${createdRequestId}`
                            this.bot.sendMessage(chatId, `Ваша заявка создана с номером ${userRequestId} *проверка regexIsSwitch${data.isSwitchOn}*`, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: 'Ссылка на заявку', web_app: { url: appUrl + `/Inlinerequests/${userRequestId}` } }]
                                    ]
                                }
                            });
                            sendMessagesToUsersWithRoleId(message, createdRequestId)
                        }
                    }
                    catch (e) {
                        console.log(e)
                    }
                }
            } catch (e) {
                console.log(e)
            }

        });

        this.bot.on('callback_query', async (msg) => {

            console.log(msg)
            console.log('11111111111111111111111111111111111111111111111111111111111111111111111111')
            console.log(msg.data)
            const data1 = msg.data;
            const callbackQueryId = msg.id
            const chatId = msg.from.id;
            const userName = msg.from.first_name
            if (data1 === 'Стоп') {
                const userId = msg.from.id;
                if (this.waitingUsers[userId]) {
                    this.waitingUsers[userId] = false
                    await this.bot.answerCallbackQuery(callbackQueryId);
                    await this.bot.sendMessage(chatId, `Вы завершили предыдушие действие.`)
                } else {
                    await this.bot.answerCallbackQuery(callbackQueryId);
                    await this.bot.sendMessage(chatId, `Вы уже завершили предыдушие действие.`)
                }
            }
            if (data1) {
                const regex = /\/handleShowPhoto (\d+)/;
                const regex1 = /\/resToUserPhoto (\d+)/;
                const regex2 = /\/resToOperatorPhoto (\d+)/;
                const regex3 = /\/resToOperator (\d+)/;
                const regex4 = /\/resToUser (\d+)/;
                const regex5 = /\/closeReq (\d+)/;
                const regex6 = /\/resumeReq (\d+)/;
                if (regex.test(data1)) {
                    const match = data1.match(regex);
                    const idMed = match[1];
                    try {
                        const med = await Media.findByPk(idMed);
                        console.log('asdPHT')
                        console.log(med)
                        const pht = JSON.parse(med.idMedia);
                        await this.bot.sendMediaGroup(chatId, pht.map(photo => ({
                            type: photo.type,
                            media: photo.media
                        })));
                    } catch (e) {
                        console(e)
                    }
                    console.log(idMed);
                }
                if (regex2.test(data1)) {
                    const match = data1.match(regex2);
                    const userRequestId = match[1];
                    MethodToOperator(userRequestId, userName, chatId);
                    await this.bot.answerCallbackQuery(callbackQueryId);
                }
                if (regex1.test(data1)) {
                    const match = data1.match(regex1);
                    const userRequestId = match[1];
                    MethodToUser(userRequestId, userName, chatId);
                    await this.bot.answerCallbackQuery(callbackQueryId);
                }             
                if (regex5.test(data1)) {
                    const match = data1.match(regex5);
                    const userId = msg.from.id;
                    const requestId = match[1];

                    try {
                        const status = 'Заявка закрыта';
                        await dbManager.changeStatusRes(requestId, status);
                        const messages = await Message.findAll({
                            where: { id: requestId },
                            include: [
                                {
                                    model: UserRequest,
                                    include: [
                                        {
                                            model: User,
                                            attributes: ['username', 'address', 'telegramId']
                                        }
                                    ]
                                }
                            ]
                        });
                        if (userId === messages[0].UserRequest.User.telegramId) {
                            this.bot.sendMessage(userId, `Вы закрыли заявку №${requestId}`);
                            await this.bot.sendMessage(messages[0].operatorId, `Пользователь закрыл заявку №${requestId}`);
                        } else {
                            this.bot.sendMessage(userId, `Вы закрыли заявку №${requestId} `);
                            this.bot.sendMessage(messages[0].UserRequest.User.telegramId, `Оператор закрыл вашу заявку №${requestId}`)
                        }
                        await this.bot.answerCallbackQuery(callbackQueryId);
                    } catch (e) {
                        console.log(e)
                    }
                }
                if (regex6.test(data1)) {
                    const match = data1.match(regex6);
                    const userId = msg.from.id;
                    const requestId = match[1];
                    const status = 'ожидает ответа оператора';
                    await dbManager.changeStatusRes(requestId, status);
                    const message = `Возобновлена заявка под номером ${requestId}`;
                    await sendMessagesToUsersWithRoleId(message, requestId);
                    await this.bot.answerCallbackQuery(callbackQueryId);
                }
            }
        })
        await this.bot.answerCallbackQuery(callbackQueryId);
    };

    async hndlMed(idMedia, operatorId) {
        console.log(idMedia)
        const med = await Media.findByPk(idMedia);
        console.log(med)
        if (med) {
            console.log(med)
            const pht = JSON.parse(med.idMedia);
            await this.bot.sendMediaGroup(operatorId, pht.map(photo => ({
                type: photo.type,
                media: photo.media,
            })));
        }
    };

    async createMediaRecord(userRequestId, idMedia) {
        try {
            const userRequest = await UserRequest.findByPk(userRequestId);

            if (!userRequest) {
                console.error('Заявка не найдена.');
                return;
            }

            const mediaRecord = await Media.create({
                idMedia,
                UserRequestId: userRequestId,
            });


            console.log('Запись в таблице Media успешно создана:', mediaRecord);
            return mediaRecord
        } catch (error) {
            console.error('Ошибка при создании записи в таблице Media:', error);
            throw error;
        }
    };

    timeFunc() {
        const timeData = new Date();
        const year = timeData.getFullYear();
        const month = timeData.getMonth() + 1;
        const day = timeData.getDate();
        timeData.setHours(timeData.getHours() + 7);
        const hours = timeData.getHours();
        const minutes = timeData.getMinutes();
        const formattedHours = hours < 10 ? '0' + hours : hours;
        const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

        return `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}`
    };

    async sendMessagesToUsersWithRoleId(message, id) {
        try {
            const usersWithRoleId2 = await User.findAll({ where: { RoleId: 3 } });

            usersWithRoleId2.forEach(user => {
                const userId = user.telegramId;
                this.bot.sendMessage(userId, message, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: `Ссылка на заявку`, web_app: { url: appUrl + `/InlinerequestsOperator/${id}` } }]
                        ]
                    }
                })
                    .then(sentMessage => {
                        console.log(`Сообщение успешно отправлено пользователю с id ${userId}`);
                    })
                    .catch(error => {
                        console.error(`Ошибка при отправке сообщения пользователю с id ${userId}:`, error);
                    });
            });
        } catch (error) {
            console.error('Ошибка при отправке сообщений пользователям с RoleId = 2:', error);
        }
    };

    async messagesFunc(userRequestId) {
        const messages = await Message.findAll({
            where: { id: userRequestId },
            include: [
                {
                    model: UserRequest,
                    include: [
                        {
                            model: User,
                            attributes: ['username', 'address', 'telegramId']
                        }
                    ]
                }
            ]
        })
        return messages;
    };

    async resToOperatorFunc(chatId, userName, userRequestId, timeMess, userId, textHandler, caption_text) {
        const op = 'User'
        await sendMediaGroup1(chatId, userName, userRequestId, timeMess, op, caption_text);
        this.waitingUsers[userId] = false;
        this.bot.off('message', textHandler);
        await this.bot.sendMessage(chatId, `Ответ успешно добавлен к заявке #${userRequestId}`);
        return;
    };

    async resToOperatorTextFunc(userRequestId, reply, operatorId, username, timeMess, chatId, messages, textHandler) {
        this.waitingUsers[chatId] = false;
        await dbManager.createUserRequestMessage(userRequestId, reply.text, operatorId, 'User', username, timeMess);
        await this.bot.sendMessage(chatId, `Ответ успешно добавлен к заявке #${userRequestId}`);
        console.log('resToOperatorTextFunc')
        await this.bot.sendMessage(messages[0].operatorId, `Вам пришел ответ ответ от пользователя заявку #${userRequestId} *проверка postRegex4*\n${reply.text}`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Cсылка на заявку', web_app: { url: appUrl + `/InlinerequestsOperator/${userRequestId}` } }],
                    [{ text: 'Ответить', callback_data: `/resToUserPhoto ${userRequestId}` }]
                ]
            }
        });
        console.log('resToOperatorTextFunc')
        this.bot.off('message', textHandler);
        return;
    };

    async resToUserTextFunc(userRequestId, reply, operatorId, username, timeMess, chatId, messages, textHandler) {
        this.waitingUsers[chatId] = false;
        await dbManager.createUserRequestMessage(userRequestId, reply.text, operatorId, 'Operator', 'Оператор', timeMess);
        await this.bot.sendMessage(chatId, `Ответ успешно добавлен к заявке #${userRequestId}`);
        console.log('resToUserTextFunc')
        await this.bot.sendMessage(messages[0].UserRequest.User.telegramId, `Вам пришел ответ ответ на заявку #${userRequestId} *проверка postRegex4*\n${reply.text}`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Cсылка на заявку', web_app: { url: appUrl + `/Inlinerequests/${userRequestId}` } }],
                    [{ text: 'Ответить', callback_data: `/resToOperatorPhoto ${userRequestId}` }]
                ]
            }
        });
        console.log('resToUserTextFunc')
        this.bot.off('message', textHandler);
        return;
    };

    async MethodToOperator(userRequestId, userName, chatId) {
        if (!this.waitingUsers[chatId]) {
            try {
                await this.bot.sendMessage(chatId, 'Пожалуйста, введите сообщение или прикрепите файл(ы).\n Вы также можете отменить действие, нажав на кнопку "Стоп"', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Стоп', callback_data: 'Стоп' }]
                        ]
                    }
                });

                this.waitingUsers[chatId] = true;
                const textHandler = async (response) => {
                    if (chatId === response.from.id && this.waitingUsers[chatId]) {

                        const reply = response;
                        if ((reply?.text === 'Стоп' || reply?.text === 'стоп') && this.waitingUsers[chatId]) {
                            this.waitingUsers[chatId] = false;
                            return this.bot.sendMessage(chatId, 'Хорошо');;
                        }

                        const timeMess = timeFunc()
                        let caption_text;

                        const messages = await messagesFunc(userRequestId)

                        if (reply.photo) {
                            this.userPhotos[chatId] = this.userPhotos[chatId] || [];
                            this.userPhotos[chatId].push({
                                type: 'photo',
                                media: reply.photo[0].file_id,
                                mediaGroupId: reply.media_group_id
                            });
                            console.log('Получена фотография:');
                            console.log(this.userPhotos[chatId]);
                        } else if (reply.document) {
                            this.userPhotos[chatId].push({
                                type: 'document',
                                media: reply.document.file_id,
                                mediaGroupId: reply.media_group_id
                            });
                        } else if (reply.video) {
                            this.userPhotos[chatId].push({
                                type: 'video',
                                media: reply.video.file_id,
                                mediaGroupId: reply.media_group_id
                            });
                        }
                        if (reply.caption) {
                            caption_text = reply.caption
                            dbManager.createUserRequestMessage(userRequestId, caption_text, chatId, 'User', userName, timeMess);
                        }

                        if (!this.sentMediaGroups[chatId] && !reply?.text) {
                            this.sentMediaGroups[chatId] = true;
                            setTimeout(() => {
                                console.log(this.sentMediaGroups[chatId])
                                resToOperatorFunc(chatId, userName, userRequestId, timeMess, chatId, textHandler, caption_text);
                                console.log(this.waitingUsers[chatId])
                            }, 1000);
                        }
                        if (reply?.text) {
                            setTimeout(() => {
                                resToOperatorTextFunc(userRequestId, reply, chatId, userName, timeMess, chatId, messages, textHandler);
                                console.log(this.waitingUsers[chatId])
                            }, 1000);
                        }
                    }
                };
                this.bot.on('message', textHandler);
            } catch (error) {
                console.log(error)
            }
        } else {
            await this.bot.sendMessage(chatId, `Вы не завершили предыдушие действие. Хотите завершить?`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Стоп', callback_data: 'Стоп' }]
                    ]
                }
            });
        }
    };

    async MethodToUser(userRequestId, userName, chatId) {
        if (!this.waitingUsers[chatId]) {
            const username = userName
            try {
                await this.bot.sendMessage(chatId, 'Пожалуйста, введите сообщение или прикрепите файл(ы).\n Вы также можете отменить действие, нажав на кнопку "Стоп"', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Стоп', callback_data: 'Стоп' }]
                        ]
                    }
                });

                this.waitingUsers[chatId] = true;
                const textHandler = async (response) => {
                    if (chatId === response.from.id && this.waitingUsers[chatId]) {

                        const reply = response;
                        if ((reply?.text === 'Стоп' || reply?.text === 'стоп') && this.waitingUsers[chatId]) {
                            this.waitingUsers[chatId] = false;
                            return this.bot.sendMessage(chatId, 'Хорошо');;
                        }
                        let caption_text;

                        const timeMess = timeFunc()
                        const messages = await messagesFunc(userRequestId)
                        if (reply.photo) {
                            this.userPhotos[chatId] = this.userPhotos[chatId] || [];
                            this.userPhotos[chatId].push({
                                type: 'photo',
                                media: reply.photo[0].file_id,
                                mediaGroupId: reply.media_group_id
                            });
                            console.log('Получена фотография:');
                            console.log(this.userPhotos[chatId]);
                        } else if (reply.document) {
                            this.userPhotos[chatId].push({
                                type: 'document',
                                media: reply.document.file_id,
                                mediaGroupId: reply.media_group_id
                            });
                        } else if (reply.video) {
                            this.userPhotos[chatId].push({
                                type: 'video',
                                media: reply.video.file_id,
                                mediaGroupId: reply.media_group_id
                            });
                        }
                        const userRequestStatus = await UserRequest.findByPk(userRequestId);
                        if (userRequestStatus.status === 'ожидает ответа оператора') {
                            const status = 'Заявка в обработке';
                            await dbManager.changeStatusRes(userRequestId, status);
                            const message = `Заявка под номером ${userRequestId} в обработке`;
                            await sendMessagesToUsersWithRoleId(message, userRequestId);
                        }
                        const existingMessage = await Message.findByPk(userRequestId);
                        existingMessage.operatorId = chatId;
                        await existingMessage.save();

                        if (reply.caption) {
                            caption_text = reply.caption
                            dbManager.createUserRequestMessage(userRequestId, caption_text, chatId, 'Opeartor', 'Оператор', timeMess);
                        }
                        if (!this.sentMediaGroups[chatId] && !reply?.text) {
                            this.sentMediaGroups[chatId] = true;
                            setTimeout(() => {
                                console.log(this.sentMediaGroups[chatId])
                                resToUserFunc(chatId, userRequestId, timeMess, chatId, textHandler, caption_text);
                                console.log(this.waitingUsers[chatId])
                            }, 1000);
                        }

                        if (reply?.text) {
                            setTimeout(() => {
                                resToUserTextFunc(userRequestId, reply, chatId, username, timeMess, chatId, messages, textHandler)
                                console.log(this.waitingUsers[chatId])
                            }, 1000);
                        }

                    }
                };
                this.bot.on('message', textHandler);
            } catch (error) {
                console.log(error)
            }
        } else {
            await this.bot.sendMessage(chatId, `Вы не завершили предыдушие действие. Хотите завершить?`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Стоп', callback_data: 'Стоп' }]
                    ]
                }
            });
        }
    };

    async resToUserFunc(chatId, userRequestId, timeMess, userId, textHandler, caption_text) {
        const op = 'Operator'
        const useName = 'Оператор'
        await sendMediaGroup1(chatId, useName, userRequestId, timeMess, op, caption_text);
        this.waitingUsers[chatId] = false;
        this.bot.off('message', textHandler);
        this.bot.sendMessage(chatId, `Файл успешно добавлен к заявке №${userRequestId}`);
        return;
    };

    async sendMediaGroup1(chatId, userName, userRequestId, timeMess, op, caption_text) {
        if (this.userPhotos[chatId] && this.userPhotos[chatId].length > 0) {
            const mediaGroupId = this.userPhotos[chatId][0].mediaGroupId;
            const groupPhotos = this.userPhotos[chatId].filter(photo => photo.mediaGroupId === mediaGroupId);
            const str = JSON.stringify(groupPhotos);
            const mediaRecord = await createMediaRecord(userRequestId, str);
            await MessageChat.create({
                IdMedia: mediaRecord.id,
                roleUser: op,
                username: userName,
                UserRequestId: userRequestId,
                TimeMessages: timeMess,
            })
            const messages = await Message.findAll({
                where: { id: userRequestId },
                include: [
                    {
                        model: UserRequest,
                        include: [
                            {
                                model: User,
                                attributes: ['username', 'address', 'telegramId']
                            }
                        ]
                    }
                ]
            });


            if (op === 'User') {
                if (messages[0].operatorId) {
                    const tt = await hndlMed(mediaRecord.id, messages[0].operatorId);
                    if (caption_text) {
                        await this.bot.sendMessage(messages[0].operatorId, caption_text)
                    }
                    await this.bot.sendMessage(messages[0].operatorId, `*проверка sendMediaGroup для Regex${op}*`, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Ссылка на заявку', web_app: { url: appUrl + `/InlinerequestsOperator/${userRequestId}` } }],
                                [{ text: 'Ответить', callback_data: `/resToUserPhoto ${userRequestId}` }]
                            ]
                        }
                    });
                }
            } else {
                const tt = await hndlMed(mediaRecord.id, messages[0].UserRequest.User.telegramId);
                if (caption_text) {
                    await this.bot.sendMessage(messages[0].UserRequest.User.telegramId, caption_text)
                }
                await this.bot.sendMessage(messages[0].UserRequest.User.telegramId, `*проверка sendMediaGroup для Regex ${op}*`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Ссылка на заявку', web_app: { url: appUrl + `/Inlinerequests/${userRequestId}` } }],
                            [{ text: 'Ответить', callback_data: `/resToOperatorPhoto ${userRequestId}` }]
                        ]
                    }
                });
            }
            console.log('11111111111111111111111111111111111111111111111111111111111111111111111111111111')
            this.userPhotos[chatId] = this.userPhotos[chatId].filter(photo => photo.mediaGroupId !== mediaGroupId);
            this.sentMediaGroups[chatId] = false;
        }
        return;
    };

    async createRoles() {
        try {
            await Role.findOrCreate({ where: { name: 'Admin' } });
            await Role.findOrCreate({ where: { name: 'User' } });
            await Role.findOrCreate({ where: { name: 'Operator' } });
        } catch (error) {
            console.error(error);
        }
    };

    async connectToDatabase() {
        try {
            await sequelize.authenticate();
            await sequelize.sync();
            console.log('Подключение к БД успешно');
            // const userrole = dbManager.changeRoleUser(1, 3)
            app.listen(PORT, () => {
                console.log(`Сервер запущен на порту ${PORT}`);
            });

        } catch (e) {
            console.log('Подключение к БД сломалось', e);
        }
    };


}

module.export = { BotClass }