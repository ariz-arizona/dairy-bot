const axios = require('axios');
const Telegraf = require('telegraf');
const session = require('telegraf/session')
const Stage = require('telegraf/stage')
const { leave } = Stage
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
const pageSize = 20;

const bot = new Telegraf(process.env.TOKEN)
const stage = new Stage();

bot.use(session());
bot.use(stage.middleware());

bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err);
    ctx.reply("ERROR! LOOK LOGS PLS")
});
let browser;
const wtfScene = new Scene('wtfScene');
wtfScene.enter((ctx) => {
    (async (ctx) => {
        browser = await puppeteer.launch(browserArgs);
        const page = await browser.newPage();
        ctx.reply("OPEN BROWSER");

        await page.goto(`${urls.wtf2019}?tags=`)
        await page.type('#user_login', login)
        await page.type('#user_pass', password)
        page.click('#inform_box button');
        ctx.reply("WAIT LOGIN");
        await page.waitForNavigation()
        ctx.reply("WAIT DATA");

        const result = await page.evaluate(() => {
            const commands = [];
            let textTag = '';
            const links = document.querySelectorAll('a[id*=tag]');
            for (const link of links) {
                const name = link.innerText;
                const id = link.href.replace('?tag=', '');
                if (name.indexOf('WTF') !== -1) {
                    commands.push({ id, name })
                }
                if (name === 'тексты') {
                    textTag = id;
                }
            }
            return { commands, textTag };
        });
        ctx.session.commands = result.commands;
        ctx.session.textTag = result.textTag;
        ctx.session.curPage = 1;
        ctx.session.pages = Math.ceil(result.commands.length / pageSize);
        const { curPage } = ctx.session;
        ctx.reply(`FIND ${result.commands.length}`);
        ctx.reply(
            result.commands.slice((curPage - 1) * pageSize, pageSize).map((el, i) => `<b>${i}</b> -- ${el.name}`).join(`\n`),
            {
                parse_mode: 'HTML',
                reply_markup: Markup.inlineKeyboard(
                    [Markup.callbackButton('Назад', `back`), Markup.callbackButton('Вперед', `next`)]
                )
            }
        );
    })(ctx)
})
wtfScene.leave((ctx) => {
    (async (ctx) => {
        await browser.close();
    })(ctx);
});


wtfScene.action('back', ctx => {
    const { curPage: oldCurPage, commands } = ctx.session;
    ctx.session.curPage = oldCurPage - 1;
    const { curPage } = ctx.session;
    const start = (curPage - 1) * pageSize;
    const end = curPage * pageSize;
    ctx.editMessageText(
        commands.slice(start, end).map((el, i) => `<b>${i}</b> -- ${el.name}`).join(`\n`),
        {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard(
                [Markup.callbackButton('Назад', `back`), Markup.callbackButton('Вперед', `next`)]
            )
        }
    )
})

wtfScene.action('next', ctx => {
    const { curPage: oldCurPage, commands } = ctx.session;
    ctx.session.curPage = oldCurPage + 1;
    const { curPage } = ctx.session;
    const start = (curPage - 1) * pageSize;
    const end = curPage * pageSize;
    ctx.editMessageText(
        commands.slice(start, end).map((el, i) => `<b>${i}</b> -- ${el.name}`).join(`\n`),
        {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard(
                [Markup.callbackButton('Назад', `back`), Markup.callbackButton('Вперед', `next`)]
            )
        }
    )
})

// Регистрируем сцену создания матча
stage.register(wtfScene);
stage.command('cancel', leave())

bot.command("wtfScene", (ctx) => ctx.scene.enter("wtfScene"));
bot.launch();