require('dotenv').config();
const multer = require('multer');
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const appUrl = process.env.WEB_APP_URL;
const sequelize = require('./src/BaseData/bdConnect');
const DatabaseService = require(`./src/BaseData/bdService`)
const { commandAndAnswer, callbackAnswer } = require('./src/BotService/botService');
require('./src/BaseData/bdModel');
const dbManager = new DatabaseService(sequelize)
const cors = require('cors');

const commandHandler = new commandAndAnswer(bot);
const callbackHandler = new callbackAnswer(bot);

const express = require('express');
const bodyParser = require('body-parser');
const { User, UserRequest, Message, Role, Media, MessageChat, OperatorReq } = require('./src/BaseData/bdModel');
const { where } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 3000;
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


app.post('/upload', upload.array('files', 5), async (req, res) => {
  try {
      const files = req.files;


      const chatId = '393448227';

      const apiUrl = `https://api.telegram.org/bot${token}/sendDocument`;

      for (const file of files) {
          const formData = new FormData();
          formData.append('chat_id', chatId);
          formData.append('document', file.buffer, { filename: file.originalname });

          await axios.post(apiUrl, formData, {
              headers: {
                  'Content-Type': 'multipart/form-data',
              },
          });
      }

      res.send('Файлы успешно отправлены в бота Telegram!');
  } catch (error) {
      console.error('Ошибка при отправке файлов в бота Telegram:', error);
      res.status(500).send('Произошла ошибка при отправке файлов в бота Telegram');
  }
});



app.get('/messagesChat', async (req, res) => {
  try {
    const users = await MessageChat.findAll();
    res.json(users);
  } catch (e) {
    console.log(e)
  }
})


app.get('/messages', async (req, res) => {
  try {
    const users = await Message.findAll();
    res.json(users);
  } catch (e) {
    console.log(e)
  }
});

app.get('/test/:id', async (req, res) => {
  try {
    const requestId = req.params.id;
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
    res.json(messages);
  } catch (e) {
    console.log(e)
  }
})


