// bot.onText(/\/closeReq (\d+)/, async (msg, match) => {
//     const userId = msg.from.id;
//     const requestId = match[1];

//     try {
//       const status = 'Заявка закрыта!';
//       await dbManager.changeStatusRes(requestId, status);
//       const messages = await Message.findAll({
//         where: { id: requestId },
//         include: [
//           {
//             model: UserRequest,
//             include: [
//               {
//                 model: User,
//                 attributes: ['username', 'address', 'telegramId']
//               }
//             ]
//           }
//         ]
//       });
//       if (userId === messages[0].UserRequest.User.telegramId) {
//         bot.sendMessage(userId, `Вы закрыли заявку №${requestId}`);
//         await bot.sendMessage(messages[0].operatorId, `Пользователь закрыл заявку №${requestId}`);
//       } else {
//         bot.sendMessage(userId, `Вы закрыли заявку №${requestId} !`);
//         bot.sendMessage(messages[0].UserRequest.User.telegramId, `Оператор закрыл вашу заявку №${requestId}`)
//       }
//     } catch (e) {
//       console.log(e)
//     }
//   })

//   bot.onText(/\/resToUser (\d+)/, async (msg, match) => {
//     const userId = msg.from.id;
//     const requestId = match[1];

//     try {
//       const userRequest = await dbManager.findReq(requestId);
//       if (!userRequest) {
//         bot.sendMessage(userId, 'Заявка не найдена.');
//         return;
//       }

//       waitingUsers[userId] = true;

//       await bot.sendMessage(userId, 'Введите сообщение:');

//       const textHandler = async (response) => {
//         if (userId === response.from.id && waitingUsers[userId]) {
//           waitingUsers[userId] = false;
//           bot.off('text', textHandler);
//           const reply = response.text;

//           const timeData = new Date();
//           const year = timeData.getFullYear();
//           const month = timeData.getMonth() + 1; // Месяцы в JavaScript начинаются с 0
//           const day = timeData.getDate();
//           timeData.setHours(timeData.getHours() + 4); // добавляем 4 часа
//           const hours = timeData.getHours();
//           const minutes = timeData.getMinutes();
//           const formattedHours = hours < 10 ? '0' + hours : hours;
//           const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

//           const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}.`

//           await dbManager.createUserRequestMessage(requestId, reply, userId, 'Operator', 'Оператор', timeMess);
//           await OperatorReq.create({
//             IdRequest: requestId,
//             idUser: userId
//           });

//           const userRequestStatus = await UserRequest.findByPk(requestId);
//           if (userRequestStatus.status === 'ожидает ответа оператора') {
//             const status = 'Заявка в обработке!';
//             await dbManager.changeStatusRes(requestId, status);
//             const message = `Заявка под номером ${requestId} в обработке`;
//             await commandHandler.sendMessagesToUsersWithRoleId(message, requestId);
//           }
//           const existingMessage = await Message.findByPk(requestId);
//           existingMessage.operatorId = userId;
//           await existingMessage.save();

//           const userTelegramId = await dbManager.findUserToReq(requestId);

//           const messages = await Message.findAll({
//             where: { id: requestId },
//             include: [
//               {
//                 model: UserRequest,
//                 include: [
//                   {
//                     model: User,
//                     attributes: ['username', 'address', 'telegramId']
//                   }
//                 ]
//               }
//             ]
//           });

//           bot.sendMessage(messages[0].UserRequest.User.telegramId, `Вам пришел ответ на вашу заявку под номером ${requestId}`, {
//             reply_markup: {
//               inline_keyboard: [
//                 [{ text: 'Ваша Заявка', web_app: { url: appUrl + `/Inlinerequests/${requestId}` } }]
//               ]
//             }
//           });

//           bot.sendMessage(userId, 'Ответ успешно добавлен.');
//         }
//       };

//       bot.on('text', textHandler);
//     } catch (error) {
//       console.error('Ошибка при ответе на заявку:', error);
//       bot.sendMessage(userId, 'Произошла ошибка при ответе на заявку.');
//     }
//   });



//   bot.onText(/\/resToOperatorPhoto (\d+)/, async (msg, match) => {
//     const userRequestId = match[1];
//     const userId = msg.from.id;
//     const chatId = msg.from.id;
//     const userName = msg.from.first_name
//     try {
//       await bot.sendMessage(msg.chat.id, 'Прикрепите файл:');

