const axios = require('axios');
const superagent = require('superagent');

const Telegraf = require('telegraf')
const token = '1023369485:AAE0nFWhuBO-al13tMM8ULsYERw3RelGrHc';
const url = 'http://www.diary.ru/api/';

const bot = new Telegraf(token)
bot.start((ctx) => ctx.reply('Привет :)'))
bot.hears('hi', (ctx) => ctx.reply('HALLO!'));
bot.hears('diary', ctx => {
    axios.get(url, {
        method: 'user.auth',
        username: 'aarizona',
        password: 'Adinfinitum1'
    }).then(result => {
        ctx.reply(JSON.stringify(result));
    }).catch(error=>{
        ctx.reply(JSON.stringify(error));
    })
})
bot.hears('beetle', ctx=>{
    superagent
  .post('https://911911.org/oper/login')
  .send({ 'FormOperLogin[login]': 'a.pluta', 'FormOperLogin[password]': '71284198' }) // sends a JSON post body
  .end((err, res) => {
    ctx.reply(JSON.stringify(res));
    ctx.reply(JSON.stringify(err));
  });
})
bot.launch()