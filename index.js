require('dotenv').config();
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
const { User, UserRequest, Message, Role, Media, MessageChat } = require('./src/BaseData/bdModel');
const { where } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());



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

app.post('/test', async (req, res) => {
  console.log(req.body);
  console.log(`OK`);
  res.status(200).send('OK');
})

// app.post(`/replyToUser`, async (req, res) => {
//   const { queryId, userRequestId, username } = req.body;
//   try {
//     await bot.answerWebAppQuery(queryId, {
//       type: 'article',
//       id: queryId,
//       title: 'ResUs',
//       input_message_content: {
//         message_text: `/resToUser ${userRequestId}`
//       }
//     })
//     res.status(200).send('OK');
//   } catch (e) {
//     res.status(500).send('NO')
//   }
// })

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

    // Устанавливаем флаг "ожидание ответа" только если он еще не установлен
    if (!waitingUsers[userWebId]) {
      waitingUsers[userWebId] = true;

      // Отправляем сообщение с запросом ответа
      await bot.sendMessage(operatorId, 'Введите сообщение:');

      // Ожидаем ответ от оператора
      const reply = await new Promise((resolve) => {
        const textHandler = (msg) => {
          const userId = msg.from.id;
          if (userId === userWebId && waitingUsers[userWebId]) {
            // Сбрасываем флаг "ожидание ответа"
            waitingUsers[userWebId] = false;
            // Удаляем обработчик, чтобы не ловить лишние сообщения
            bot.off('text', textHandler);
            resolve(msg);
          }
        };

        // Включаем обработчик текстовых сообщений
        bot.on('text', textHandler);
      });

      // Далее ваш код для обработки ответа и отправки сообщений
      await dbManager.replyToUser(userRequestId, reply.text, operatorId);

      const userRequestStatus = await UserRequest.findByPk(requestId);
      if (userRequestStatus.status === 'ожидает ответа оператора') {
        const status = 'Заявка в обработке!';
        await dbManager.changeStatusRes(requestId, status);
        const message = `Заявка под номером ${requestId} в обработке`;
        await commandHandler.sendMessagesToUsersWithRoleId(message, requestId);
      }

      await dbManager.createUserRequestMessage(userRequestId, reply.text, operatorId, 'Operator');

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
    }
  } catch (error) {
    console.error('Ошибка при ответе на заявку:', error);
    console.log(error);
    bot.sendMessage(operatorId, 'Произошла ошибка при обработке вашего ответа.');
  }
});







