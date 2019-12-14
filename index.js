const axios = require('axios');
const puppeteer = require('puppeteer');
const Telegraf = require('telegraf');
const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');

const url = 'http://www.diary.ru/api/';

const bot = new Telegraf(process.env.TOKEN)


bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err);
    ctx.reply("ERROR! LOOK LOGS PLS")
  });
  

bot.start((ctx) => ctx.reply('Привет :)'))

bot.hears('hi', (ctx) => ctx.reply('HALLO!'));

bot.hears('diary', ctx => {
    axios.get(url, {
        method: 'user.auth',
        username: 'aarizona',
        password: 'Adinfinitum1'
    }).then(result => {
        ctx.reply(JSON.stringify(result));
    }).catch(error => {
        ctx.reply(JSON.stringify(error));
    })
})

bot.launch()