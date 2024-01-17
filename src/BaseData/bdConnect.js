const { Sequelize } = require('sequelize');
require('dotenv').config(); 

// const sequelize = new Sequelize({
//     dialect: 'postgres', 
//     host: 'dpg-clg7277jc5ks73ecg5n0-a',   
//     port: 5432,          
//     username: 'syne3d_user', 
//     password: 'YwvXuLjxMvufBB5w1h0jPsjLA4ztJqR0', 
//     database: 'syne3d', 
//   });
const sequelize = new Sequelize('postgres://syne3d_user:YwvXuLjxMvufBB5w1h0jPsjLA4ztJqR0@dpg-clg7277jc5ks73ecg5n0-a.frankfurt-postgres.render.com/syne3d', { dialectOptions: {}, ssl: false });

//
  module.exports = sequelize