//       waitingUsers[userId] = true;
//       const textHandler = async (response) => {
//         if (userId === response.from.id && waitingUsers[userId]) {
//           // waitingUsers[userId] = false;
//           // bot.off('photo', textHandler);
//           const reply = response;

//           // if (!reply || !reply.photo || !reply.photo[0]) {
//           //   throw new Error('Не удалось получить фотографию.');
//           // }

//           // const photo = reply.photo[0];
//           // const fileId = reply.photo[0].file_id;
//           // const mediaRecord = await createMediaRecord(userRequestId, fileId);

//           const timeData = new Date();
//           const year = timeData.getFullYear();
//           const month = timeData.getMonth() + 1;
//           const day = timeData.getDate();
//           timeData.setHours(timeData.getHours() + 4);
//           const hours = timeData.getHours();
//           const minutes = timeData.getMinutes();
//           const formattedHours = hours < 10 ? '0' + hours : hours;
//           const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

//           const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}.`
//           if (reply.photo) {
//             userPhotos[chatId] = userPhotos[chatId] || [];
//             userPhotos[chatId].push({
//               type: 'photo',
//               media: reply.photo[0].file_id,
//               mediaGroupId: reply.media_group_id
//             });
//             console.log('Получена фотография:');
//             console.log(userPhotos[chatId]);
//           } else if (reply.document) {
//             userPhotos[chatId].push({
//               type: 'document',
//               media: reply.document.file_id,
//               mediaGroupId: reply.media_group_id
//             });
//           } else if (reply.video) {
//             userPhotos[chatId].push({
//               type: 'video',
//               media: reply.video.file_id,
//               mediaGroupId: reply.media_group_id
//             });
//           }
//           // await MessageChat.create({
//           //   IdMedia: mediaRecord.id,
//           //   roleUser: 'Operator',
//           //   username: 'Оператор',
//           //   UserRequestId: userRequestId,
//           //   TimeMessages: timeMess,
//           // })
//           if (!sentMediaGroups[chatId]) {

//             setTimeout(() => {
//               const op = 'User'
//               const useName = 'Оператор'
//               sendMediaGroup(chatId, userName, userRequestId, timeMess,);
//               waitingUsers[userId] = false;
//               bot.off('message', textHandler);
//               bot.sendMessage(msg.chat.id, `Файл успешно добавлен к заявке №${userRequestId}`);
//             }, 1000);
//             sentMediaGroups[chatId] = true;
//           }

//           if (!reply || !reply.photo || !reply.photo[0]) {
//             throw new Error('Не удалось получить фотографию.');
//           }


//           // await bot.sendMessage(msg.chat.id, `Файл успешно добавлен к заявке №${userRequestId}`);
//         }
//       };
//       bot.on('message', textHandler);
//     } catch (error) {
//       console.error('Ошибка при обработке команды /resToOperatorPhoto:', error);
//     }
//   });

//   bot.onText(/\/resToUserPhoto (\d+)/, async (msg, match) => {
//     const userRequestId = match[1];
//     const userId = msg.from.id;
//     const chatId = msg.from.id;
//     const userName = msg.from.first_name
//     try {
//       await bot.sendMessage(msg.chat.id, 'Прикрепите файл:');

//       waitingUsers[userId] = true;
//       const textHandler = async (response) => {
//         if (userId === response.from.id && waitingUsers[userId]) {
//           // waitingUsers[userId] = false;
//           // bot.off('photo', textHandler);
//           const reply = response;

//           // if (!reply || !reply.photo || !reply.photo[0]) {
//           //   throw new Error('Не удалось получить фотографию.');
//           // }

//           // const photo = reply.photo[0];
//           // const fileId = reply.photo[0].file_id;
//           // const mediaRecord = await createMediaRecord(userRequestId, fileId);

//           const timeData = new Date();
//           const year = timeData.getFullYear();
//           const month = timeData.getMonth() + 1;
//           const day = timeData.getDate();
//           timeData.setHours(timeData.getHours() + 4);
//           const hours = timeData.getHours();
//           const minutes = timeData.getMinutes();
//           const formattedHours = hours < 10 ? '0' + hours : hours;
//           const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

