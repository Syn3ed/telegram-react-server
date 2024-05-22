require('dotenv').config();
const { Op } = require('sequelize');
const multer = require('multer');
const { Sequelize, DataTypes } = require('sequelize');
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const appUrl = process.env.WEB_APP_URL;
const sequelize = require('./src/BaseData/bdConnect');
const DatabaseService = require(`./src/BaseData/bdService`)
require('./src/BaseData/bdModel');
const BotClass = require('./src/BotService/ClassBot')
const dbManager = new DatabaseService(sequelize)
const cors = require('cors');

const express = require('express');
const bodyParser = require('body-parser');
const { User, UserRequest, Message, Role, Media, MessageChat, OperatorReq } = require('./src/BaseData/bdModel');
const { where } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 3000;

const userPhotos = {};
const messageHandlers = {};
const sentMediaGroups = {};



app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());



async function sendMessagesToUsersWithRoleId(message, id) {
  try {
    const usersWithRoleId2 = await User.findAll({ where: { RoleId: [1, 3] } });

    usersWithRoleId2.forEach(user => {
      const userId = user.telegramId;
      bot.sendMessage(userId, message, {
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
    console.error('Ошибка при отправке сообщений пользователям с RoleId = 1 или 3:', error);
  }

}

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


app.post('/closeReq', async (req, res) => {
  const { queryId, userRequestId, username, userId, operatorId } = req.body;
  const requestId = userRequestId

  await CloseReq(requestId, operatorId)
  res.status(200).json({ success: true });
})


app.post(`/resumeReq`, async (req, res) => {

  const { userRequestId } = req.body;
  const requestId = userRequestId;
  const status = 'ожидает ответа оператора';
  const messageFunc = await Message.findAll({
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
  await ResumeReq(requestId)
  res.status(200).json({ success: true });
});


app.post('/handleShowPhoto', async (req, res) => {
  const { idMedia, operatorId } = req.body;
  try {
    hndlMed(idMedia, operatorId)
    res.status(200).json({ success: true });
  } catch (error) {
    console.log(error)
  }

});

async function ResumeReq(requestId) {
  try {
    const userRequestId = requestId
    const messageFunc = await Message.findAll({
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
    // if (messageFunc[0]?.operatorId) {
    //   const message = `Возобновлена заявка №${requestId}`;
    //   await bot.sendMessage(messageFunc[0].operatorId, message, {
    //     reply_markup: {
    //       inline_keyboard: [
    //         [{ text: `Ссылка на заявку`, web_app: { url: appUrl + `/InlinerequestsOperator/${requestId}` } }]
    //       ]
    //     }
    //   });
    // }
    if (messageFunc[0].UserRequest.User.telegramId) {
      const message = `Ваша заявка №${requestId} возобновлена`;
      await bot.sendMessage(messageFunc[0].UserRequest.User.telegramId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `Ссылка на заявку`, web_app: { url: appUrl + `/Inlinerequests/${requestId}` } }]
          ]
        }
      });
    }
    const status = 'ожидает ответа оператора'
    await dbManager.changeStatusRes(requestId, status);
    const message = `Возобновлена заявка №${requestId}`;
    await sendMessagesToUsersWithRoleId(message, requestId);
  } catch (e) {
    console.log(e);
  }
};

async function CloseReq(requestId, operatorId) {
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
    if (operatorId === messages[0].UserRequest.User.telegramId) {

      bot.sendMessage(operatorId, `Вы закрыли заявку №${requestId}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `Ссылка на заявку`, web_app: { url: appUrl + `/Inlinerequests/${requestId}` } }]
          ]
        }
      })

      if (messages[0]?.operatorId) {
        await bot.sendMessage(messages[0].operatorId, `Пользователь закрыл заявку №${requestId}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: `Ссылка на заявку`, web_app: { url: appUrl + `/InlinerequestsOperator/${requestId}` } }]
            ]
          }
        });
      }
    } else {

      bot.sendMessage(operatorId, `Вы закрыли заявку №${requestId} `, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `Ссылка на заявку`, web_app: { url: appUrl + `/InlinerequestsOperator/${requestId}` } }]
          ]
        }
      })

      bot.sendMessage(messages[0].UserRequest.User.telegramId, `Оператор закрыл вашу заявку №${requestId}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: `Ссылка на заявку`, web_app: { url: appUrl + `/Inlinerequests/${requestId}` } }]
          ]
        }
      })
    }
  } catch (e) {
    console.log(e)
  }
}

const hndlMed = async (idMedia, operatorId) => {
  try {
    console.log(idMedia);
    const med = await Media.findByPk(idMedia);
    console.log(med);
    if (med) {
      console.log('asdPHT');
      console.log(med);
      const pht = JSON.parse(med.idMedia);
      const chunkSize = 10;

      // Функция для группировки медиа по mediaGroupId
      const groupByMediaGroupId = (array) => {
        return array.reduce((groups, item) => {
          const groupId = item.mediaGroupId || 'default'; // Если нет mediaGroupId, используем 'default'
          if (!groups[groupId]) {
            groups[groupId] = [];
          }
          groups[groupId].push(item);
          return groups;
        }, {});
      };

      // Функция для разбивки массива на части
      const chunkArray = (array, size) => {
        const result = [];
        for (let i = 0; i < array.length; i += size) {
          result.push(array.slice(i, i + size));
        }
        return result;
      };

      // Группируем медиа по mediaGroupId
      const groupedMedia = groupByMediaGroupId(pht);

      // Отправляем медиа с mediaGroupId
      for (const groupId in groupedMedia) {
        if (groupId !== 'default') {
          const mediaGroup = groupedMedia[groupId];
          const mediaChunks = chunkArray(mediaGroup, chunkSize);

          for (const chunk of mediaChunks) {
            await bot.sendMediaGroup(operatorId, chunk.map(photo => ({
              type: photo.type,
              media: photo.media,
            })));
          }
        }
      }

      // Отправляем медиа без mediaGroupId
      if (groupedMedia['default']) {
        const defaultMediaGroup = groupedMedia['default'];
        const defaultMediaChunks = chunkArray(defaultMediaGroup, chunkSize);

        for (const chunk of defaultMediaChunks) {
          await bot.sendMediaGroup(operatorId, chunk.map(photo => ({
            type: photo.type,
            media: photo.media,
          })));
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
};



const createMediaRecord = async (userRequestId, idMedia) => {
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

function timeFunc() {
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

async function processUserRequest(requestId, userId) {
  const userRequestStatus = await UserRequest.findByPk(requestId);
  if (userRequestStatus.status === 'ожидает ответа оператора') {
    const status = 'Заявка в обработке';
    await dbManager.changeStatusRes(requestId, status);
    const message = `Заявка №${requestId} в обработке`;
    await sendMessagesToUsersWithRoleId(message, requestId);
  }

  const existingMessage = await Message.findByPk(requestId);
  const separator = ',';
  let operatorIds = [];
  if (existingMessage.operatorId) {
    operatorIds = existingMessage.operatorId.split(separator);
  }

  if (!operatorIds.includes(userId.toString())) {
    operatorIds.push(userId.toString());
  }

  existingMessage.operatorId = operatorIds.join(separator);
  console.log(existingMessage)
  await existingMessage.save();
};

async function messagesFunc(userRequestId) {
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

async function resToOperatorFunc(data) {
  try {
    const { chatId, nickname, userRequestId, timeMess, textHandler, caption_text } = data
    const op = 'User';
    const dataForMedia = { chatId, nickname, userRequestId, timeMess, op, caption_text }

    await sendMediaGroup1(dataForMedia);
    waitingUsers[chatId] = false;
    bot.off('message', textHandler);
    await bot.sendMessage(chatId, `Ответ успешно добавлен к заявке №${userRequestId}`);
  } catch (e) {
    console.log(e)
  }
  return;
};

async function resToOperatorTextFunc(data) {
  const { userRequestId, reply, chatId, username, timeMess, messages, textHandler } = data
  waitingUsers[chatId] = false;
  await dbManager.createUserRequestMessage(userRequestId, reply.text, chatId, 'User', username, timeMess);
  await bot.sendMessage(chatId, `Ответ успешно добавлен к заявке №${userRequestId}`);
  console.log('resToOperatorTextFunc')
  await bot.sendMessage(messages[0].operatorId, `Вам пришел ответ ответ от пользователя заявку №${userRequestId}\n${reply.text}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Cсылка на заявку', web_app: { url: appUrl + `/InlinerequestsOperator/${userRequestId}` } }],
        [{ text: 'Ответить', callback_data: `/resToUserPhoto ${userRequestId}` }]
      ]
    }
  });
  console.log('resToOperatorTextFunc')
  bot.off('message', textHandler);
  return;
};

