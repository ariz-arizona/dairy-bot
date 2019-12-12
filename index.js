const axios = require('axios');
const puppeteer = require('puppeteer');

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
    }).catch(error => {
        ctx.reply(JSON.stringify(error));
    })
})
bot.hears('beetle', ctx => {
    async function main() {
        const browser = await puppeteer.launch({
            headless: true, args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        })
        
        const page = await browser.newPage()
        await page.goto('https://911911.org/oper/login')
        await page.type('#formoperlogin-login', 'a.pluta')
        await page.type('#formoperlogin-password', '71284198')
        await page.click('button[type="submit"]')
        await page.waitForNavigation()
        ctx.reply(page.url());
    }
    main();
})
bot.launch()