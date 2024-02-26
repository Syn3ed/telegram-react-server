const { Sequelize } = require('sequelize');
require('dotenv').config(); 

const sequelize = new Sequelize({
    dialect: 'postgres', 
    host: 'localhost',   
    port: 5432,          
    username: 'postgres', 
    password: '123456789', 
    database: 'TgBotBD', 
  });

// const sequelize = new Sequelize('postgres://syne3d_user:YwvXuLjxMvufBB5w1h0jPsjLA4ztJqR0@dpg-clg7277jc5ks73ecg5n0-a.frankfurt-postgres.render.com/syne3d?ssl=true');


//
  module.exports = sequelize