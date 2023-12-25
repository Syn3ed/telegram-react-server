const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('./bdConnect');

const User = sequelize.define('User', {
    telegramId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    username: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    timestamps: false,
});

const UserRequest = sequelize.define('UserRequest', {
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'ожидает ответа оператора',
    },
    messageReq: {
        type: DataTypes.STRING,
        allowNull: true
    },
    category: {
        type: DataTypes.STRING,
        allowNull: true
    },
    address: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    timestamps: false,
});

const Message = sequelize.define('Message', {
    text: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
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
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
}, {
    timestamps: false
});


const MessageChat = sequelize.define('MessageChat', {
    textMessage: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    idUser: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    roleUser: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    username: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    IdMedia:{
        type: DataTypes.STRING,
        allowNull: true,
    },
    TimeMessages:{
        type: DataTypes.STRING,
        allowNull: true,
    }
}, {
    timestamps: true
});

const OperatorReq = sequelize.define('OperatorReq', {
    IdUserRequest: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    IdUser: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    timestamps: true
});




User.belongsTo(Role);
Role.hasMany(User);

User.hasMany(UserRequest);
UserRequest.belongsTo(User);

UserRequest.hasMany(Message);
Message.belongsTo(UserRequest);

UserRequest.hasMany(Media);
Media.belongsTo(UserRequest);

UserRequest.hasMany(MessageChat);
MessageChat.belongsTo(UserRequest);

UserRequest.hasMany(Media);
Media.belongsTo(UserRequest);

UserRequest.hasMany(OperatorReq);
OperatorReq.belongsTo(UserRequest);

module.exports = { User, UserRequest, Message, Role, Media, MessageChat,OperatorReq};
