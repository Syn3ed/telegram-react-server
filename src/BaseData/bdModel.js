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
    operatorId:{
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


const MessageChat = sequelize.define('MessageChat',{
    textMessage:{
        type: DataTypes.STRING,
        allowNull: false,
    },
    idUser:{
        type: DataTypes.STRING,
        allowNull: false,
    },
    roleUser:{
        type: DataTypes.STRING,
        allowNull: false,
    },
},{
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

module.exports ={ User,UserRequest,Message,Role,Media,MessageChat};
