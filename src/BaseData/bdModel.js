const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('./bdConnect');

const User = sequelize.define('User', {
    telegramId: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
    },
    username: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    nicknameOperator: {
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    timestamps: false,
});

const AdresPZU = sequelize.define('AdresPZU', {
    address: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
    }
}, {
    timestamps: false,
})


const UserRequest = sequelize.define('UserRequest', {
    status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'Ожидает ответа оператора',
    },
    messageReq: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    category: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    timestamps: true,
});

const Message = sequelize.define('Message', {
    operatorId: {
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    timestamps: false
});

const Role = sequelize.define('Role', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
}, {
    timestamps: false
});

const Media = sequelize.define('Media', {
    idMedia: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
    },
}, {
    timestamps: false
});


const MessageChat = sequelize.define('MessageChat', {
    textMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    idUser: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    roleUser: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    username: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    nicknameOperator: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    IdMedia: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    TimeMessages: {
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    timestamps: true
});

const OperatorReq = sequelize.define('OperatorReq', {
    IdUserRequest: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    IdUser: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    timestamps: true
});




User.belongsTo(Role)
Role.hasMany(User);

User.belongsTo(MessageChat);
MessageChat.hasMany(User);

User.hasMany(UserRequest);
UserRequest.belongsTo(User);

UserRequest.hasMany(Message);
Message.belongsTo(UserRequest);

UserRequest.hasMany(Media);
Media.belongsTo(UserRequest);

UserRequest.hasMany(MessageChat);
MessageChat.belongsTo(UserRequest);

UserRequest.hasMany(OperatorReq);
OperatorReq.belongsTo(UserRequest);

module.exports = { User, UserRequest, Message, Role, Media, MessageChat, OperatorReq, AdresPZU };
