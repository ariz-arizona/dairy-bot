const axios = require('axios');
const Telegraf = require('telegraf');
const session = require('telegraf/session')
const Stage = require('telegraf/stage')
const WizardScene = require('telegraf/scenes/wizard');
const Scene = require('telegraf/scenes/base')
const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');
const puppeteer = require('puppeteer');

const url = 'http://www.diary.ru/api/';
const login = 'dairy-bot';
const password = '319992738';
const urls = {
    wtf2019: 'https://wtf-2019.diary.ru/'
}
const browserArgs = {
    headless: true, args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process'
    ],
  };

const bot = new Telegraf(process.env.TOKEN)

bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err);
    ctx.reply("ERROR! LOOK LOGS PLS")
});

const wtfScene = new WizardScene(
    "wtfScene", // Имя сцены
    (ctx) => {
        ctx.reply("BEFORE ASYNC");
        (async (ctx) => {
            ctx.reply("START ASYNC");
            const browser = await puppeteer.launch(browserArgs);
            const page = await browser.newPage();
            ctx.reply("OPEN BROWSER");

            await page.goto(urls.wtf2019)
            await page.type('#user_login', login)
            await page.type('#user_pass', password)
            page.click('button[type="submit"]');
            ctx.reply("WAIT LOGIN");
            await page.waitForNavigation()
            ctx.reply("WAIT DATA");
            return ctx.wizard.next();
        })(ctx);
    },

    (ctx) => {
        (async (ctx) => {
            await browser.close();
        })(ctx);
        ctx.reply('Финальный этап: создание матча.');
        return ctx.scene.leave();
    }
);

// Создаем менеджера сцен
const stage = new Stage();

// Регистрируем сцену создания матча
stage.register(wtfScene);

bot.use(session());
bot.use(stage.middleware());
bot.command("wtfScene", (ctx) => ctx.scene.enter("wtfScene"));

bot.launch();