async function resToOperatorTextFunc1(data) {
  try {
    const { userRequestId, reply, chatId, nickname, timeMess, messages, textHandler } = data
    waitingUsers[chatId] = false;
    await dbManager.createUserRequestMessage(userRequestId, reply.text, chatId, 'User', nickname, nickname, timeMess);
    await bot.sendMessage(chatId, `Ответ успешно добавлен к заявке №${userRequestId}`);
    console.log('resToOperatorTextFunc')
    const operatorIds = messages[0].operatorId.split(',');
    console.log('9999999999999999999999999')
    console.log(operatorIds)
    for (const operatorId of operatorIds) {
      await bot.sendMessage(operatorId.trim(), `Вам пришел ответ от пользователя на заявку №${userRequestId}\n${reply.text}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Ссылка на заявку', web_app: { url: appUrl + `/InlinerequestsOperator/${userRequestId}` } }],
            [{ text: 'Ответить', callback_data: `/resToUserPhoto ${userRequestId}` }]
          ]
        }
      });
    }
    console.log('resToOperatorTextFunc')

    bot.off('message', textHandler);
  } catch (e) {
    console.log(e)
    const { chatId, textHandler } = data
    waitingUsers[chatId] = false;
    bot.off('message', textHandler);
  }
  return;
};

async function resToUserTextFunc(data) {
  try {
    const { userRequestId, reply, timeMess, chatId, messages, textHandler, nicknameOperator, nickname } = data
    waitingUsers[chatId] = false;
    await dbManager.createUserRequestMessage(userRequestId, reply.text, chatId, 'Operator', `${nickname}`, nicknameOperator, timeMess);
    // await processUserRequest(userRequestId, chatId)
    await bot.sendMessage(chatId, `Ответ успешно добавлен к заявке №${userRequestId}`);
    console.log('resToUserTextFunc')
    await bot.sendMessage(messages[0].UserRequest.User.telegramId, `Вам пришел ответ ответ на заявку №${userRequestId}\n${reply.text}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Cсылка на заявку', web_app: { url: appUrl + `/Inlinerequests/${userRequestId}` } }],
          [{ text: 'Ответить', callback_data: `/resToOperatorPhoto ${userRequestId}` }]
        ]
      }
    });
    console.log('resToUserTextFunc')
    bot.off('message', textHandler);
  } catch (e) {
    console.log(e)
    const { chatId, textHandler } = data
    waitingUsers[chatId] = false;
    bot.off('message', textHandler);
  }
  return;
};

