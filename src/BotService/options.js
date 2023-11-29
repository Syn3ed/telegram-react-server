
require('dotenv').config();
const appUrl = process.env.WEB_APP_URL;
module.exports = {
    menuMain: {
        reply_markup: ({
            inline_keyboard: [
                [{ text: 'Adres', callback_data: '/webadres' }, { text: '*test*2', callback_data: '2' }],
                [{ text: 'Дальше', callback_data: '/left' }],
                [{ text: 'Закрыть меню', callback_data: '/delete' }],
            ]
        })
    },
    menuSecond: {
        reply_markup: ({
            inline_keyboard: [
                [{ text: '*test1*', callback_data: '1' }, { text: '*test*2', callback_data: '2' }],
                [{ text: '*test3', callback_data: '3' }],
                [{ text: 'Назад', callback_data: '/back' }],
                [{ text: 'Закрыть меню', callback_data: '/delete' }]
            ]
        })
    },
    menuSite: {
        reply_markup: ({
            inline_keyboard: [
                [{text: `Ваши Заявки`, web_app: { url: appUrl } }]
            ]
        })
    },
   menuKeyboard: {
        reply_markup: {
            keyboard: [
                [{ text: 'Мои заявки', callback_data: '/webg' }, { text: 'Контакты', callback_data: '/webadres' }],
                [{text: `Ваши Заявки`, web_app: { url: appUrl } },{text:'test',web_app: { url: appUrl }}]
            ]
        }
    },
    menuKeyboardRemove: {
        reply_markup: {
            remove_keyboard: true
        }
    },
    comandBot: [
        { command: '/start', description: 'Начальное приветствие' },
        { command: `/menu`, description: `Запуск меню` },
    ]
}