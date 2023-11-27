const { Sequelize } = require('sequelize');
require('dotenv').config(); 

// const sequelize = new Sequelize({
//     dialect: 'postgres', 
//     host: process.env.DB_HOST,   
//     port: process.env.DB_PORT || 5433,          
//     username: process.env.DB_USER, 
//     password: process.env.DB_PASSWORD, 
//     database: process.env.DB_NAME, 
//   });
const sequelize = new Sequelize('postgres://syne3d_user:YwvXuLjxMvufBB5w1h0jPsjLA4ztJqR0@dpg-clg7277jc5ks73ecg5n0-a/syne3d');

//
  module.exports = sequelize