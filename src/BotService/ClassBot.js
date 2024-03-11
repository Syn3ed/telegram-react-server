require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = process.env.WEB_APP_URL;
const sequelize = require('../BaseData/bdConnect');
const DatabaseService = require(`../BaseData/bdService`)
const { commandAndAnswer } = require('../BotService/botService');
require('../BaseData/bdModel');
const dbManager = new DatabaseService(sequelize)


const commandHandler = new commandAndAnswer(bot);

const { User, UserRequest, Message, Role, Media, MessageChat, OperatorReq } = require('../BaseData/bdModel');


const userPhotos = {};

const sentMediaGroups = {};

const waitingUsers = {};

class BotFunc {

    constructor(token) {
        this.bot = new TelegramBot(token, { polling: true });
    }

    async sendMediaGroup(chatId, userName, userRequestId, timeMess, op) {
        try {
            if (userPhotos[chatId] && userPhotos[chatId].length > 0) {
                const mediaGroupId = userPhotos[chatId][0].mediaGroupId;
                const groupPhotos = userPhotos[chatId].filter(photo => photo.mediaGroupId === mediaGroupId);
                const str = JSON.stringify(groupPhotos);
                const mediaRecord = await createMediaRecord(userRequestId, str);
                await MessageChat.create({
                    IdMedia: mediaRecord.id,
                    roleUser: op,
                    username: userName,
                    UserRequestId: userRequestId,
                    TimeMessages: timeMess,
                })
                userPhotos[chatId] = userPhotos[chatId].filter(photo => photo.mediaGroupId !== mediaGroupId);
                sentMediaGroups[chatId] = false;
            }
        }
        catch (e) {
            console.log(e)
        }
    }