//           const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}.`
//           if (reply.photo) {
//             userPhotos[chatId] = userPhotos[chatId] || [];
//             userPhotos[chatId].push({
//               type: 'photo',
//               media: reply.photo[0].file_id,
//               mediaGroupId: reply.media_group_id
//             });
//             console.log('Получена фотография:');
//             console.log(userPhotos[chatId]);
//           } else if (reply.document) {
//             userPhotos[chatId].push({
//               type: 'document',
//               media: reply.document.file_id,
//               mediaGroupId: reply.media_group_id
//             });
//           } else if (reply.video) {
//             userPhotos[chatId].push({
//               type: 'video',
//               media: reply.video.file_id,
//               mediaGroupId: reply.media_group_id
//             });
//           }


//           if (!sentMediaGroups[chatId] && !reply?.text) {

//             setTimeout(() => {
//               const op = 'Operator'
//               const useName = 'Оператор'
//               sendMediaGroup(chatId, useName, userRequestId, timeMess,);
//               waitingUsers[userId] = false;
//               bot.off('message', textHandler);
//               bot.sendMessage(msg.chat.id, `Файл успешно добавлен к заявке №${userRequestId}`);
//             }, 1000);
//             sentMediaGroups[chatId] = true;
//           }

//           if (!reply || !reply.photo || !reply.photo[0]) {
//             throw new Error('Не удалось получить фотографию.');
//           }


//           // await bot.sendMessage(msg.chat.id, `Файл успешно добавлен к заявке №${userRequestId}`);
//         }
//       };
//       bot.on('message', textHandler);
//     } catch (error) {
//       console.error('Ошибка при обработке команды /resToOperatorPhoto:', error);
//     }
//   });



//   bot.onText(/\/handleShowPhoto (\d+)/, async (msg, match) => {
//     const idMed = match[1];
//     try {
//       const med = await Media.findByPk(idMed);
//       await bot.sendPhoto(msg.chat.id, med.idMedia);
//     } catch (e) {
//       console(e)
//     }
//   });



//   bot.onText(/\/resToOperator (\d+)/, async (msg, match) => {
//     const userRequestId = match[1];
//     const userId = msg.from.id;
//     const username = msg.from.first_name

//     try {
//       const userRequest = await dbManager.findReq(userRequestId);
//       if (!userRequest) {
//         bot.sendMessage(userId, 'Заявка не найдена.');
//         return;
//       }

//       waitingUsers[userId] = true;

//       await bot.sendMessage(userId, 'Введите сообщение:');

//       const textHandler = async (response) => {
//         if (userId === response.from.id && waitingUsers[userId]) {
//           waitingUsers[userId] = false;
//           bot.off('text', textHandler);
//           const reply = response.text;
//           const messages = await Message.findAll({
//             where: { id: userRequestId },
//             include: [
//               {
//                 model: UserRequest,
//                 include: [
//                   {
//                     model: User,
//                     attributes: ['username', 'address', 'telegramId']
//                   }
//                 ]
//               }
//             ]
//           });

//           const timeData = new Date();
//           const year = timeData.getFullYear();
//           const month = timeData.getMonth() + 1;
//           const day = timeData.getDate();
//           timeData.setHours(timeData.getHours() + 4);
//           const hours = timeData.getHours();
//           const minutes = timeData.getMinutes();
//           const formattedHours = hours < 10 ? '0' + hours : hours;
//           const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

//           const timeMess = `${formattedHours}:${formattedMinutes} ${day}.${month}.${year}.`

//           await dbManager.createUserRequestMessage(userRequestId, reply, userId, 'User', username, timeMess);

//           await bot.sendMessage(messages[0].operatorId, 'Пришел ответ от пользователя', {
//             reply_markup: {
//               inline_keyboard: [
//                 [{ text: 'Пришел ответ от пользователя', web_app: { url: appUrl + `/InlinerequestsOperator/${userRequestId}` } }]
//               ]
//             }
//           });
//           bot.sendMessage(userId, 'Ответ успешно добавлен.');
//         }
//       };

//       bot.on('text', textHandler);

//     } catch (error) {
//       console.log(error);
//     }
//   });

