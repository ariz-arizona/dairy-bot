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

function renderList(commands, curPage, pages) {
    const start = (curPage - 1) * pageSize;
    const end = curPage * pageSize;
    const btns = [];
    if (curPage > 1) {
        btns.push(Markup.callbackButton('Назад', `back`))
    }
    if (curPage <= pages - 1) {
        btns.push(Markup.callbackButton('Вперед', `next`))
    }
    return [
        commands.slice(start, end).map((el, i) => `<b>${start + i}</b> -- ${el.name}`).join(`\n`),
        {
            parse_mode: 'HTML',
            reply_markup: Markup.inlineKeyboard(btns)
        }
    ]
}

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
        const { curPage, pages, commands } = ctx.session;
        const response = renderList(commands, curPage, pages);
        ctx.reply(response[0], response[1]);
    })(ctx)
})
wtfScene.leave((ctx) => {
    (async (ctx) => {
        await browser.close();
        ctx.reply("CLOSE BROWSER");
    })(ctx);
});


wtfScene.action('back', ctx => {
    const { curPage: oldCurPage, commands, pages } = ctx.session;
    ctx.session.curPage = oldCurPage - 1;
    const { curPage } = ctx.session;
    const response = renderList(commands, curPage, pages);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action('next', ctx => {
    const { curPage: oldCurPage, commands, pages } = ctx.session;
    ctx.session.curPage = oldCurPage + 1;
    const { curPage } = ctx.session;
    const response = renderList(commands, curPage, pages);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.hears(/\d{1,}/gi, ctx => {
    (async (ctx) => {
        const value = ctx.match[0];
        const { commands, textTag } = ctx.session;
        if (!commands[value]) {
            ctx.reply('Нет такой команды')
        } else {
            ctx.reply(`Вы выбрали команду ${commands[value].name}`);
            const page = await browser.newPage();
            page.goto(`${urls.wtf2019}?tag%5B%5D=${textTag}&tag%5B%5D=${commnds[value].name}`);
            await page.waitForNavigation();
            const result = await page.evaluate(() => {
                return JSON.stringify(document.body).slice(0, 4000);
            });
            ctx.reply(result);
        }
    })(ctx);
})

// Регистрируем сцену создания матча
stage.register(wtfScene);
stage.command('cancel', leave())

bot.command("wtfScene", (ctx) => ctx.scene.enter("wtfScene"));
bot.launch();