    async replyToUser(req) {
        const { queryId, userRequestId, username, userId, operatorId } = req.body;
        const requestId = userRequestId;
        const userWebId = operatorId;
        try {
            const userRequest = await dbManager.findReq(userRequestId);
            const user = await User.findByPk(userId);
            if (!userRequest) {
                this.bot.sendMessage(operatorId, 'Заявка не найдена.');
                return;
            }

            waitingUsers[userWebId] = true;

            await this.bot.sendMessage(userWebId, 'Введите сообщение:');

            const reply = await new Promise((resolve) => {
                const textHandler = (msg) => {
                    const userId = msg.from.id;
                    if (userId === userWebId && waitingUsers[userWebId]) {
                        waitingUsers[userWebId] = false;
                        this.bot.off('text', textHandler);
                        resolve(msg);
                    }
                };


                this.bot.on('text', textHandler);
            });
            if (reply.text === 'Стоп' || reply.text === 'стоп') {
                await this.bot.sendMessage(userWebId, 'Хорошо');
                return;
            }
            await dbManager.replyToUser(userRequestId, reply.text, operatorId);
            await OperatorReq.create({
                IdRequest: userRequestId,
                idUser: userWebId
            });
            const userRequestStatus = await UserRequest.findByPk(requestId);
            if (userRequestStatus.status === 'ожидает ответа оператора') {
                const status = 'Заявка в обработке!';
                await dbManager.changeStatusRes(requestId, status);
                const message = `Заявка под номером ${requestId} в обработке`
                await commandHandler.sendMessagesToUsersWithRoleId(message, requestId);
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

            await dbManager.createUserRequestMessage(userRequestId, reply.text, operatorId, 'Operator', 'Оператор', timeMess);

            const userTelegramId = await dbManager.findUserToReq(userRequestId);

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


            this.bot.sendMessage(messages[0].UserRequest.User.telegramId, `Вам пришел ответ на вашу заявку под номером ${userRequestId} *проверка postRegex3*`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Ваша Заявка', web_app: { url: appUrl + `/Inlinerequests/${userRequestId}` } }]
                    ]
                }
            });
            this.bot.sendMessage(operatorId, 'Ответ успешно добавлен.');
        } catch (error) {
            console.log(error);
        }
    }

    async replyToOperator_Inline(req) {

        try {
            const { queryId, userRequestId, username, userId, operatorId } = req.body;
            const userWebId = operatorId;
            const user = await User.findByPk(userId);
            const userRequest = await dbManager.findReq(userRequestId);

            if (!userRequest) {
                this.bot.sendMessage(userWebId, 'Заявка не найдена.');
                return res.status(400).json({ error: 'Заявка не найдена.' });
            }

            waitingUsers[userWebId] = true;

            await this.bot.sendMessage(userWebId, 'Введите сообщение:');

            const reply = await new Promise((resolve) => {
                const textHandler = (msg) => {
                    const userId = msg.from.id;
                    if (userId === userWebId && waitingUsers[userWebId]) {
                        waitingUsers[userWebId] = false;
                        this.bot.off('text', textHandler);
                        resolve(msg);
                    }
                };


                this.bot.on('text', textHandler);
            });
            if (reply.text === 'Стоп' || reply.text === 'стоп') {
                await this.bot.sendMessage(userWebId, 'Хорошо');
                return;
            }

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

            await dbManager.replyToOperator(userRequestId, reply.text, messages);

            this.bot.sendMessage(userWebId, 'Ответ успешно добавлен.');
            const timeData = new Date();
            const year = timeData.getFullYear();
            const month = timeData.getMonth() + 1;
            const day = timeData.getDate();
            timeData.setHours(timeData.getHours() + 7);
            const hours = timeData.getHours();
            const minutes = timeData.getMinutes();
            const formattedHours = hours < 10 ? '0' + hours : hours;
            const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

            const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}`
            await dbManager.createUserRequestMessage(userRequestId, reply.text, operatorId, 'User', username, timeMess);

            await this.bot.sendMessage(messages[0].operatorId, 'Пришел ответ от пользователя *проверка postRegex4*', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Пришел ответ от пользователя', web_app: { url: appUrl + `/InlinerequestsOperator/${userRequestId}` } }]
                    ]
                }
            });

            return res.status(200).json({});
        } catch (error) {
            console.log(error)
        }
    }

    async closeReq_Inline(req) {
        const { queryId, userRequestId, username, userId, operatorId } = req.body;
        const userWebId = operatorId;
        try {
            const status = 'Заявка закрыта!';
            const message = `Пользователь закрыл заявку №${userRequestId}`
            await commandHandler.sendMessagesToUsersWithRoleId(message, userRequestId);
            await dbManager.changeStatusRes(userRequestId, status);
            await this.bot.sendMessage(userWebId, `Вы закрыли заявку №${userRequestId}`);
        } catch (e) {
            console.log(e)
        }
    }

    async resumeReq_Inline(req) {
        const { queryId, userRequestId, username, userId, operatorId } = req.body;
        const userWebId = operatorId;
        try {
            const status = 'Заявка закрыта!';
            const message = `Пользователь закрыл заявку №${userRequestId}`
            await commandHandler.sendMessagesToUsersWithRoleId(message, userRequestId);
            await dbManager.changeStatusRes(userRequestId, status);
            await this.bot.sendMessage(userWebId, `Вы закрыли заявку №${userRequestId}`);
        } catch (e) {
            console.log(e)
        }
    }

    async handleShowPhoto_Inline(req) {
        const { idMedia, operatorId } = req.body;
        try {
            console.log(idMedia)
            const med = await Media.findByPk(idMedia);
            console.log(med)
            if (med) {
                console.log(med)
                const pht = JSON.parse(med.idMedia);
                await this.bot.sendMediaGroup(operatorId, pht.map(photo => ({
                    type: photo.type,
                    media: photo.media
                })));
            }
        } catch (error) {
            console.log(error)
        }
    }

    async replyToOperatorPhoto_Inline(req) {
        const { userRequestId, username, operatorId } = req.body;
        const userId = operatorId;
        const chatId = operatorId;
        const userName = username;
        try {
            await this.bot.sendMessage(chatId, 'Прикрепите файл:');

            waitingUsers[userId] = true;
            const textHandler = async (response) => {
                if (userId === response.from.id && waitingUsers[userId]) {

                    const reply = response;
                    if (reply?.text === 'Стоп' || reply?.text === 'стоп') {
                        await this.bot.sendMessage(userId, 'Хорошо');
                        waitingUsers[userId] = false;
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

                    const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}`
                    if (reply.photo) {
                        userPhotos[chatId] = userPhotos[chatId] || [];
                        userPhotos[chatId].push({
                            type: 'photo',
                            media: reply.photo[0].file_id,
                            mediaGroupId: reply.media_group_id
                        });
                        console.log('Получена фотография:');
                        console.log(userPhotos[chatId]);
                    } else if (reply.document) {
                        userPhotos[chatId].push({
                            type: 'document',
                            media: reply.document.file_id,
                            mediaGroupId: reply.media_group_id
                        });
                    } else if (reply.video) {
                        userPhotos[chatId].push({
                            type: 'video',
                            media: reply.video.file_id,
                            mediaGroupId: reply.media_group_id
                        });
                    }
                    if (!sentMediaGroups[chatId] && !reply?.text) {
                        setTimeout(() => {
                            const op = 'User'
                            const useName = 'Оператор'
                            sendMediaGroup(chatId, userName, userRequestId, timeMess, op);
                            waitingUsers[userId] = false;
                            this.bot.off('message', textHandler);
                            this.bot.sendMessage(chatId, `Файл успешно добавлен к заявке №${userRequestId}`);
                        }, 1000);
                        sentMediaGroups[chatId] = true;
                    }
                    if (!reply || !reply.photo || !reply.photo[0]) {
                        throw new Error('Не удалось получить фотографию.');
                    }
                }
            };
            this.bot.on('message', textHandler);
        } catch (error) {
            console.log(error)
        }
    }

    async resToUserPhoto_Inline(req) {
        const { userRequestId, username, operatorId } = req.body;
        const userId = operatorId;
        const chatId = operatorId;
        const userName = username;
        try {
            await this.bot.sendMessage(userId, 'Прикрепите файл:');

            waitingUsers[userId] = true;
            const textHandler = async (response) => {
                if (userId === response.from.id && waitingUsers[userId]) {

                    const reply = response;
                    if (reply?.text === 'Стоп' || reply?.text === 'стоп') {
                        await this.bot.sendMessage(userId, 'Хорошо');
                        waitingUsers[userId] = false;
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
                    const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}`
                    if (reply.photo) {
                        userPhotos[chatId] = userPhotos[chatId] || [];
                        userPhotos[chatId].push({
                            type: 'photo',
                            media: reply.photo[0].file_id,
                            mediaGroupId: reply.media_group_id
                        });
                        console.log('Получена фотография:');
                        console.log(userPhotos[chatId]);
                    } else if (reply.document) {
                        userPhotos[chatId].push({
                            type: 'document',
                            media: reply.document.file_id,
                            mediaGroupId: reply.media_group_id
                        });
                    } else if (reply.video) {
                        userPhotos[chatId].push({
                            type: 'video',
                            media: reply.video.file_id,
                            mediaGroupId: reply.media_group_id
                        });
                    }
                    if (!sentMediaGroups[chatId] && !reply?.text) {

                        setTimeout(() => {
                            const op = 'Operator'
                            const useName = 'Оператор'
                            sendMediaGroup(chatId, useName, userRequestId, timeMess, op);
                            waitingUsers[userId] = false;
                            this.bot.off('message', textHandler);
                            this.bot.sendMessage(chatId, `Файл успешно добавлен к заявке №${userRequestId}`);
                        }, 1000);
                        sentMediaGroups[chatId] = true;
                    }

                    if (!reply || !reply.photo || !reply.photo[0]) {
                        throw new Error('Не удалось получить фотографию.');
                    }
                }
            };
            this.bot.on('message', textHandler);
        } catch (error) {
            console.log(error)
        }
    }

    async handleShowPhoto(idMed, chatId) {
        try {
            const med = await Media.findByPk(idMed);
            const pht = JSON.parse(med.idMedia);
            await this.bot.sendMediaGroup(chatId, pht.map(photo => ({
                type: photo.type,
                media: photo.media
            })));
        } catch (e) {
            console(e)
        }
    }

    async resToUserPhoto(chatId, userRequestId, userId) {
        try {
            await this.bot.sendMessage(userId, 'Прикрепите файл:');

            waitingUsers[userId] = true;
            const textHandler = async (response) => {
                if (userId === response.from.id && waitingUsers[userId]) {
                    const reply = response;
                    if (reply?.text === 'Стоп' || reply?.text === 'стоп') {
                        await this.bot.sendMessage(userId, 'Хорошо');
                        waitingUsers[userId] = false;
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

                    const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}`
                    if (reply.photo) {
                        userPhotos[chatId] = userPhotos[chatId] || [];
                        userPhotos[chatId].push({
                            type: 'photo',
                            media: reply.photo[0].file_id,
                            mediaGroupId: reply.media_group_id
                        });
                        console.log('Получена фотография:');
                        console.log(userPhotos[chatId]);
                    } else if (reply.document) {
                        userPhotos[chatId].push({
                            type: 'document',
                            media: reply.document.file_id,
                            mediaGroupId: reply.media_group_id
                        });
                    } else if (reply.video) {
                        userPhotos[chatId].push({
                            type: 'video',
                            media: reply.video.file_id,
                            mediaGroupId: reply.media_group_id
                        });
                    }
                    if (!sentMediaGroups[chatId] && !reply?.text) {

                        setTimeout(() => {
                            const op = 'Operator'
                            const useName = 'Оператор'
                            sendMediaGroup(chatId, useName, userRequestId, timeMess, op);
                            waitingUsers[userId] = false;
                            this.bot.off('message', textHandler);
                            this.bot.sendMessage(chatId, `Файл успешно добавлен к заявке №${userRequestId}`);
                        }, 1000);
                        sentMediaGroups[chatId] = true;
                    }

                    if (!reply || !reply.photo || !reply.photo[0]) {
                        throw new Error('Не удалось получить фотографию.');
                    }
                }
            };
            this.bot.on('message', textHandler);
        } catch (error) {
            console.log(error)
        }
    }

    async resToOperatorPhoto(chatId, userRequestId, userId, userName) {
        try {
            await this.bot.sendMessage(userId, 'Прикрепите файл:');
            waitingUsers[userId] = true;
            const textHandler = async (response) => {
                if (userId === response.from.id && waitingUsers[userId]) {
                    const reply = response;
                    if (reply?.text === 'Стоп' || reply?.text === 'стоп') {
                        await this.bot.sendMessage(userId, 'Хорошо');
                        waitingUsers[userId] = false;
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

                    const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}`
                    if (reply.photo) {
                        userPhotos[chatId] = userPhotos[chatId] || [];
                        userPhotos[chatId].push({
                            type: 'photo',
                            media: reply.photo[0].file_id,
                            mediaGroupId: reply.media_group_id
                        });
                        console.log('Получена фотография:');
                        console.log(userPhotos[chatId]);
                    } else if (reply.document) {
                        userPhotos[chatId].push({
                            type: 'document',
                            media: reply.document.file_id,
                            mediaGroupId: reply.media_group_id
                        });
                    } else if (reply.video) {
                        userPhotos[chatId].push({
                            type: 'video',
                            media: reply.video.file_id,
                            mediaGroupId: reply.media_group_id
                        });
                    }
                    if (!sentMediaGroups[chatId] && !reply?.text) {

                        setTimeout(() => {
                            const op = 'User'
                            const useName = 'Оператор'
                            sendMediaGroup(chatId, userName, userRequestId, timeMess, op);
                            waitingUsers[userId] = false;
                            this.bot.off('message', textHandler);
                            this.bot.sendMessage(userId, `Файл успешно добавлен к заявке №${userRequestId}`);
                        }, 1000);
                        sentMediaGroups[chatId] = true;
                    }
                    if (!reply || !reply.photo || !reply.photo[0]) {
                        throw new Error('Не удалось получить фотографию.');
                    }
                }
            };
            this.bot.on('message', textHandler);
        } catch (error) {
            console.log(error)
        }
    }

    async resToOperator(userRequestId, userId) {
        try {
            const userRequest = await dbManager.findReq(userRequestId);
            if (!userRequest) {
                this.bot.sendMessage(userId, 'Заявка не найдена.');
                return;
            }

            waitingUsers[userId] = true;

            await this.bot.sendMessage(userId, 'Введите сообщение:');

            const textHandler = async (response) => {
                if (userId === response.from.id && waitingUsers[userId]) {
                    this.bot.off('text', textHandler);
                    const reply = response.text;
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
                    if (reply === 'Стоп' || reply === 'стоп') {
                        await this.bot.sendMessage(userId, 'Хорошо');
                        waitingUsers[userId] = false;
                        return;
                    }
                    if (!(reply.entities)) {
                        waitingUsers[userId] = false;
                        const timeData = new Date();
                        const year = timeData.getFullYear();
                        const month = timeData.getMonth() + 1;
                        const day = timeData.getDate();
                        timeData.setHours(timeData.getHours() + 7);
                        const hours = timeData.getHours();
                        const minutes = timeData.getMinutes();
                        const formattedHours = hours < 10 ? '0' + hours : hours;
                        const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

                        const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}`

                        await dbManager.createUserRequestMessage(userRequestId, reply, userId, 'User', username, timeMess);

                        await this.bot.sendMessage(messages[0].operatorId, 'Пришел ответ от пользователя *проверка regex3*', {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: 'Пришел ответ от пользователя', web_app: { url: appUrl + `/InlinerequestsOperator/${userRequestId}` } }]
                                ]
                            }
                        });
                        this.bot.sendMessage(userId, 'Ответ успешно добавлен.');
                    }
                }
            };
            this.bot.on('text', textHandler);
        } catch (error) {
            console.log(error);
        }
    }

    async resToUser(userId) {
        try {
            const userRequest = await dbManager.findReq(requestId);
            if (!userRequest) {
                this.bot.sendMessage(userId, 'Заявка не найдена.');
                return;
            }

            waitingUsers[userId] = true;

            await bot.sendMessage(userId, 'Введите сообщение:');

            const textHandler = async (response) => {
                if (userId === response.from.id && waitingUsers[userId]) {
                    waitingUsers[userId] = false;
                    this.bot.off('text', textHandler);
                    const reply = response.text;
                    if (reply === 'Стоп' || reply === 'стоп') {
                        await this.bot.sendMessage(userId, 'Хорошо');
                        waitingUsers[userId] = false;
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

                    const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}`

                    await dbManager.createUserRequestMessage(requestId, reply, userId, 'Operator', 'Оператор', timeMess);
                    await OperatorReq.create({
                        IdRequest: requestId,
                        idUser: userId
                    });

                    const userRequestStatus = await UserRequest.findByPk(requestId);
                    if (userRequestStatus.status === 'ожидает ответа оператора') {
                        const status = 'Заявка в обработке!';
                        await dbManager.changeStatusRes(requestId, status);
                        const message = `Заявка под номером ${requestId} в обработке`;
                        await commandHandler.sendMessagesToUsersWithRoleId(message, requestId);
                    }
                    const existingMessage = await Message.findByPk(requestId);
                    existingMessage.operatorId = userId;
                    await existingMessage.save();

                    const userTelegramId = await dbManager.findUserToReq(requestId);

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

                    this.bot.sendMessage(messages[0].UserRequest.User.telegramId, `Вам пришел ответ на вашу заявку под номером ${requestId} *проверка regex4*`, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Ваша Заявка', web_app: { url: appUrl + `/Inlinerequests/${requestId}` } }]
                            ]
                        }
                    });

                    this.bot.sendMessage(userId, 'Ответ успешно добавлен.');
                }
            };

            this.bot.on('text', textHandler);
        } catch (error) {
            console.log(error)
            this.bot.sendMessage(userId, 'Произошла ошибка при ответе на заявку.');
        }
    }

    async closeReq(userId) {
        try {
            const status = 'Заявка закрыта!';
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
                this.bot.sendMessage(userId, `Вы закрыли заявку №${requestId} !`);
                this.bot.sendMessage(messages[0].UserRequest.User.telegramId, `Оператор закрыл вашу заявку №${requestId}`)
            }
        } catch (e) {
            console.log(e)
        }
    }

    async resumeReq(requestId) {
        const status = 'ожидает ответа оператора';
        await dbManager.changeStatusRes(requestId, status);
        const message = `Возобновлена заявка под номером ${requestId}`;
        await commandHandler.sendMessagesToUsersWithRoleId(message, requestId)
    }

    async FormReq(data,userId){
        if (data.isSwitchOn) {
            const createdRequest = await dbManager.createUserRequest(`${userId}`, 'ожидает ответа оператора', data.description, data.category, data.address);
            console.log(createdRequest)
            const createdRequestId = createdRequest.dataValues.id;
            const userRequestId = createdRequestId;
            await this.bot.sendMessage(chatId, 'Пожалуйста, прикрепите фото к вашей заявке.');
            waitingUsers[userId] = true;
            const textHandler = async (response) => {
              if (userId === response.from.id && waitingUsers[userId]) {
                const reply = response;

                if (reply?.text === 'Стоп' || reply?.text === 'стоп') {
                  await this.bot.sendMessage(userId, 'Хорошо');
                  waitingUsers[userId] = false;
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
                  userPhotos[chatId] = userPhotos[chatId] || [];
                  userPhotos[chatId].push({
                    type: 'photo',
                    media: reply.photo[0].file_id,
                    mediaGroupId: reply.media_group_id
                  });
                  console.log('Получена фотография:');
                  console.log(userPhotos[chatId]);
                } else if (reply.document) {
                  userPhotos[chatId].push({
                    type: 'document',
                    media: reply.document.file_id,
                    mediaGroupId: reply.media_group_id
                  });
                } else if (reply.video) {
                  userPhotos[chatId].push({
                    type: 'video',
                    media: reply.video.file_id,
                    mediaGroupId: reply.media_group_id
                  });
                }
                if (!sentMediaGroups[chatId] && !reply?.text) {

                  setTimeout(() => {
                    const op = 'User'
                    sendMediaGroup(chatId, userName, userRequestId, timeMess, op);
                    waitingUsers[userId] = false;
                    this.bot.off('message', textHandler);
                    this.bot.sendMessage(chatId, 'Заявка успешно создана');
                    const message = `Создана новая заявка под номером ${createdRequestId}`
                    this.bot.sendMessage(userId, `Файл успешно добавлен к заявке №${userRequestId}`);
                    commandHandler.sendMessagesToUsersWithRoleId(message, createdRequestId);
                  }, 1000);
                  sentMediaGroups[chatId] = true;
                }

                if (!reply || !reply.photo || !reply.photo[0]) {
                  throw new Error('Не удалось получить фотографию.');
                }
              }
            };
            this.bot.on('message', textHandler);
          }
          else {
            const createdRequest = await dbManager.createUserRequest(`${userId}`, 'ожидает ответа оператора', data.description, data.category, data.address);
            const createdRequestId = createdRequest.dataValues.id;
            const userRequestId = createdRequestId;
            this.bot.sendMessage(chatId, 'Заявка успешно создана');
            const message = `Создана новая заявка под номером ${createdRequestId}`
            this.bot.sendMessage(userId, `Файл успешно добавлен к заявке №${userRequestId}`);
            commandHandler.sendMessagesToUsersWithRoleId(message, createdRequestId)
          }
    }
}

module.export = { BotFunc }