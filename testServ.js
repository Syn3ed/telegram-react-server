const express = require('express');
const bodyParser = require('body-parser');
const { User, UserRequest, Message, Role } = require('./src/BaseData/bdModel');
const sequelize = require('./src/BaseData/bdConnect');
const app = express();
const PORT = process.env.PORT || 3001;

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
            where: { status:stat },
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

connectToDatabase();
