require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const appUrl = process.env.WEB_APP_URL;
const sequelize = require('./src/BaseData/bdConnect');
const DatabaseService = require(`./src/BaseData/bdService`)
const { commandAndAnswer, callbackAnswer } = require('./src/BotService/botService');
require('./src/BaseData/bdModel');
const dbService = new DatabaseService(sequelize)
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
      username: userRequest.User ? userRequest.User.username : null
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


app.get('/mes', async (req, res) => {
  try {
    const messages = await Message.findAll({
      include: [
        {
          model: UserRequest,
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
      text: message.text,
      userRequestId: message.UserRequest.id,
      status: message.UserRequest.status,
      messageReq: message.UserRequest.messageReq,
      username: message.UserRequest.User ? message.UserRequest.User.username : null,
      address: message.UserRequest.User ? message.UserRequest.User.address : null,
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
      address: message.UserRequest.User ? message.UserRequest.User.address : null,
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

// connectToDatabase();

// const connectToDatabase = async () => {
//   try {
//     await sequelize.authenticate();
//     await sequelize.sync({ force: false }); // Добавлен параметр force: false
//     console.log('Подключение к бд установлено');
//   } catch (e) {
//     console.error('Подключение к бд сломалось', e);
//   }
// };

const startBot = async () => {
  await connectToDatabase();
  bot.on('callback_query', async (msg) => {
    await callbackHandler.handleMessage(msg);
    console.log('Подключение к бд установлено');
  });
  bot.on('message', async (msg) => {
    await commandHandler.handleMessage(msg);
  });


};

startBot();




// const { User, UserRequest, Message, Role } = require('./src/BaseData/bdModel');
// const DatabaseService = require('./src/BaseData/bdService');
// const databaseService = new DatabaseService(sequelize);

// if (text === `/req`) {
//   bot.sendMessage(chatId, `${appUrl}`, {
//     reply_markup: {
//       inline_keyboard: [
//         [{ text: `list Request`, web_app: { url: appUrl } }]
//       ]
//     }
//   });
// }
// else {
//   bot.sendMessage(chatId, `${text}`)
// }