async function resToUserTextFunc1(data) {
  try {
    const { userRequestId, reply, timeMess, chatId, messages, textHandler } = data
    waitingUsers[chatId] = false;
    await dbManager.createUserRequestMessage(userRequestId, reply.text, chatId, 'Operator', 'Оператор', timeMess);
    await processUserRequest(userRequestId, chatId)
    await bot.sendMessage(chatId, `Ответ успешно добавлен к заявке №${userRequestId}`);
    console.log('resToUserTextFunc')
    await bot.sendMessage(messages[0].UserRequest.User.telegramId, `Вам пришел ответ ответ на заявку №${userRequestId}\n${reply.text}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Cсылка на заявку', web_app: { url: appUrl + `/Inlinerequests/${userRequestId}` } }],
          [{ text: 'Ответить', callback_data: `/resToOperatorPhoto ${userRequestId}` }]
        ]
      }
    });
    console.log('resToUserTextFunc')
    bot.off('message', textHandler);
  } catch (e) {
    console.log(e)
    const { chatId, textHandler } = data
    waitingUsers[chatId] = false;
    bot.off('message', textHandler);
  }
  return;
};

async function MethodToOperator(userRequestId, userName, chatId) {
  if (!waitingUsers[chatId]) {
    try {
      const sentMessage = await bot.sendMessage(chatId, 'Пожалуйста, введите сообщение или прикрепите файл(ы).\n Вы также можете отменить действие, нажав на кнопку "Стоп"', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Стоп', callback_data: 'stop_action' }]
          ]
        }
      });
      console.log('Сообщение от пользователя');
      waitingUsers[chatId] = true;

      if (!messageHandlers[chatId]) {
        const textHandler = async (response) => {
          if (chatId === response.from.id && waitingUsers[chatId]) {
            const reply = response;
            if ((reply?.text === 'Стоп' || reply?.text === 'стоп') && waitingUsers[chatId]) {
              waitingUsers[chatId] = false;
              return bot.sendMessage(chatId, 'Хорошо');
            }
            const timeMess = timeFunc();
            let caption_text;
            console.log('123321');
            const messages = await messagesFunc(userRequestId);
            console.log('123321');

            if (reply.photo) {
              userPhotos[chatId] = userPhotos[chatId] || [];
              if (!userPhotos[chatId].some(item => item.media === reply.photo[0].file_id)) {
                userPhotos[chatId].push({
                  id: userPhotos[chatId].length + 1,
                  type: 'photo',
                  media: reply.photo[0].file_id,
                  mediaGroupId: reply.media_group_id
                });
                console.log('Получена фотография:');
                console.log(userPhotos[chatId]);
              }
            } else if (reply.document) {
              userPhotos[chatId] = userPhotos[chatId] || [];
              if (!userPhotos[chatId].some(item => item.media === reply.document.file_id)) {
                userPhotos[chatId].push({
                  id: userPhotos[chatId].length + 1,
                  type: 'document',
                  media: reply.document.file_id,
                  mediaGroupId: reply.media_group_id
                });
              }
            } else if (reply.video) {
              userPhotos[chatId] = userPhotos[chatId] || [];
              if (!userPhotos[chatId].some(item => item.media === reply.video.file_id)) {
                userPhotos[chatId].push({
                  id: userPhotos[chatId].length + 1,
                  type: 'video',
                  media: reply.video.file_id,
                  mediaGroupId: reply.media_group_id,
                });
              }
            }

            const existingUser = await dbManager.getUserByChatId(`${chatId}`);
            const nickname = existingUser.username;
            if (reply.caption) {
              caption_text = reply.caption;
              dbManager.createUserRequestMessage(userRequestId, caption_text, chatId, 'User', nickname, nickname, timeMess);
            }
            console.log('123321');
            if (!sentMediaGroups[chatId] && !reply?.text) {
              sentMediaGroups[chatId] = true;
              setTimeout(() => {
                console.log(sentMediaGroups[chatId]);
                const data = {
                  chatId,
                  nickname,
                  userRequestId,
                  timeMess,
                  textHandler,
                  caption_text
                };
                resToOperatorFunc(data);
                userPhotos[chatId] = [];
                console.log(waitingUsers[chatId]);
              }, 1000);
            }
            if (reply?.text) {
              setTimeout(() => {
                const data = {
                  userRequestId,
                  reply,
                  chatId,
                  nickname,
                  timeMess,
                  messages,
                  textHandler
                };
                userPhotos[chatId] = [];
                resToOperatorTextFunc1(data);
                console.log(waitingUsers[chatId]);
              }, 500);
            }
          }
          console.log('123321');
        };

        messageHandlers[chatId] = textHandler;
        bot.on('message', messageHandlers[chatId]);
      }

      bot.on('callback_query', async (callbackQuery) => {
        const data = callbackQuery.data;
        if (data === 'stop_action' && waitingUsers[chatId]) {
          waitingUsers[chatId] = false;
          await bot.sendMessage(chatId, 'Вы завершили предыдушие действие.');
          bot.off('message', messageHandlers[chatId]);
          // await bot.deleteMessage(chatId, sentMessage.message_id);

          delete messageHandlers[chatId];
        }
        // await bot.deleteMessage(chatId, sentMessage.message_id);
        // await bot.deleteMessage(chatId, sentMessage2.message_id);
        await bot.answerCallbackQuery(callbackQuery.id);
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    sentMessage2 = await bot.sendMessage(chatId, `Вы не завершили предыдущее действие. Хотите завершить?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Стоп', callback_data: 'stop_action' }]
        ]
      }
    });
  }
}

