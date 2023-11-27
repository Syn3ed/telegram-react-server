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
const { User, UserRequest, Message, Role } = require('./src/BaseData/bdModel');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(bodyParser.json());


app.post(`/replyToUser`, async (req, res) => {
  const { queryId, userRequestId, username } = req.body;
  try {
    await bot.answerWebAppQuery(queryId, {
      type: 'article',
      id: queryId,
      title: 'ResUs',
      input_message_content: {
        message_text: `/resToUser ${userRequestId}`
      }
    })
    return res.status(200).json({});
  } catch (e) {
    return res.status(500).json({})
  }
})
app.post(`/replyToOperator`, async (req, res) => {
  const { queryId, userRequestId, username } = req.body;
  try {
    await bot.answerWebAppQuery(queryId, {
      type: 'article',
      id: queryId,
      title: 'ResOp',
      input_message_content: {
        message_text: `/resToOperator ${userRequestId}`
      }
    })
    return res.status(200).json({});
  } catch (e) {
    return res.status(500).json({})
  }
})
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

app.get('/users', async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.get('/req', async (req, res) => {
  try {
    const stat = 'ожидает ответа оператора'
    const usersReq = await UserRequest.findAll({
      where: { status: stat },
      include: User
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
      include: UserRequest,
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
      ]
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

            }
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
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.post('/users', async (req, res) => {
  try {
    const newUser = await User.create(req.body);
    res.json(newUser);
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
      const status = 'Заявка в обработке!';
      await dbManager.changeStatusRes(requestId, status);

      const message = `Заявка под номером ${requestId} в обработке`
      await commandHandler.sendMessagesToUsersWithRoleId(message, requestId);

      const userTelegramId = await dbManager.findUserToReq(userRequestId);
      
      if (userTelegramId) {
        bot.sendMessage(userTelegramId, `Новый ответ на вашу заявку: ${reply}`);
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


      bot.sendMessage(messages[0].UserRequest.User.telegramId, 'Вам пришел ответ на вашу заявку', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Ваша Заявка', web_app: { url: appUrl + `/requests/${userRequestId}` } }]
          ]
        }
      });
      bot.sendMessage(msg.chat.id, 'Ответ успешно добавлен.');
    } catch (error) {
      console.error('Ошибка при ответе на заявку:', error);
      bot.sendMessage(msg.chat.id, 'Произошла ошибка при ответе на заявку.');
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
            [{ text: 'Пришел ответ от пользователя', web_app: { url: appUrl + `/requestsOperator/${userRequestId}` } }]
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
    if (msg.text == '/lol') {
      bot.sendMessage(msg.chat.id, 'lol')
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
  bot.on('photo', (msg) => {
    try {
      const chatId = msg.chat.id;
      const photo = msg.photo[0];
      const fileId = photo.file_id;

      bot.sendPhoto(chatId, fileId);
      // console.log('asdasdasdasda',media)
    } catch (e) {
      console.error('Ошибка при отправке медиагруппы:', e);
    }
  });


};

startBot();