const waitingUsers = {};
app.post(`/replyToOperator`, async (req, res) => {
  const { queryId, userRequestId, username, userId, operatorId } = req.body;
  const userWebId = operatorId;

  try {
    const user = await User.findByPk(userId);
    const userRequest = await dbManager.findReq(userRequestId);

    if (!userRequest) {
      bot.sendMessage(userWebId, 'Заявка не найдена.');
      return res.status(400).json({ error: 'Заявка не найдена.' });
    }

    waitingUsers[userWebId] = true;

    await bot.sendMessage(userWebId, 'Введите сообщение:');

    const reply = await new Promise((resolve) => {
      const textHandler = (msg) => {
        const userId = msg.from.id;
        if (userId === userWebId && waitingUsers[userWebId]) {
          waitingUsers[userWebId] = false;
          bot.off('text', textHandler);
          resolve(msg);
        }
      };


      bot.on('text', textHandler);
    });

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

    bot.sendMessage(userWebId, 'Ответ успешно добавлен.');
    const timeData = new Date();
    const year = timeData.getFullYear();
    const month = timeData.getMonth() + 1; // Месяцы в JavaScript начинаются с 0
    const day = timeData.getDate();
    timeData.setHours(timeData.getHours() + 4); // добавляем 4 часа
    const hours = timeData.getHours();
    const minutes = timeData.getMinutes();
    const formattedHours = hours < 10 ? '0' + hours : hours;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

    const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}.`
    await dbManager.createUserRequestMessage(userRequestId, reply.text, operatorId, 'User', username, timeMess);

    await bot.sendMessage(messages[0].operatorId, 'Пришел ответ от пользователя', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Пришел ответ от пользователя', web_app: { url: appUrl + `/InlinerequestsOperator/${userRequestId}` } }]
        ]
      }
    });

    return res.status(200).json({});
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

app.post('/closeReq', async (req, res) => {
  const { queryId, userRequestId, username, userId, operatorId } = req.body;
  const userWebId = operatorId;
  try {
    const status = 'Заявка в обработке!';
    await dbManager.changeStatusRes(userRequestId, status);
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
    if (userWebId === messages[0].UserRequest.User.telegramId) {
      bot.sendMessage(userWebId, 'Вы закрыли заявку!');
      await bot.sendMessage(messages[0].operatorId, `Пользователь закрыл заявку №${userRequestId}!`);
    } else {
      bot.sendMessage(userId, 'Вы закрыли заявку!');
      bot.sendMessage(messages[0].UserRequest.User.telegramId, `Оператор закрыл вашу заявку №${userRequestId}!`)
    }
  } catch (e) {
    console.log(e)
  }
})

app.post(`/replyToUser`, async (req, res) => {
  const { queryId, userRequestId, username, userId, operatorId } = req.body;
  const requestId = userRequestId;
  const userWebId = operatorId;
  try {
    const userRequest = await dbManager.findReq(userRequestId);
    const user = await User.findByPk(userId);
    if (!userRequest) {
      bot.sendMessage(operatorId, 'Заявка не найдена.');
      return;
    }

    waitingUsers[userWebId] = true;

    await bot.sendMessage(userWebId, 'Введите сообщение:');

    const reply = await new Promise((resolve) => {
      const textHandler = (msg) => {
        const userId = msg.from.id;
        if (userId === userWebId && waitingUsers[userWebId]) {
          waitingUsers[userWebId] = false;
          bot.off('text', textHandler);
          resolve(msg);
        }
      };


      bot.on('text', textHandler);
    });
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
    timeData.setHours(timeData.getHours() + 4); // добавляем 4 часа
    const hours = timeData.getHours();
    const minutes = timeData.getMinutes();
    const formattedHours = hours < 10 ? '0' + hours : hours;
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

    const timeMess = `${formattedHours}:${formattedMinutes}`;

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


    bot.sendMessage(messages[0].UserRequest.User.telegramId, 'Вам пришел ответ на вашу заявку', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Ваша Заявка', web_app: { url: appUrl + `/Inlinerequests/${userRequestId}` } }]
        ]
      }
    });
    bot.sendMessage(operatorId, 'Ответ успешно добавлен.');
  } catch (error) {
    console.error('Ошибка при ответе на заявку:', error);
    console.log(error);
  }
});




app.post('/handleShowPhoto', async (req, res) => {
  const { queryId, userRequestId, username, idMedia, operatorId } = req.body;
  try {
    const med = await Media.findByPk(idMedia);
    if (med) {
      bot.sendPhoto(operatorId, med.idMedia);
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.log(error)
  }
});




const createMediaRecord = async (userRequestId, idMedia) => {
  try {
    const userRequest = await UserRequest.findByPk(userRequestId);

    if (!userRequest) {
      console.error('Заявка не найдена.');
      return;
    }

    // Создаем запись в таблице Media
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

app.post(`/replyToOperatorPhoto`, async (req, res) => {
  const { queryId, userRequestId, username } = req.body;
  try {
    await bot.answerWebAppQuery(queryId, {
      type: 'article',
      id: queryId,
      title: 'ResOp',
      input_message_content: {
        message_text: `/resToOperatorPhoto ${userRequestId}`
      }
    })
    return res.status(200).json({});
  } catch (e) {
    return res.status(500).json({})
  }
})

app.post(`/resToUserPhoto`, async (req, res) => {
  const { queryId, userRequestId, username } = req.body;
  try {
    await bot.answerWebAppQuery(queryId, {
      type: 'article',
      id: queryId,
      title: 'ResOp',
      input_message_content: {
        message_text: `/resToUserPhoto ${userRequestId}`
      }
    })
    return res.status(200).json({});
  } catch (e) {
    return res.status(500).json({})
  }
})


app.get('/photo', async (req, res) => {
  try {
    const media = await Media.findAll();
    res.json(media);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/mestest', async (req, res) => {
  try {
    const chat = await MessageChat.findAll();
    res.json(chat);
  } catch (e) {
    console.log(e)
  }
})

app.get('/photo/:id', async (req, res) => {
  try {
    const userRequest = req.params.id;
    const media = await Media.findAll({
      where: { UserRequestId: userRequest }
    });
    res.json(media);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})


app.get('/reqPhoto/:id', async (req, res) => {
  try {
    const requestId = req.params.id;
    const media = await Media.findAll({
      where: { UserRequestId: requestId },
    });

    const formattedPhoto = media.map(med => ({
      id: med.id,
      idMedia: med.idMedia,
      UserRequestId: med.UserRequestId,
    }));
    res.json(formattedPhoto);
  } catch (error) {
    console.error('Ошибка при получении фото:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
})



app.get('/users', async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/chat', async (req, res) => {
  try {
    const chat = await MessageChat.findAll();
    const formattedChat = chat.map(chatMes => ({
      id: chatMes.id,
      textMessage: chatMes.textMessage,
      idUser: chatMes.idUser,
      roleUser: chatMes.roleUser,
      UserRequestId: chatMes.UserRequestId,
      Time: chatMes.TimeMessages,
    }));
    res.json(formattedChat);
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/chat/:id', async (req, res) => {
  try {
    const userRequestId = parseInt(req.params.id, 10);
    const chat = await MessageChat.findAll({ where: { UserRequestId: userRequestId } });
    const formattedChat = chat.map(chatMes => ({
      id: chatMes.id,
      textMessage: chatMes.textMessage,
      idUser: chatMes.idUser,
      roleUser: chatMes.roleUser,
      UserRequestId: chatMes.UserRequestId,
      IdMedia: chatMes.IdMedia,
      username: chatMes.username,
      Time: chatMes.TimeMessages,
    }));
    res.json(formattedChat);
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/req', async (req, res) => {
  try {
    const stat = 'ожидает ответа оператора'
    const usersReq = await UserRequest.findAll({
      where: { status: stat },
      include: User,
      order: [['id', 'ASC']],
    });
    const formattedUserRequests = usersReq.map(userRequest => ({
      id: userRequest.id,
      status: userRequest.status,
      messageReq: userRequest.messageReq,
      username: userRequest.User ? userRequest.User.username : null,
      category: userRequest.category
    }));
    res.json(formattedUserRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/reqOperator/:id', async (req, res) => {
  try {
    const userRequestId = parseInt(req.params.id, 10);
    // const stat = 'ожидает ответа оператора'
    const usersReq = await UserRequest.findAll({
      where: {
        // status: stat,
        IdUser: userRequestId
      },
      include: [
        { model: User },
        { model: OperatorReq }
      ],
      order: [['id', 'ASC']],
    });

    const formattedUserRequests = usersReq.map(userRequest => ({
      id: userRequest.id,
      status: userRequest.status,
      messageReq: userRequest.messageReq,
      username: userRequest.User ? userRequest.User.username : null,
      category: userRequest.category,
      IdUser: userRequest.IdUser,
      IdUserRequest: userRequest.IdUserRequest
    }));

    res.json(formattedUserRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/adminList', async (req, res) => {
  try {
    const users = await User.findAll({
      where: { RoleId: 2 },
      order: [['id', 'ASC']],
    });
    const formattedUserRequests = users.map(userRequest => ({
      id: userRequest.id,
      telegramId: userRequest.telegramId,
      username: userRequest.username,
      RoleId: userRequest.RoleId,
    }));
    res.json(formattedUserRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/adminListOperator', async (req, res) => {
  try {
    const users = await User.findAll({
      where: { RoleId: 3 },
      order: [['id', 'ASC']],
    });
    const formattedUserRequests = users.map(userRequest => ({
      id: userRequest.id,
      telegramId: userRequest.telegramId,
      username: userRequest.username,
      RoleId: userRequest.RoleId,
    }));
    res.json(formattedUserRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/adminFullList', async (req, res) => {
  try {
    const users = await User.findAll({
      order: [['id', 'ASC']],
    });
    const formattedUserRequests = users.map(userRequest => ({
      id: userRequest.id,
      telegramId: userRequest.telegramId,
      username: userRequest.username,
      RoleId: userRequest.RoleId,
    }));
    res.json(formattedUserRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/req/:id', async (req, res) => {
  try {
    const userRequestId = req.params.id;
    const usersReq = await UserRequest.findAll({
      where: { id: userRequestId },
      include: User,
    });
    const formattedUserRequests = usersReq.map(userRequest => ({
      id: userRequest.id,
      status: userRequest.status,
      desc: userRequest.messageReq,
      username: userRequest.User ? userRequest.User.username : null
    }));
    res.json(formattedUserRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/reqUser/:id', async (req, res) => {
  try {
    const userRequestId = req.params.id;

    const user = await User.findOne({
      where: { telegramId: userRequestId },
      include: {
        model: UserRequest,
        order: [['id', 'ASC']],
        separate: true,
      },
    });



    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userRequests = user.UserRequests.map(userRequest => ({
      id: userRequest.id,
      status: userRequest.status,
      messageReq: userRequest.messageReq,
      username: userRequest.username,
      category: userRequest.category
    }));

    const formattedUser = {
      id: user.id,
      username: user.username,
      address: user.address,
      userRequests: userRequests,
    };

    res.json(formattedUser.userRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/asd', async (req, res) => {
  try {
    const asd = await UserRequest.findAll()
    res.json(asd);
  } catch (e) {

  }
})

app.get('/mes', async (req, res) => {
  try {
    const messages = await Message.findAll({
      include: [
        {
          model: UserRequest,
          include: [
            {
              model: User,
              attributes: ['username']
            }
          ]
        }
      ],
      order: [['id', 'ASC']]
    });

    const formattedMessages = messages.map(message => ({
      userRequestId: message.UserRequest.id,
      status: message.UserRequest.status,
      messageReq: message.UserRequest.messageReq,
      username: message.UserRequest.User ? message.UserRequest.User.username : null,
      address: message.UserRequest.address,
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//asdas

app.get('/mes/:userRequestId', async (req, res) => {
  try {
    const userRequestId = req.params.userRequestId;

    const messages = await Message.findAll({
      include: [
        {
          model: UserRequest,
          where: { id: userRequestId },
          include: [
            {
              model: User,
              attributes: ['username', 'address']

            },
          ]
        }
      ]
    });

    const formattedMessages = messages.map(message => ({
      userRequestId: message.UserRequest.id,
      status: message.UserRequest.status,
      description: message.UserRequest.messageReq,
      subject: message.UserRequest.category,
      username: message.UserRequest.User ? message.UserRequest.User.username : null,
      address: message.UserRequest.address ? message.UserRequest.address : null,
      userId: message.UserRequest.UserId
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



const connectToDatabase = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.log('Подключение к БД успешно');
    const userrole = dbManager.changeRoleUser(1, 3)
    app.listen(PORT, () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });

  } catch (e) {
    console.log('Подключение к БД сломалось', e);
  }
};

const createRoles = async () => {
  try {
    await Role.findOrCreate({ where: { name: 'Admin' } });
    await Role.findOrCreate({ where: { name: 'User' } });
    await Role.findOrCreate({ where: { name: 'Operator' } });
  } catch (error) {
    console.error(error);
  }
};


const startBot = async () => {
  await connectToDatabase();
  await createRoles();
  // MessageChat.sync({ force: true })
  //   .then(() => {
  //     console.log('Таблица успешно пересоздана.');
  //   })
  //   .catch((error) => {
  //     console.error('Ошибка при пересоздании таблицы:', error);
  //   });

  bot.on(/\/site123/, async(msg)=>{
    const chatId = msg.from.id;
    await bot.sendMessage(chatId, 'asdasdasd', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Пришел', web_app: { url: appUrl + `/InlineFormReq` } }]
        ]
      }
    });
  })
  bot.onText(/\/closeReq (\d+)/, async (msg, match) => {
    const userId = msg.from.id;
    const requestId = match[1];

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
        bot.sendMessage(userId, `Вы закрыли заявку №${requestId} !`);
        await bot.sendMessage(messages[0].operatorId, `Пользователь закрыл заявку №${requestId} !`);
      } else {
        bot.sendMessage(userId, `Вы закрыли заявку №${requestId} !`);
        bot.sendMessage(messages[0].UserRequest.User.telegramId, `Оператор закрыл вашу заявку №${requestId} !`)
      }
    } catch (e) {
      console.log(e)
    }
  })

  bot.onText(/\/resToUser (\d+)/, async (msg, match) => {
    const userId = msg.from.id;
    const requestId = match[1];

    try {
      const userRequest = await dbManager.findReq(requestId);
      if (!userRequest) {
        bot.sendMessage(userId, 'Заявка не найдена.');
        return;
      }

      waitingUsers[userId] = true;

      await bot.sendMessage(userId, 'Введите сообщение:');

      const textHandler = async (response) => {
        if (userId === response.from.id && waitingUsers[userId]) {
          waitingUsers[userId] = false;
          bot.off('text', textHandler);
          const reply = response.text;

          const timeData = new Date();
          const year = timeData.getFullYear();
          const month = timeData.getMonth() + 1; // Месяцы в JavaScript начинаются с 0
          const day = timeData.getDate();
          timeData.setHours(timeData.getHours() + 4); // добавляем 4 часа
          const hours = timeData.getHours();
          const minutes = timeData.getMinutes();
          const formattedHours = hours < 10 ? '0' + hours : hours;
          const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

          const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}.`

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

          bot.sendMessage(messages[0].UserRequest.User.telegramId, 'Вам пришел ответ на вашу заявку', {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Ваша Заявка', web_app: { url: appUrl + `/Inlinerequests/${requestId}` } }]
              ]
            }
          });

          bot.sendMessage(userId, 'Ответ успешно добавлен.');
        }
      };

      bot.on('text', textHandler);
    } catch (error) {
      console.error('Ошибка при ответе на заявку:', error);
      bot.sendMessage(userId, 'Произошла ошибка при ответе на заявку.');
    }
  });



  bot.onText(/\/resToOperatorPhoto (\d+)/, async (msg, match) => {
    const userRequestId = match[1];
    const userId = msg.from.id;
    const userName = msg.from.first_name
    try {
      await bot.sendMessage(msg.chat.id, 'Прикрепите файл:');

      waitingUsers[userId] = true;
      const textHandler = async (response) => {
        if (userId === response.from.id && waitingUsers[userId]) {
          waitingUsers[userId] = false;
          bot.off('photo', textHandler);
          const reply = response;

          if (!reply || !reply.photo || !reply.photo[0]) {
            throw new Error('Не удалось получить фотографию.');
          }

          const photo = reply.photo[0];
          const fileId = photo.file_id;
          const mediaRecord = await createMediaRecord(userRequestId, fileId);
          const timeData = new Date();
          const year = timeData.getFullYear();
          const month = timeData.getMonth() + 1; // Месяцы в JavaScript начинаются с 0
          const day = timeData.getDate();
          timeData.setHours(timeData.getHours() + 4); // добавляем 4 часа
          const hours = timeData.getHours();
          const minutes = timeData.getMinutes();
          const formattedHours = hours < 10 ? '0' + hours : hours;
          const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
      
          const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}.`

          const mediaChat = await MessageChat.create({
            IdMedia: mediaRecord.id,
            roleUser: 'User',
            username: userName,
            UserRequestId: userRequestId,
            TimeMessages:timeMess,
          })

          await bot.sendMessage(msg.chat.id, `Файл успешно добавлен к заявке №${userRequestId}`);
        }
      };
      bot.on('photo', textHandler);
    } catch (error) {
      console.error('Ошибка при обработке команды /resToOperatorPhoto:', error);
    }
  });

  bot.onText(/\/resToUserPhoto (\d+)/, async (msg, match) => {
    const userRequestId = match[1];
    const userId = msg.from.id;
    const userName = msg.from.first_name
    try {
      await bot.sendMessage(msg.chat.id, 'Прикрепите файл:');

      waitingUsers[userId] = true;
      const textHandler = async (response) => {
        if (userId === response.from.id && waitingUsers[userId]) {
          waitingUsers[userId] = false;
          bot.off('photo', textHandler);
          const reply = response;

          if (!reply || !reply.photo || !reply.photo[0]) {
            throw new Error('Не удалось получить фотографию.');
          }

          const photo = reply.photo[0];
          const fileId = reply.photo[0].file_id;
          const mediaRecord = await createMediaRecord(userRequestId, fileId);

          const timeData = new Date();
          const year = timeData.getFullYear();
          const month = timeData.getMonth() + 1; // Месяцы в JavaScript начинаются с 0
          const day = timeData.getDate();
          timeData.setHours(timeData.getHours() + 4); // добавляем 4 часа
          const hours = timeData.getHours();
          const minutes = timeData.getMinutes();
          const formattedHours = hours < 10 ? '0' + hours : hours;
          const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
      
          const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}.`

          await MessageChat.create({
            IdMedia: mediaRecord.id,
            roleUser: 'Operator',
            username: 'Оператор',
            UserRequestId: userRequestId,
            TimeMessages:timeMess,
          })

          await bot.sendMessage(msg.chat.id, `Файл успешно добавлен к заявке №${userRequestId}`);
        }
      };
      bot.on('photo', textHandler);
    } catch (error) {
      console.error('Ошибка при обработке команды /resToOperatorPhoto:', error);
    }
  });





  bot.onText(/\/handleShowPhoto (\d+)/, async (msg, match) => {
    const idMed = match[1];

    try {
      const med = await Media.findByPk(idMed);
      if (med) {
        bot.sendPhoto(msg.chat.id, med.idMedia);
      }
    } catch (e) {

    }
  });



  bot.onText(/\/resToOperator (\d+)/, async (msg, match) => {
    const userRequestId = match[1];
    const userId = msg.from.id;
    const username = msg.from.first_name

    try {
      const userRequest = await dbManager.findReq(userRequestId);
      if (!userRequest) {
        bot.sendMessage(userId, 'Заявка не найдена.');
        return;
      }

      waitingUsers[userId] = true;

      await bot.sendMessage(userId, 'Введите сообщение:');

      const textHandler = async (response) => {
        if (userId === response.from.id && waitingUsers[userId]) {
          waitingUsers[userId] = false;
          bot.off('text', textHandler);
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

          const timeData = new Date();
          const year = timeData.getFullYear();
          const month = timeData.getMonth() + 1; // Месяцы в JavaScript начинаются с 0
          const day = timeData.getDate();
          timeData.setHours(timeData.getHours() + 4); // добавляем 4 часа
          const hours = timeData.getHours();
          const minutes = timeData.getMinutes();
          const formattedHours = hours < 10 ? '0' + hours : hours;
          const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
      
          const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}.`

          await dbManager.createUserRequestMessage(userRequestId, reply, userId, 'User', username, timeMess);

          await bot.sendMessage(messages[0].operatorId, 'Пришел ответ от пользователя', {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Пришел ответ от пользователя', web_app: { url: appUrl + `/InlinerequestsOperator/${userRequestId}` } }]
              ]
            }
          });
          bot.sendMessage(userId, 'Ответ успешно добавлен.');
        }
      };

      bot.on('text', textHandler);

    } catch (error) {
      console.log(error);
    }
  });

  // bot.onText(/\/asd (\d+)/,async(msg,math) =>{
  //   try{
  //     const userId = msg.from.id;

  //   }catch(e){
  //     console.log(e)
  //   }
  // });

  bot.onText('Изменить роль пользователю на админа', async (msg, match) => {
    try {
      const userId = msg.from.id;
      waitingUsers[userId] = true;

      await bot.sendMessage(userId, 'Введите ID-телеграма пользователя:');
      const textHandler = async (response) => {
        if (userId === response.from.id && waitingUsers[userId]) {
          waitingUsers[userId] = false;
          bot.off('text', textHandler);
          const reply = response.text;

          if (!isNaN(reply)) {
            const chRole = dbManager.changeRoleUser(reply, 3)
            await bot.sendMessage(reply, 'Роль изменена');
            bot.sendMessage(userId, 'Изменение прошло успешно.');
          } else {
            bot.sendMessage(userId, 'Ошибка: Введенное значение не соответствует ожидаемому формату ID-телеграма. Пожалуйста, введите корректный ID пользователя.');
          }
        }
      };

      bot.on('text', textHandler);
    } catch (e) {
      console.log(e)
    }
  });


  bot.on('callback_query', async (msg) => {
    await callbackHandler.handleMessage(msg);


  });

  bot.on('message', async (msg) => {
    if (msg?.web_app_data?.data) {
      const datares = msg
      datares.text = msg?.web_app_data?.data
    }
    console.log(msg)
    const chatId = msg.chat.id
    if (msg.text === 'Изменить роль пользователю на админа') {
      try {
        const userId = msg.from.id;
        waitingUsers[userId] = true;

        await bot.sendMessage(userId, 'Введите ID-телеграма пользователя:');
        const textHandler = async (response) => {
          if (userId === response.from.id && waitingUsers[userId]) {
            waitingUsers[userId] = false;
            bot.off('text', textHandler);
            const reply = response.text;

            // Проверка, является ли введенное значение числом
            if (!isNaN(reply)) {
              const chRole = dbManager.changeRoleUser(reply, 3)
              await bot.sendMessage(reply, 'Вам присвоена роль "Администратор"');
              bot.sendMessage(userId, 'Роль пользователя успешно изменена.');
            } else {
              // Если введенное значение не является числом, сообщаем об ошибке
              bot.sendMessage(userId, 'Ошибка: Введите, пожалуйста, корректный ID-телеграма пользователя.');
            }
          }
        };

        bot.on('text', textHandler);
      } catch (e) {
        console.log(e);
      }
    }

    try {
      if (msg?.web_app_data?.data) {
        try {
          const data = JSON.parse(msg?.web_app_data?.data);
          if (data.address) {
            const createdRequest = await dbManager.createUserRequest(`${msg.from.id}`, 'ожидает ответа оператора', data.description, data.category, data.address);
            const createdRequestId = createdRequest.dataValues.id
            await bot.sendMessage(chatId, 'Заявка успешно создана!');
            const message = `Создана новая заявка под номером ${createdRequestId}`
            await commandHandler.sendMessagesToUsersWithRoleId(message, createdRequestId)
          }
        }
        catch (e) {
          console.log(e)
        }
      }
    } catch (e) {
      console.log(e)
    }
    await commandHandler.handleMessage(msg);
  });


};

startBot();