app.post('/handleShowPhoto', async (req, res) => {
  const { queryId, userRequestId, username, idMedia } = req.body;
  try {
    await bot.answerWebAppQuery(queryId, {
      type: 'article',
      id: queryId,
      title: 'ResOp',
      input_message_content: {
        message_text: `/handleShowPhoto ${idMedia}`
      }
    })
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Ошибка при обработке запроса:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

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

    // Устанавливаем состояние "ожидание ответа" для пользователя
    waitingUsers[userWebId] = true;

    // Отправляем сообщение с запросом ответа
    await bot.sendMessage(userWebId, 'Введите сообщение:');

    // Ожидаем ответ от пользователя
    const reply = await new Promise((resolve) => {
      // Обработчик для текстового сообщения
      const textHandler = (msg) => {
        const userId = msg.from.id;
        if (userId === userWebId && waitingUsers[userWebId]) {
          // Очищаем состояние "ожидание ответа" для пользователя
          waitingUsers[userWebId] = false;
          // Удаляем обработчик, чтобы не ловить лишние сообщения
          bot.off('text', textHandler);
          resolve(msg);
        }
      };

      // Включаем обработчик текстовых сообщений
      bot.on('text', textHandler);
    });

    // Дальнейший код для обработки ответа и отправки сообщений
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

    await dbManager.createUserRequestMessage(userRequestId, reply.text, operatorId, 'User');

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


app.get('/photo', async (req, res) => {
  try {
    const media = await Media.findAll();
    res.json(media);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

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
      // where: { status: stat },
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
      text: message.text,
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
      dialog: message.text,
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
  //
  bot.onText(/\/resToUser (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const requestId = match[1];
    const userRequestId = match[1];

    try {
      const userRequest = await dbManager.findReq(userRequestId);

      if (!userRequest) {
        bot.sendMessage(msg.chat.id, 'Заявка не найдена.');
        return;
      }

      await bot.sendMessage(msg.chat.id, 'Введите сообщение:');
      const reply = await new Promise((resolve) => {
        bot.once('text', (response) => resolve(response));
      });
      await dbManager.replyToUser(userRequestId, reply.text, msg.chat.id);
      const userRequestStatus = await UserRequest.findByPk(requestId);
      if (userRequestStatus.status === 'ожидает ответа оператора') {
        // await dbManager.replyToUser(userRequestId, reply.text, msg.chat.id);
        const status = 'Заявка в обработке!';
        await dbManager.changeStatusRes(requestId, status);
        const message = `Заявка под номером ${requestId} в обработке`
        await commandHandler.sendMessagesToUsersWithRoleId(message, requestId);
      }

      const userTelegramId = await dbManager.findUserToReq(userRequestId);

      // if (userTelegramId) {
      //   bot.sendMessage(userTelegramId, `Новый ответ на вашу заявку: ${reply}`);
      // }
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
      bot.sendMessage(msg.chat.id, 'Ответ успешно добавлен.');
    } catch (error) {
      console.error('Ошибка при ответе на заявку:', error);
      bot.sendMessage(msg.chat.id, 'Произошла ошибка при ответе на заявку.');
    }
  });

  bot.onText(/\/resToOperatorPhoto (\d+)/, async (msg, match) => {
    const userRequestId = match[1];
    try {
      await bot.sendMessage(msg.chat.id, 'Отправте фото:');
      const reply = await new Promise((resolve) => {
        bot.once('photo', (response) => resolve(response));
      });

      if (!reply || !reply.photo || !reply.photo[0]) {
        throw new Error('Не удалось получить фотографию.');
      }

      const photo = reply.photo[0];
      const fileId = photo.file_id;

      await createMediaRecord(userRequestId, fileId);
      await bot.sendMessage(msg.chat.id, 'Фото успешно добавлено.');
    } catch (error) {
      console.error('Ошибка при обработке команды /resToOperatorPhoto:', error);
    }
  });



  bot.onText(/\/handleShowPhoto (\d+)/, async (msg, match) => {
    const idMed = match[1];
    // try {
    //   const chatId = msg.chat.id;
    //   bot.sendPhoto(chatId, idMedia);
    // } catch (error) {
    //   console.error('Ошибка при обработке команды /resToOperatorPhoto:', error);
    // }
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

    try {
      const userRequest = await dbManager.findReq(userRequestId);
      if (!userRequest) {
        bot.sendMessage(msg.chat.id, 'Заявка не найдена.');
        return;
      }
      await bot.sendMessage(msg.chat.id, 'Введите сообщение:');
      const reply = await new Promise((resolve) => {
        bot.once('text', (response) => resolve(response));
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
      // await console.log(messages[0].operatorId)
      await dbManager.replyToOperator(userRequestId, reply.text, messages);

      await bot.sendMessage(messages[0].operatorId, 'Пришел ответ от пользователя', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Пришел ответ от пользователя', web_app: { url: appUrl + `/InlinerequestsOperator/${userRequestId}` } }]
          ]
        }
      });

    } catch (error) {


    }
  });

  bot.on('callback_query', async (msg) => {
    await callbackHandler.handleMessage(msg);
    console.log(msg)
    console.log('Подключение к бд установлено');
  });
  bot.on('message', async (msg) => {
    if (msg?.web_app_data?.data) {
      const datares = msg
      datares.text = msg?.web_app_data?.data
    }
    console.log(msg)
    const chatId = msg.chat.id
    if (msg?.web_app_data?.data) {
      try {

        const data = JSON.parse(msg?.web_app_data?.data);
        if (data.address) {
          await bot.sendMessage(chatId, `${data.address}`)
          const createdRequest = await dbManager.createUserRequest(`${msg.from.id}`, 'ожидает ответа оператора', data.description, data.category, data.address);
          const createdRequestId = createdRequest.dataValues.id
          await bot.sendMessage(chatId, 'Заявка успешно создана!');
          const message = `Создана новая заявка под номером ${createdRequestId}`
          await commandHandler.sendMessagesToUsersWithRoleId(message, createdRequestId)
        } else {

        }
        // await bot.sendMessage(chatId, `${data.userj}`)
      }
      catch (e) {
        console.log(e)
      }
    }
    await commandHandler.handleMessage(msg);
  });
  // bot.on('photo', (msg) => {
  //   try {
  //     // const media = msg.media_group_id
  //     const chatId = msg.chat.id;
  //     const photo = msg.photo[0]; 
  //     const fileId = photo.file_id;
  //     const media = msg.photo.map(photo => ({ type: 'photo', media: photo.file_id }));
  //     bot.sendMediaGroup(chatId, media);
  //     // bot.sendPhoto(chatId, fileId);
  //     console.log(fileId)
  //     // bot.sendMediaGroup(chatId,media)
  //   } catch (e) {

  //   }
  // });
  // bot.on('photo', (msg) => {
  //   try {
  //     const chatId = msg.chat.id;
  //     const photo = msg.photo[0];
  //     const fileId = photo.file_id;

  //     bot.sendPhoto(chatId, fileId);
  //     // console.log('asdasdasdasda',media)
  //   } catch (e) {
  //     console.error('Ошибка при отправке медиагруппы:', e);
  //   }
  // });


};

startBot();

