const sequelize = require('./bdConnect');
const { Message, UserRequest, User,MessageChat } = require('./bdModel');

class DatabaseService {
  constructor(sequelize) {
    this.sequelize = sequelize;
  }

  async createRole(name) {
    try {
      const Role = this.sequelize.models.Role;
      return await Role.create({ name });
    } catch (error) {
      throw error;
    }
  }


  async createUserWithRole(telegramId, username, roleName) {
    try {
      const User = this.sequelize.models.User;
      const Role = this.sequelize.models.Role;
      const role = await Role.findOne({ where: { name: roleName } });

      if (!role) {
        throw new Error(`Роль с именем ${roleName} не найдена.`);
      }
      return await User.create({ telegramId, username, RoleId: role.id });
    } catch (error) {
      throw error;
    }
  }

  async findToRole(nameRole) {
    try {
      const Role = this.sequelize.models.Role;
      const operatorRole = await Role.findOne({ where: { name: `${nameRole}` } });
      console.log(operatorRole)
      return operatorRole
    } catch (e) {
      throw (e)
    }
  }

  async findToUserForRole(operatorRole) {
    try {
      const User = this.sequelize.models.User;
      const operatorUsers = await User.findAll({ where: { RoleId: operatorRole.id } });
      return operatorUsers
    } catch (e) {
      throw (e)
    }
  }


  async createUserRequest(telegramId, status, messageReq, category, address) {
    try {
      const User = this.sequelize.models.User;
      const UserRequest = this.sequelize.models.UserRequest;
      const Message = this.sequelize.models.Message
      const userId = await User.findOne({ where: { telegramId } })
      const userName = userId.username
      if (!userId) {
        throw new Error(`Пользователь с telegramId ${telegramId} не найден.`);
      }
      const req = await UserRequest.create({
        status,
        messageReq,
        category,
        address,
        UserId: userId.id
      });
      await Message.create({
        text: `${userName}:\n${messageReq}`,
        UserRequestId: req.id
      });
      return req
    } catch (error) {
      console.log(error);
    }
  }
  async ReplyToRequest(UserReqId, reply) {
    try {
      const message = await Message.findOne({ where: { UserRequestId: UserReqId } });
      if (!message) {
        console.log('Сообщение не найдено.');
        return;
      }
      const updatedText = `${message.text}\n${reply}`;
      await message.update({ text: updatedText });
      console.log('Ответ успешно добавлен к заявке.');
    } catch (error) {
      console.error('Ошибка при добавлении ответа к заявке:', error);
    }
  }

  async findUserToReq(UserReqId) {
    try {
      const userRequest = await UserRequest.findOne({
        where: { id: UserReqId },
        include: [{ model: User, attributes: ['telegramId'] }]
      });
      if (userRequest && userRequest.User) {
        const telegramId = userRequest.User.telegramId;
        return telegramId;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  async findReq(UserReqId) {
    try {
      const userRequest = await UserRequest.findByPk(UserReqId);

      if (userRequest) {
        return userRequest;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Ошибка при поиске заявки:', error);
      return null;
    }
  }


  async createUserRequestMessage(UserRequestId, textMessage, idUser, roleUser,username,TimeMessages) {
    try {
      const userRequest = await UserRequest.findByPk(UserRequestId);
      if(userRequest){
        const message = await MessageChat.create({
          textMessage,
          idUser,
          roleUser,
          UserRequestId,
          username,
          TimeMessages
        });

        console.log(`Создано сообщение для заявки с id ${UserRequestId}: ${message.textMessage}`);
      }
    } catch (error) {
      console.error('Ошибка при создании сообщения для заявки:', error);
    }
  }


  async createMessage(userRequestId, text) {
    try {
      const UserRequest = this.sequelize.models.UserRequest;
      const Message = this.sequelize.models.Message;

      const userRequest = await UserRequest.findByPk(userRequestId);

      if (!userRequest) {
        throw new Error(`Запрос пользователя с ID ${userRequestId} не найден.`);
      }

      return await Message.create({ text, UserRequestId: userRequest.id });
    } catch (error) {
      throw error;
    }
  }

  async changeRoleUser(userId, newRoleId) {
    try {
      const user = await User.findOne({where:{telegramId:userId}})

      if (user) {
        user.RoleId = newRoleId;
        await user.save();
      }
    } catch (e) {

    }
  }

  async changeStatusRes(userRequestId, newStatus) {
    try {
      const userRequest = await UserRequest.findByPk(userRequestId);
      if (userRequest) {
        userRequest.status = newStatus;
        await userRequest.save();
        console.log(`Статус заявки с ID ${userRequestId} успешно изменен.`);
      }
    } catch (e) {
      console.log(`Ошибка: ${e}`);
    }
  }

  async replyToUser(messageId, newText, newOperatorId) {
    try {
      const existingMessage = await Message.findByPk(messageId);

      if (!existingMessage) {
        console.error('Сообщение не найдено.');
        return;
      }

      const operator = `\nОператор:\n` + newText
      existingMessage.text = (existingMessage.text || '') + (operator || '');
      existingMessage.operatorId = newOperatorId || existingMessage.operatorId;

      await existingMessage.save();

      console.log('Сообщение успешно обновлено:', existingMessage);

      return existingMessage;
    } catch (error) {
      console.error('Ошибка при обновлении сообщения:', error);
      throw error;
    }
  }
  async replyToOperator(messageId, newText, data) {
    try {
      const existingMessage = await Message.findByPk(messageId);

      if (!existingMessage) {
        throw new Error('Сообщение не найдено.');
      }

      const user = data[0]?.UserRequest?.User?.username;
      const userText = `\n${user}:\n${newText}`;

      existingMessage.text = (existingMessage.text || '') + userText;
      await existingMessage.save();

      //  console.log('Сообщение успешно обновлено:', existingMessage);
      return existingMessage;
    } catch (error) {
      throw error;
    }
  }


}

module.exports = DatabaseService;
