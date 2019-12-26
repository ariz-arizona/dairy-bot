const axios = require('axios');
const Telegraf = require('telegraf');
const session = require('telegraf/session')
const Stage = require('telegraf/stage')
const Scene = require('telegraf/scenes/base')
const puppeteer = require('puppeteer');
const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');

const url = 'http://www.diary.ru/api/';
const login = 'dairy-bot';
const password = '319992738';
const urls = {
    wtf2019: 'https://wtf-2019.diary.ru/'
}

const { leave } = Stage;
const bot = new Telegraf(process.env.TOKEN)

bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err);
    ctx.reply("ERROR! LOOK LOGS PLS")
});

// Greeter scene
const wtfScene = new Scene('wtfScene')
let browser;
wtfScene.enter((ctx) => {
    ctx.reply('WTF Hi');
    (async () => {
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        });

        const page = await browser.newPage();
        ctx.reply('test')
        await page.goto(urls.wtf2019)
        await page.type('#user_login', login)
        await page.type('#user_pass', password)
        page.click('.btn[type="submit"]');
        await page.waitForNavigation();
        const result = await page.evaluate(() => {
            return document.body.toString.split(0, 400);
        })
        ctx.reply(result);
    })();
})
wtfScene.leave((ctx) => {
    ctx.reply('WTF Bye')
        (async () => {
            await browser.close()
        })()
})
wtfScene.hears(/hi/gi, leave())
wtfScene.on('message', (ctx) => ctx.reply('Send `hi`'))

// Create scene manager
const stage = new Stage()
stage.command('cancel', ctx=> leave(ctx))

// Scene registration
stage.register(wtfScene)

bot.use(session())
bot.use(stage.middleware())
bot.command('wtf2019', (ctx) => ctx.scene.enter('wtfScene'))
bot.startPolling()