async function MethodToOperator1(userRequestId, userName, chatId) {
  if (!waitingUsers[chatId]) {
    try {
      await bot.sendMessage(chatId, 'Пожалуйста, введите сообщение или прикрепите файл(ы).\nВы также можете отменить действие, нажав на кнопку "Стоп"', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Стоп', callback_data: 'Стоп' }]
          ]
        }
      });

      waitingUsers[chatId] = true;
      const textHandler = async (response) => {
        if (chatId === response.from.id && waitingUsers[chatId]) {
          console.log('123321')
          const reply = response;
          if ((reply?.text === 'Стоп' || reply?.text === 'стоп') && waitingUsers[chatId]) {
            waitingUsers[chatId] = false;
            return bot.sendMessage(chatId, 'Хорошо');;
          }
          console.log('123321')
          const timeMess = timeFunc()
          let caption_text;
          console.log('123321')
          const messages = await messagesFunc(userRequestId)
          console.log('123321')
          if (reply.photo) {
            userPhotos[chatId] = userPhotos[chatId] || [];
            if (!userPhotos[chatId].some(item => item.media === reply.photo[0].file_id)) {
              userPhotos[chatId].push({
                type: 'photo',
                media: reply.photo[0].file_id,
                mediaGroupId: reply.media_group_id
              });
              console.log('Получена фотография:');
              console.log(userPhotos[chatId]);
            }
          } else if (reply.document) {
            userPhotos[chatId] = userPhotos[chatId] || [];
            if (!userPhotos[chatId].some(item => item.media === reply.document.file_id)) {
              userPhotos[chatId].push({
                type: 'document',
                media: reply.document.file_id,
                mediaGroupId: reply.media_group_id
              });
            }
          } else if (reply.video) {
            userPhotos[chatId] = userPhotos[chatId] || [];
            if (!userPhotos[chatId].some(item => item.media === reply.video.file_id)) {
              userPhotos[chatId].push({
                type: 'video',
                media: reply.video.file_id,
                mediaGroupId: reply.media_group_id
              });
            }
          }

          const existingUser = await dbManager.getUserByChatId(`${chatId}`);
          const nickname = existingUser.username;
          if (reply.caption) {
            caption_text = reply.caption
            dbManager.createUserRequestMessage(userRequestId, caption_text, chatId, 'User', nickname, nickname, timeMess);
          }
          console.log('123321')
          if (!sentMediaGroups[chatId] && !reply?.text) {
            sentMediaGroups[chatId] = true;
            setTimeout(() => {
              console.log(sentMediaGroups[chatId])
              const data = {
                chatId,
                userName,
                userRequestId,
                timeMess,
                textHandler,
                nickname,
                caption_text
              }
              resToOperatorFunc(data);
              console.log(waitingUsers[chatId])
              const message = `Создана новая заявка №${userRequestId}`
              bot.sendMessage(chatId, `Ваша заявка создана №${userRequestId}`, {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: 'Ссылка на заявку', web_app: { url: appUrl + `/Inlinerequests/${userRequestId}` } }]
                  ]
                }
              });
              sendMessagesToUsersWithRoleId(message, userRequestId)
            }, 1000);
          }
          if (reply?.text) {
            setTimeout(() => {
              const data = {
                userRequestId,
                reply,
                chatId,
                userName,
                timeMess,
                messages,
                nickname,
                textHandler
              }
              resToOperatorTextFunc1(data);
              console.log(waitingUsers[chatId])
              const message = `Создана новая заявка №${userRequestId}`
              bot.sendMessage(chatId, `Ваша заявка создана №${userRequestId}`, {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: 'Ссылка на заявку', web_app: { url: appUrl + `/Inlinerequests/${userRequestId}` } }]
                  ]
                }
              });
              sendMessagesToUsersWithRoleId(message, userRequestId)
            }, 1000);
          }

          console.log('123321')
        }
      };
      bot.on('message', textHandler);
    } catch (error) {
      console.log(error)
    }
  } else {
    await bot.sendMessage(chatId, `Вы не завершили предыдушие действие. Хотите завершить?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Стоп', callback_data: 'Стоп' }]
        ]
      }
    });
  }
};

async function MethodToUser(userRequestId, userName, chatId) {
  if (!waitingUsers[chatId]) {
    const username = userName;
    try {
      await bot.sendMessage(chatId, 'Пожалуйста, введите сообщение или прикрепите файл(ы).\n Вы также можете отменить действие, нажав на кнопку "Стоп"', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Стоп', callback_data: 'stop_action' }]
          ]
        }
      });

      waitingUsers[chatId] = true;
      let tt = true;
      
      if (!messageHandlers[chatId]) {
        const textHandler = async (response) => {
          
          if (chatId === response.from.id && waitingUsers[chatId]) {
            console.log('Сообщение от оператора');
            const reply = response;

            if ((reply?.text === 'Стоп' || reply?.text === 'стоп') && waitingUsers[chatId]) {
              waitingUsers[chatId] = false;
              return bot.sendMessage(chatId, 'Хорошо');
            }
            let caption_text;
            console.log('123321');

            const timeMess = timeFunc();
            const messages = await messagesFunc(userRequestId);

            if (reply.photo) {
              userPhotos[chatId] = userPhotos[chatId] || [];
              if (!userPhotos[chatId].some(item => item.media === reply.photo[0].file_id)) {
                userPhotos[chatId].push({
                  id: userPhotos[chatId].length + 1,
                  type: 'photo',
                  media: reply.photo[0].file_id,
                  mediaGroupId: reply.media_group_id
                });
                console.log('Получена фотография:');
                console.log(userPhotos[chatId]);
              }
            } else if (reply.document) {
              userPhotos[chatId] = userPhotos[chatId] || [];
              if (!userPhotos[chatId].some(item => item.media === reply.document.file_id)) {
                userPhotos[chatId].push({
                  id: userPhotos[chatId].length + 1,
                  type: 'document',
                  media: reply.document.file_id,
                  mediaGroupId: reply.media_group_id
                });
              }
            } else if (reply.video) {
              userPhotos[chatId] = userPhotos[chatId] || [];
              if (!userPhotos[chatId].some(item => item.media === reply.video.file_id)) {
                userPhotos[chatId].push({
                  id: userPhotos[chatId].length + 1,
                  type: 'video',
                  media: reply.video.file_id,
                  mediaGroupId: reply.media_group_id,
                });
              }
            }

            console.log('123321');
            const existingUser = await dbManager.getUserByChatId(`${chatId}`);
            const nickname = existingUser.username;
            const nicknameOperator = existingUser.nicknameOperator;
            if (reply.caption) {
              caption_text = reply.caption;
              dbManager.createUserRequestMessage(userRequestId, caption_text, chatId, 'Operator', `${nickname}`, `${nicknameOperator}`, timeMess);
            }
            console.log('123321');
        
            if (tt) {
              await processUserRequest(userRequestId, chatId);
              tt = false;
            }
          
            console.log('123321');
            if (!sentMediaGroups[chatId] && !reply?.text) {
              sentMediaGroups[chatId] = true;
              setTimeout(() => {
                console.log(sentMediaGroups[chatId]);
                const data = {
                  chatId,
                  userRequestId,
                  timeMess,
                  textHandler,
                  caption_text,
                  nicknameOperator,
                  nickname
                };
                resToUserFunc(data);
                console.log(waitingUsers[chatId]);
                userPhotos[chatId] = [];
              }, 1000);
            }

            if (reply?.text) {
              setTimeout(() => {
                const data = {
                  userRequestId,
                  reply,
                  chatId,
                  timeMess,
                  messages,
                  nicknameOperator,
                  textHandler,
                  nickname
                };
                resToUserTextFunc(data);
                console.log(waitingUsers[chatId]);
                userPhotos[chatId] = [];
              }, 500);
            }
          }
        };

      
        messageHandlers[chatId] = textHandler;
        bot.on('message', messageHandlers[chatId]);
      }

      bot.on('callback_query', async (callbackQuery) => {
        const data = callbackQuery.data;
        if (data === 'stop_action' && waitingUsers[chatId]) {
          waitingUsers[chatId] = false;
          await bot.sendMessage(chatId, 'Вы завершили предыдушие действие.');
          bot.off('message', messageHandlers[chatId]);
          delete messageHandlers[chatId];

        }
        await bot.answerCallbackQuery(callbackQuery.id);
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    await bot.sendMessage(chatId, `Вы не завершили предыдущее действие. Хотите завершить?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Стоп', callback_data: 'stop_action' }]
        ]
      }
    });
  }
}

async function keyboardRole(chatId) {
  // const chatId = msg.chat.id;
  const user = await User.findOne({ where: { telegramId: chatId.toString() } });

  if (!user) {
    await bot.sendMessage(chatId, 'Пользователь не найден.');
    return;
  }

  let keyboard = [];

  if (user.RoleId == '2') {
    keyboard = [
      [{ text: 'Мои заявки', web_app: { url: appUrl + `/RequestUserList/${chatId}` } }, { text: 'Мой профиль', web_app: { url: appUrl + `/UserProfile/${chatId}` } }],
      [{ text: 'Создание заявки', web_app: { url: appUrl + '/FormReq' } }]
    ];
  } else if (user.RoleId == '1') {
    keyboard = [
      [{ text: 'Мои заявки', web_app: { url: appUrl + `/RequestUserList/${chatId}` } }, { text: 'Мой профиль', web_app: { url: appUrl + `/UserProfile/${chatId}` } }],
      [{ text: `Текущие заявки`, web_app: { url: appUrl } }, { text: 'Создание заявки', web_app: { url: appUrl + '/FormReq' } }],
      [{ text: 'Изменить роль пользователя по его Id', callback_data: `/resRole` }, { text: 'Меню админа', web_app: { url: appUrl + `/AdminIndex` } }]
    ];
  } else if (user.RoleId == '3') {
    keyboard = [
      [{ text: `Текущие заявки`, web_app: { url: appUrl } }, { text: 'Мой профиль', web_app: { url: appUrl + `/UserProfile/${chatId}` } }]
    ];
  }

  await bot.sendMessage(chatId, 'Обновление меню бота', {
    reply_markup: {
      keyboard: keyboard
    }
  });
  return
};

app.post(`/replyToOperatorPhoto`, async (req, res) => {
  const { queryId, userRequestId, username, operatorId } = req.body;
  MethodToOperator(userRequestId, username, operatorId)
  res.status(200).json({ success: true });
}
);
let fileIdCounter = 1;

