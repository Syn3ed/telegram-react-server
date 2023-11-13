const sequelize = require('./bdConnect');
const { Message, UserRequest } = require('./bdModel');

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

  async createUserRequest(telegramId, status, messageReq, category) {
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
        UserId: userId.id
      });
      await Message.create({
        text: `${userName}:\n${messageReq}`,
        UserRequestId: req.id
      });
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
}

module.exports = DatabaseService;
