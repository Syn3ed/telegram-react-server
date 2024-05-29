const sequelize = require('./bdConnect');
const { Message, UserRequest, User, MessageChat } = require('./bdModel');

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

  async getUserByChatId(chatId) {
    try {
      const user = await User.findOne({ where: { telegramId: chatId } });
      return user;
    } catch (error) {
      console.error('Ошибка при запросе пользователя из базы данных:', error);
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
        UserRequestId: req.id
      });
      return req
    } catch (error) {
      console.log(error);
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


  async createUserRequestMessage(UserRequestId, textMessage, idUser, roleUser, username, nicknameOperator, TimeMessages) {
    try {
      const userRequest = await UserRequest.findByPk(UserRequestId);
      if (userRequest) {
        const message = await MessageChat.create({
          textMessage,
          idUser,
          roleUser,
          UserRequestId,
          username,
          nicknameOperator,
          TimeMessages
        });

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

      return await Message.create({  UserRequestId: userRequest.id });
    } catch (error) {
      throw error;
    }
  }

  async changeRoleUser(userId, newRoleId) {
    try {
      const user = await User.findOne({ where: { telegramId: userId } })

      if (user) {
        user.RoleId = newRoleId;
        await user.save();
      }
    } catch (e) {
      console.log(e)
    }
  }

  async changeNameUser(userId ,newName){
    try {
      const user = await User.findOne({ where: { telegramId: userId } })

      if (user) {
        user.username = newName;
        await user.save();
      }
    } catch (e) {
      console.log(e)
    }
  }

  async changeStatusRes(userRequestId, newStatus) {
    try {
      const userRequest = await UserRequest.findByPk(userRequestId);
      if (userRequest) {
        userRequest.status = newStatus;
        await userRequest.save();
      }
    } catch (e) {
      console.log(`Ошибка: ${e}`);
    }
  }

  
  


}

module.exports = DatabaseService;
