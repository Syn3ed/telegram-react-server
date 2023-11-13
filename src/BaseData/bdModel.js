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
    }
}, {
    timestamps: false,
});

const Message = sequelize.define('Message', {
    text: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
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

User.belongsTo(Role);
Role.hasMany(User);

User.hasMany(UserRequest);
UserRequest.belongsTo(User);

UserRequest.hasMany(Message);
Message.belongsTo(UserRequest);


module.exports ={ User,UserRequest,Message,Role};
