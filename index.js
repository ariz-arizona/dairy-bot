const token = '1023369485:AAE0nFWhuBO-al13tMM8ULsYERw3RelGrHc';
const Telegraf = require('telegraf')

const bot = new Telegraf(token)
bot.start((ctx) => ctx.reply('Welcome!'))
bot.help((ctx) => ctx.reply('Send me a sticker'))
bot.on('sticker', (ctx) => ctx.reply('👍'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))
bot.launch()