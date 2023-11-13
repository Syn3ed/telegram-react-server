const { menuMain, menuSecond, menuKeyboard, menuKeyboardRemove, comandBot, menuSite } = require(`./options.js`)
const DatabaseService = require(`../BaseData/bdService`);
const sequelize = require(`../BaseData/bdConnect.js`)
const dbManager = new DatabaseService(sequelize);

class commandAndAnswer {
    constructor(bot) {
        this.bot = bot;
        this.commandMap = new Map();
        this.addCommand('/start', this.handleStart);
        this.addCommand('/123', this.handle123);
        this.addCommand('/menu', this.handleMenu);
        this.addCommand('Закрыть меню', this.handleCloseMenu);
        this.addCommand('/create_request', this.handleCreateRequest);
        this.addCommand('/msg', this.handleMsg);
        this.addCommand('Мои заявки', this.handleSiteUser);
        this.addCommand('/replyReq', this.ReplyToUser);
        this.bot.setMyCommands(comandBot)
    }

    addCommand(command, handler) {
        this.commandMap.set(command, handler);
    }

    async handleStart(msg) {
        const chatId = msg.chat.id;
        await this.bot.sendMessage(chatId, `Привет, ${msg.from.first_name}!`);
        await dbManager.createUserWithRole(`${chatId}`, `${msg.from.first_name}`, `User`)
    }

    async handleMsg(msg) {
        const chatId = msg.chat.id;
        await this.bot.sendMessage(chatId, ` ${msg.chat.id}`);
        await console.log(msg)
    }


    async handle123(msg) {
        const chatId = msg.chat.id;
        await this.bot.sendMessage(chatId, 'menuMain', menuMain);
    }

    async handleSiteUser(msg) {
        const chatId = msg.chat.id;
        await this.bot.sendMessage(chatId, `Ваши заявки`, menuSite);
    }
    async handleMenu(msg) {
        const chatId = msg.chat.id;
        await this.bot.sendMessage(chatId, `Меню бота`, menuKeyboard);
    }


    async handleCloseMenu(msg) {
        const chatId = msg.chat.id;
        await this.bot.sendMessage(chatId, `Меню закрыто`, menuKeyboardRemove);
    }


    async handleMessage(msg) {
        const text = msg.text;
        const chatId = msg.chat.id;
        const handler = this.commandMap.get(text);
        if (handler) {
            await handler.call(this, msg);
        }
    }

    async ReplyToUser(msg) {
        const userRequestIdRegex = /\/replyReq (\d+)/;
        const match = msg.text.match(userRequestIdRegex);

        if (match) {
            const userRequestId = match[1];

            try {
                const userRequest = await this.dbManager.findReq(userRequestId);

                if (!userRequest) {
                    this.bot.sendMessage(msg.chat.id, 'Заявка не найдена.');
                    return;
                }

                await this.bot.sendMessage(msg.chat.id, 'Введите введите сообщение:');

                const reply = await new Promise((resolve) => {
                    this.bot.once('text', (response) => resolve(response));
                });

                await this.dbManager.replyToUser(userRequestId, reply);

                const userTelegramId = await this.dbManager.findUserToReq(userRequestId);
                if (userTelegramId) {
                    this.bot.sendMessage(userTelegramId, `Новый ответ на вашу заявку: ${reply}`);
                }

                this.bot.sendMessage(msg.chat.id, 'Ответ успешно добавлен.');
            } catch (error) {
                console.error('Ошибка при ответе на заявку:', error);
                this.bot.sendMessage(msg.chat.id, 'Произошла ошибка при ответе на заявку.');
            }
        }
    }

    async handleCreateRequest(msg) {
        try {
            const chatId = msg.chat.id;

            await this.bot.sendMessage(chatId, 'Введите категорию заявки:');

            const categoryResponse = await new Promise((resolve) => {
                this.bot.once('text', (response) => resolve(response));
            });

            await this.bot.sendMessage(chatId, 'Введите описание вашей заявки:');

            const descriptionResponse = await new Promise((resolve) => {
                this.bot.once('text', (response) => resolve(response));
            });

            const description = descriptionResponse.text;


            const category = categoryResponse.text;

            await dbManager.createUserRequest(`${msg.from.id}`, 'ожидает ответа оператора', description, category);

            await this.bot.sendMessage(chatId, 'Заявка успешно создана!');
        } catch (error) {
            console.error('Ошибка при создании заявки:', error.message);
            await this.bot.sendMessage(msg.chat.id, 'Произошла ошибка при создании заявки.');
        }
    }
}

class callbackAnswer {
    constructor(bot) {
        this.bot = bot;
        this.callbackMap = new Map();

        this.addCallback('/left', this.handleLeft);
        this.addCallback('/delete', this.handleDelete);
        this.addCallback('/back', this.handleBack);
        this.addCallback('/web', this.handleSiteUser);
    }
    addCallback(callback, handler) {
        this.callbackMap.set(callback, handler);
    }

    async handleDelete(msg) {
        const messageId = msg.message.message_id;
        const chatId = msg.message.chat.id;
        this.bot.deleteMessage(chatId, messageId)
    }

    async handleLeft(msg) {
        const chatId = msg.message.chat.id;
        this.handleDelete(msg)
        this.bot.sendMessage(chatId, 'menuSecond ', menuSecond)
    }
    async handleSiteUser(msg) {
        const chatId = msg.chat.id;
        await this.bot.sendMessage(chatId, `Ваши заявки`, menuSite);
        console.log(`erorr`)
    }

    async handleBack(msg) {
        const chatId = msg.message.chat.id;
        this.handleDelete(msg)
        this.bot.sendMessage(chatId, 'menuMain', menuMain)
    }

    async handleMessage(msg) {
        const data = msg.data;
        const handler = this.callbackMap.get(data);
        if (handler) {
            await handler.call(this, msg);
        }
    }

}
module.exports = { commandAndAnswer, callbackAnswer };