async function resToUserFunc(data) {
  const { chatId, userRequestId, timeMess, textHandler, caption_text, nicknameOperator, nickname } = data
  const op = 'Operator'
  const dataForMedia = { chatId, nickname, userRequestId, timeMess, op, caption_text, nicknameOperator }
  await sendMediaGroup1(dataForMedia);
  waitingUsers[chatId] = false;
  bot.off('message', textHandler);
  bot.sendMessage(chatId, `Файл успешно добавлен к заявке №${userRequestId}`);
  return;
};

app.post(`/resToUserPhoto`, async (req, res) => {
  const { queryId, userRequestId, username, operatorId } = req.body;
  MethodToUser(userRequestId, username, operatorId)
  res.status(200).json({ success: true });
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
});

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
});

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
      nicknameOperator: chatMes.nicknameOperator,
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
    const uniqueUserIds = new Set();
    chat.forEach(chatMes => {
      uniqueUserIds.add(chatMes.idUser);
    });

    const userIdsArray = Array.from(uniqueUserIds);
    const users = await User.findAll({
      where: { telegramId: userIdsArray }
    });

    const usersMap = {};
    users.forEach(user => {
      usersMap[user.telegramId] = user;
    });

    const formattedChat = chat.map(chatMes => ({
      id: chatMes.id,
      textMessage: chatMes.textMessage,
      idUser: chatMes.idUser,
      roleUser: chatMes.roleUser,
      UserRequestId: chatMes.UserRequestId,
      IdMedia: chatMes.IdMedia,
      nicknameOperator: chatMes.nicknameOperator,
      username: usersMap[chatMes.idUser] ? usersMap[chatMes.idUser].username : null,
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
    // const stat = 'ожидает ответа оператора';
    // const stat1 = 'Заявка в обработке!';
    const usersReq = await UserRequest.findAll({
      // where: {
      //   [Op.or]: [
      //     { status: stat },
      //     { status: stat1 }
      //   ]
      // },
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

app.get('/', async (req, res) => {
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
      username: user.username,
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
    // await sequelize.sync({ force: true });
    console.log('Подключение к БД успешно');
    // const userrole = dbManager.changeRoleUser(1, 3)
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

const oneWeek = 7 * 24 * 60 * 60 * 1000;
const min_15 = 15 * 60 * 1000;

async function getUnansweredRequestsMin15() {
  try {
    const unansweredRequests = await UserRequest.findAll({
      where: {
        status: 'ожидает ответа оператора',
        createdAt: {
          [Sequelize.Op.lt]: new Date(new Date() - 300000)
        }
      }
    });
    return unansweredRequests;
  } catch (error) {
    console.error('Error retrieving unanswered requests:', error);
    return [];
  }
}

async function getUnansweredRequestsOneWeek() {
  try {
    const unansweredRequests = await UserRequest.findAll({
      where: {
        status: 'ожидает ответа оператора',
        createdAt: {
          [Sequelize.Op.lt]: new Date(new Date() - 600000)
        }
      }
    });
    return unansweredRequests;
  } catch (error) {
    console.error('Error retrieving unanswered requests:', error);
    return [];
  }
}

const NotificationRequest = {};

async function notifyOperators(requests) {
  requests.forEach(request => {
    if (!NotificationRequest[request.id]) {
      const message = `Заявка №${request.id} не получила ответа в течение 15 минут`;
      sendMessagesToUsersWithRoleId(message, request.id);
      NotificationRequest[request.id] = true;
    }
  });
}

async function checkRequestsMin15() {
  const unansweredRequests = await getUnansweredRequestsMin15();
  if (unansweredRequests.length > 0) {
    notifyOperators(unansweredRequests);
  }
}

async function checkRequestsOneWeek() {
  const unansweredRequests = await getUnansweredRequestsOneWeek();
  if (unansweredRequests.length > 0) {
    notifyOperatorsOneWeek(unansweredRequests)
  }
}

async function notifyOperatorsOneWeek(requests) {
  for (const request of requests) {
    const userRequestId = request.id;
    const message = `Заявка №${userRequestId} не получила ответа в течение недели и была закрыта`;
    const status = 'Заявка закрыта';
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
    await sendMessagesToUsersWithRoleId(message, userRequestId);
    await dbManager.changeStatusRes(userRequestId, status);
    console.log(messages)
    console.log(messages[0])
    await bot.sendMessage(messages[0].UserRequest.User.telegramId, `Ваша заявка №${userRequestId} была закрыта по истечению времени`);
  }
}

async function sendMediaGroup(chatId, userName, userRequestId, timeMess, op) {
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
    return mediaRecord;
  }
}

async function sendMediaGroup1(data) {
  const { chatId, nickname, userRequestId, timeMess, op, caption_text, nicknameOperator } = data;
  if (userPhotos[chatId] && userPhotos[chatId].length > 0) {
    const mediaGroupId = userPhotos[chatId][0].mediaGroupId;
    console.log('321111111111111111111111111111213123213213123')
    console.log(userPhotos[chatId])
    // const groupPhotos = userPhotos[chatId].filter(photo => photo.mediaGroupId === mediaGroupId);
    const groupPhotos = userPhotos[chatId]
    const str = JSON.stringify(groupPhotos);
    const mediaRecord = await createMediaRecord(userRequestId, str);

    await MessageChat.create({
      IdMedia: mediaRecord.id,
      roleUser: op,
      idUser: chatId,
      username: nickname,
      // nicknameOperator: nicknameOperator,
      UserRequestId: userRequestId,
      TimeMessages: timeMess,
      nicknameOperator: nicknameOperator
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


    if (op === 'User') {
      if (messages[0].operatorId) {
        const tt = await hndlMed(mediaRecord.id, messages[0].operatorId);
        if (caption_text) {
          await bot.sendMessage(messages[0].operatorId, caption_text)
        }
        await bot.sendMessage(messages[0].operatorId, `Пользователь отправил вам файл на заявку №${userRequestId}.`, {
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
        await bot.sendMessage(messages[0].UserRequest.User.telegramId, caption_text)
      }
      await bot.sendMessage(messages[0].UserRequest.User.telegramId, `Оператор отправил вам файл на заявку №${userRequestId}.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Ссылка на заявку', web_app: { url: appUrl + `/Inlinerequests/${userRequestId}` } }],
            [{ text: 'Ответить', callback_data: `/resToOperatorPhoto ${userRequestId}` }]
          ]
        }
      });
    }
    console.log('11111111111111111111111111111111111111111111111111111111111111111111111111111111')
    userPhotos[chatId] = userPhotos[chatId].filter(photo => photo.mediaGroupId !== mediaGroupId);
    sentMediaGroups[chatId] = false;
  }
  return;
}

const startBot = async () => {
  await connectToDatabase();
  await createRoles();
  // setInterval(checkRequestsMin15, 60 * 1000 * 2);
  // setInterval(checkRequestsOneWeek, 60 * 1000 * 3);
  bot.on('message', async (msg) => {

    console.log(msg)
    const chatId = msg.chat.id
    if (msg.text === 'Узнать id' || msg.text === `Мой id`) {
      await bot.sendMessage(chatId, `Ваш id \n${chatId}`)
    }

    if (msg.text === `Изменить роль пользователя по его Id`) {
      try {
        const userId = msg.from.id;

        await bot.sendMessage(userId, 'Пожалуйста, введите id пользователя.\n Вы также можете отменить действие, нажав на кнопку "Стоп"', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Стоп', callback_data: 'Стоп' }]
            ]
          }
        });
        waitingUsers[userId] = true;


        const textHandler = async (response) => {
          try {
            console.log(`Изменить роль пользователя по его Id`)
            if (userId === response.from.id && waitingUsers[userId]) {

              console.log(`Изменить роль пользователя по его Id`)
              const chatId = response.text;
              console.log(chatId)
              waitingUsers[userId] = false;

              if (!isNaN(chatId)) {

                const user = await User.findOne({ where: { telegramId: chatId.toString() } });

                if (!user) {
                  await bot.sendMessage(userId, 'Пользователь не найден.');
                  return;
                }

                let keyboard = [];

                if (user.RoleId == '2') {
                  keyboard = [
                    [{ text: 'Администратор', callback_data: `/changeRoleAdmin ${chatId}` }, { text: 'Оператор', callback_data: `/changeRoleOperator ${chatId}` }]
                  ];
                } else if (user.RoleId == '1') {
                  keyboard = [
                    [{ text: 'Пользователь', callback_data: `/changeRoleUser ${chatId}` }, { text: 'Оператор', callback_data: `/changeRoleOperator ${chatId}` }]
                  ];
                } else if (user.RoleId == '3') {
                  keyboard = [
                    [{ text: 'Администратор', callback_data: `/changeRoleAdmin ${chatId}` }, { text: 'Пользователь', callback_data: `/changeRoleUser ${chatId}` }]
                  ];
                }

                await bot.sendMessage(userId, `Чтобы изменить роль пользователю выберете роль`, {
                  reply_markup: {
                    inline_keyboard: keyboard
                  }
                });

                // Удаляем обработчик события text после обработки сообщения
                bot.off('text', textHandler);
              } else {
                bot.sendMessage(userId, 'Ошибка: Введенное значение не соответствует ожидаемому формату ID-телеграма. Пожалуйста, введите корректный ID пользователя.');

                // Удаляем обработчик события text после обработки сообщения
                bot.off('text', textHandler);
              }
            }
          } catch (e) {

          }
        }
        bot.on('text', textHandler);
      } catch (e) {
        console.log(e)
      }
    }

    if (msg.text === '/start') {
      try {
        const chatId = msg.chat.id;
        const existingUser = await dbManager.getUserByChatId(`${chatId}`);

        if (existingUser) {
          await bot.sendMessage(chatId, `Добро пожаловать снова, ${existingUser.username}!`);
        } else {
          await bot.sendMessage(chatId, `Привет, ${msg.from.first_name}!`);
          waitingUsers[chatId] = true;
          await bot.sendMessage(chatId, 'Пожалуйста, введите свои ФИО для продолжения работы с ботом:');

          const textHandler = async (response) => {
            try {
              if (chatId === response.from.id && waitingUsers[chatId]) {
                // if (!response?.entities) {
                waitingUsers[chatId] = false;
                bot.off('text', textHandler);
                const fullName = response.text;
                await dbManager.createUserWithRole(`${chatId}`, `${fullName}`, `User`);
                await bot.sendMessage(chatId, 'Отлично! Теперь вы можете пользоваться ботом.');
                keyboardRole(chatId)
                // }
              }
            } catch (error) {
              console.error('Ошибка при обработке ответа пользователя:', error);
            }
          };

          bot.on('text', textHandler);
        }
      } catch (error) {
        console.error('Ошибка при обработке команды /start:', error);
      }
    }

    if (msg.text === '/menu') {

      try {
        const chatId = msg.chat.id;
        const existingUser = await dbManager.getUserByChatId(`${chatId}`);
        if (existingUser) {
          keyboardRole(chatId)
        } else {
          await bot.sendMessage(chatId, 'Незарегистрированный пользователь. Доступ запрещен.');
        }
      } catch (error) {
        console.error('Ошибка:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка при обработке команды.');
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
        const regex7 = /\/changeRoleUser (\d+)/;
        const regex8 = /\/changeRoleOperator (\d+)/;
        const regex9 = /\/changeRoleAdmin (\d+)/;
        const regex10 = /\/changeName (\d+)/;
        if (regex.test(msg.web_app_data.data)) {
          const match = msg.web_app_data.data.match(regex);
          const idMed = match[1];
          const chatId = msg.chat.id;

          try {
            const med = await Media.findByPk(idMed);
            // await bot.sendPhoto(msg.chat.id, med.idMedia);
            console.log('asdPHT')
            console.log(med)
            const pht = JSON.parse(med.idMedia);
            await bot.sendMediaGroup(chatId, pht.map(photo => ({
              type: photo.type,
              media: photo.media
            })));
          } catch (e) {
            console(e)
          }

          console.log(idMed);
        }
        if (regex2.test(msg.web_app_data.data)) {
          const match = msg.web_app_data.data.match(regex2);
          const userRequestId = match[1];
          const chatId = msg.from.id;
          const userName = msg.from.first_name
          MethodToOperator(userRequestId, userName, chatId)
        }
        if (regex1.test(msg.web_app_data.data)) {
          const match = msg.web_app_data.data.match(regex1);
          const userRequestId = match[1];
          const chatId = msg.from.id;
          const userName = msg.from.first_name
          MethodToUser(userRequestId, userName, chatId)

        }
        if (regex3.test(msg.web_app_data.data)) {
          const match = msg.web_app_data.data.match(regex3);
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
                if (reply === 'Стоп' || reply === 'стоп') {
                  await bot.sendMessage(userId, 'Хорошо');
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

                  await bot.sendMessage(messages[0].operatorId, `Пришел ответ от пользователя на заявку №${userRequestId}`, {
                    reply_markup: {
                      inline_keyboard: [
                        [{ text: 'Пришел ответ от пользователя', web_app: { url: appUrl + `/InlinerequestsOperator/${userRequestId}` } }],
                        [{ text: 'Ответить', callback_data: `/resToUserPhoto ${userRequestId}` }]
                      ]
                    }
                  });
                  bot.sendMessage(userId, 'Ответ успешно добавлен.');
                }
              }
            };

            bot.on('text', textHandler);

          } catch (error) {
            console.log(error);
          }
        }
        if (regex4.test(msg.web_app_data.data)) {
          const match = msg.web_app_data.data.match(regex4);
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
                if (reply === 'Стоп' || reply === 'стоп') {
                  await bot.sendMessage(userId, 'Хорошо');
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
                  const status = 'Заявка в обработке';
                  await dbManager.changeStatusRes(requestId, status);
                  const message = `Заявка №${requestId} в обработке`;
                  await sendMessagesToUsersWithRoleId(message, requestId);
                }
                const existingMessage = await Message.findByPk(requestId);
                const separator = ',';
                let operatorIds = [];
                if (existingMessage.operatorId) {
                  operatorIds = existingMessage.operatorId.split(separator);
                }

                if (!operatorIds.includes(userId.toString())) {
                  operatorIds.push(userId.toString());
                }
                // existingMessage.operatorId = userId;
                // await existingMessage.save();
                existingMessage.operatorId = operatorIds.join(separator);

                await existingMessage.save();
                await dbManager.findUserToReq(requestId);

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

                bot.sendMessage(messages[0].UserRequest.User.telegramId, `Вам пришел ответ на вашу заявку №${requestId}`, {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: 'Ваша Заявка', web_app: { url: appUrl + `/Inlinerequests/${requestId}` } }],
                      [{ text: 'Ответить', callback_data: `/resToOperatorPhoto ${requestId}` }]
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
        }
        if (regex5.test(msg.web_app_data.data)) {
          const match = msg.web_app_data.data.match(regex5);
          const userId = msg.from.id;
          const requestId = match[1];

          await CloseReq(requestId, userId)
        }
        if (regex6.test(msg.web_app_data.data)) {
          const match = msg.web_app_data.data.match(regex6);
          const userId = msg.from.id;
          const requestId = match[1];
          await ResumeReq(requestId)
        }
        if (regex7.test(msg.web_app_data.data)) {
          const match = msg.web_app_data.data.match(regex7);
          const chatId = msg.from.id;
          const userId = match[1];
          console.log(msg)
          const chRole = dbManager.changeRoleUser(userId, 2)
          await bot.sendMessage(userId, 'Вам присвоена роль "Пользователь"');
          bot.sendMessage(chatId, 'Роль пользователя успешно изменена');
          keyboardRole(userId)
        }
        if (regex8.test(msg.web_app_data.data)) {
          const match = msg.web_app_data.data.match(regex8);
          const chatId = msg.from.id;
          const userId = match[1];
          console.log(msg)
          const chRole = dbManager.changeRoleUser(userId, 3)
          const existingUser = await dbManager.getUserByChatId(`${userId}`);
          await bot.sendMessage(userId, 'Вам присвоена роль "Оператор"');
          await bot.sendMessage(chatId, 'Роль пользователя успешно изменена');
          await existingUser.update({ nicknameOperator: `Оператор#${existingUser.id}` })
          keyboardRole(userId)
        }
        if (regex9.test(msg.web_app_data.data)) {
          const match = msg.web_app_data.data.match(regex9);
          const chatId = msg.from.id;
          const userId = match[1];
          console.log(msg)
          const chRole = dbManager.changeRoleUser(userId, 1)
          const existingUser = await dbManager.getUserByChatId(`${userId}`);
          await bot.sendMessage(userId, 'Вам присвоена роль "Администратор"');
          await bot.sendMessage(chatId, 'Роль пользователя успешно изменена');
          await existingUser.update({ nicknameOperator: `Администратор#${existingUser.id}` })
          keyboardRole(userId)
        }
        if (regex10.test(msg.web_app_data.data)) {
          const match = msg.web_app_data.data.match(regex10);
          const chatId = msg.from.id;
          const userId = match[1];
          console.log(msg)
          waitingUsers[chatId] = true;
          await bot.sendMessage(chatId, 'Пожалуйста, введите свои ФИО:', {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Стоп', callback_data: 'Стоп' }]
              ]
            }
          });

          const textHandler = async (response) => {
            try {
              if (chatId === response.from.id && waitingUsers[chatId]) {
                waitingUsers[chatId] = false;
                bot.off('text', textHandler);
                const fullName = response.text;
                await dbManager.changeNameUser(userId, fullName);
                await bot.sendMessage(chatId, 'Отлично!');
                // keyboardRole(chatId);
              }
            } catch (error) {
              console.error('Ошибка при обработке ответа пользователя:', error);
            }
          };

          bot.on('text', textHandler);
          dbManager.changeNameUser(userId,)
        }
        const userName = msg.from.first_name;
        try {
          const data = JSON.parse(msg?.web_app_data?.data);
          if (data.isSwitchOn) {
            const userId = msg.from.id;
            console.log('asd3')
            const createdRequest = await dbManager.createUserRequest(`${msg.from.id}`, 'ожидает ответа оператора', data.description, data.category, data.address);
            console.log(createdRequest)
            const createdRequestId = createdRequest.dataValues.id;
            const userRequestId = createdRequestId;
            MethodToOperator1(userRequestId, userName, userId)
            const message = `Уведомляею о создании новой заявки №${createdRequestId}`
            sendMessagesToUsersWithRoleId(message, createdRequestId)
          } else {
            const createdRequest = await dbManager.createUserRequest(`${msg.from.id}`, 'ожидает ответа оператора', data.description, data.category, data.address);
            const createdRequestId = createdRequest.dataValues.id;
            const userRequestId = createdRequestId;
            const message = `Уведомляею о создании новой заявки №${createdRequestId}`
            bot.sendMessage(chatId, `Ваша заявка создана №${userRequestId}`, {
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

  bot.on('callback_query', async (msg) => {

    console.log(msg)
    console.log('11111111111111111111111111111111111111111111111111111111111111111111111111')
    console.log(msg.data)
    const data1 = msg.data;
    const callbackQueryId = msg.id
    const chatId = msg.from.id;
    const userName = msg.from.first_name
    if (data1 === 'Стоп') {
      const userId = msg.from.id;
      if (waitingUsers[userId]) {
        waitingUsers[userId] = false
        await bot.answerCallbackQuery(callbackQueryId);
        await bot.sendMessage(chatId, `Вы завершили предыдушие действие.`)
      } else {
        await bot.answerCallbackQuery(callbackQueryId);
        await bot.sendMessage(chatId, `Вы уже завершили предыдушие действие.`)
      }
    }
    if (data1 === '/userId') {
      await bot.sendMessage(chatId, `Ваш Telegram ID: \n${chatId}`);
    }
    if (data1) {
      const regex = /\/handleShowPhoto (\d+)/;
      const regex1 = /\/resToUserPhoto (\d+)/;
      const regex2 = /\/resToOperatorPhoto (\d+)/;
      const regex3 = /\/resToOperator (\d+)/;
      const regex4 = /\/resToUser (\d+)/;
      const regex5 = /\/closeReq (\d+)/;
      const regex6 = /\/resumeReq (\d+)/;
      const regex7 = /\/resRole/;
      const regex8 = /\/changeRoleUser (\d+)/;
      const regex9 = /\/changeRoleOperator (\d+)/;
      const regex10 = /\/changeRoleAdmin (\d+)/;
      if (regex.test(data1)) {
        const match = data1.match(regex);
        const idMed = match[1];
        try {
          const med = await Media.findByPk(idMed);
          console.log('asdPHT')
          console.log(med)
          const pht = JSON.parse(med.idMedia);
          await bot.sendMediaGroup(chatId, pht.map(photo => ({
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
        const userName = msg.from.first_name
        MethodToOperator(userRequestId, userName, chatId);
        await bot.answerCallbackQuery(callbackQueryId);
      }
      if (regex1.test(data1)) {
        const match = data1.match(regex1);
        const userRequestId = match[1];
        const userName = msg.from.first_name
        MethodToUser(userRequestId, userName, chatId);
        await bot.answerCallbackQuery(callbackQueryId);
      }
      if (regex3.test(data1)) {
        const match = data1.match(regex3);
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
              if (reply === 'Стоп' || reply === 'стоп') {
                await bot.sendMessage(userId, 'Хорошо');
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

                await bot.sendMessage(messages[0].operatorId, `Пришел ответ от пользователя на заявку №${userRequestId}`, {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: 'Пришел ответ от пользователя', web_app: { url: appUrl + `/InlinerequestsOperator/${userRequestId}` } }],
                      [{ text: 'Ответить', callback_data: `/resToUserPhoto ${userRequestId}` }]
                    ]
                  }
                });
                bot.sendMessage(userId, 'Ответ успешно добавлен.');
              }
            }
          };

          bot.on('text', textHandler);

        } catch (error) {
          console.log(error);
        }
      }
      if (regex4.test(data1)) {
        const match = data1.match(regex4);
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
              if (reply === 'Стоп' || reply === 'стоп') {
                await bot.sendMessage(userId, 'Хорошо');
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
                const status = 'Заявка в обработке';
                await dbManager.changeStatusRes(requestId, status);
                const message = `Заявка №${requestId} в обработке`;
                await sendMessagesToUsersWithRoleId(message, requestId);
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

              bot.sendMessage(messages[0].UserRequest.User.telegramId, `Вам пришел ответ на вашу заявку №${requestId}`, {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: 'Ваша Заявка', web_app: { url: appUrl + `/Inlinerequests/${requestId}` } }],
                    [{ text: 'Ответить', callback_data: `/resToOperatorPhoto ${requestId}` }]
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
      }
      if (regex5.test(data1)) {
        const match = data1.match(regex5);
        const userId = msg.from.id;
        const requestId = match[1];

        await CloseReq(requestId, userId)
      }
      if (regex6.test(data1)) {
        const match = data1.match(regex6);
        const userId = msg.from.id;
        const requestId = match[1];
        await ResumeReq(requestId)
        await bot.answerCallbackQuery(callbackQueryId);
      }
      if (regex7.test(data1)) {
        const match = data1.match(regex7);
        const userId = msg.from.id;
        try {
          const userId = msg.from.id;
          waitingUsers[userId] = true;

          await bot.sendMessage(userId, 'Введите ID-телеграма пользователя:');
          const textHandler = async (response) => {
            if (userId === response.from.id && waitingUsers[userId]) {
              waitingUsers[userId] = false;
              bot.off('text', textHandler);
              const chatId = response.text;

              if (!isNaN(chatId)) {
                const user = await User.findOne({ where: { telegramId: chatId.toString() } });

                if (!user) {
                  await bot.sendMessage(userId, 'Пользователь не найден.');
                  return;
                }

                let keyboard = [];

                if (user.RoleId == '2') {
                  keyboard = [
                    [{ text: 'Администратор', callback_data: `/changeRoleAdmin ${chatId}` }, { text: 'Оператор', callback_data: `/changeRoleOperator ${chatId}` }]
                  ];
                } else if (user.RoleId == '1') {
                  keyboard = [
                    [{ text: 'Пользователь', callback_data: `/changeRoleUser ${chatId}` }, { text: 'Оператор', callback_data: `/changeRoleOperator ${chatId}` }]
                  ];
                } else if (user.RoleId == '3') {
                  keyboard = [
                    [{ text: 'Администратор', callback_data: `/changeRoleAdmin ${chatId}` }, { text: 'Пользователь', callback_data: `/changeRoleUser ${chatId}` }]
                  ];
                }

                await bot.sendMessage(userId, `Чтобы изменить роль пользователю выберете роль`, {
                  reply_markup: {
                    inline_keyboard: keyboard
                  }
                });
              } else {
                bot.sendMessage(userId, 'Ошибка: Введенное значение не соответствует ожидаемому формату ID-телеграма. Пожалуйста, введите корректный ID пользователя.');
              }
            }
          }
        } catch (e) {
          console.log(e)
        }

      }
      if (regex8.test(data1)) {
        const match = data1.match(regex8);
        const chatId = msg.from.id;
        const userId = match[1];
        console.log(msg)
        const chRole = dbManager.changeRoleUser(userId, 2)
        await bot.sendMessage(userId, 'Вам присвоена роль "Пользователь"');
        await bot.sendMessage(chatId, 'Роль пользователя успешно изменена');
        keyboardRole(userId)
      }
      if (regex9.test(data1)) {
        const match = data1.match(regex9);
        const chatId = msg.from.id;
        const userId = match[1];
        console.log(msg)
        const chRole = dbManager.changeRoleUser(userId, 3)
        const existingUser = await dbManager.getUserByChatId(`${userId}`);
        await bot.sendMessage(userId, 'Вам присвоена роль "Оператор"');
        await bot.sendMessage(chatId, 'Роль пользователя успешно изменена');
        await existingUser.update({ nicknameOperator: `Оператор#${existingUser.id}` })
        keyboardRole(userId)
      }
      if (regex10.test(data1)) {
        const match = data1.match(regex10);
        const chatId = msg.from.id;
        const userId = match[1];
        console.log(msg)
        const chRole = dbManager.changeRoleUser(userId, 1)
        const existingUser = await dbManager.getUserByChatId(`${userId}`);
        await bot.sendMessage(userId, 'Вам присвоена роль "Администратор"');
        await bot.sendMessage(chatId, 'Роль пользователя успешно изменена');
        await existingUser.update({ nicknameOperator: `Администратор#${existingUser.id}` })
        keyboardRole(userId)
      }
    }
  })
  // await bot.answerCallbackQuery(callbackQueryId);
};

// const botClass = new BotClass(bot)
startBot();
