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

function renderList(commands, curPage, pages, addSymbol = '') {
    const start = (curPage - 1) * pageSize;
    const end = curPage * pageSize;
    const btns = [];
    if (curPage > 1) {
        btns.push(Markup.callbackButton('Назад', `${addSymbol}_back`))
    }
    if (curPage <= pages - 1) {
        btns.push(Markup.callbackButton('Вперед', `${addSymbol}_next`))
    }
    return [
        commands.slice(start, end).map((el, i) => `<b>${addSymbol}${start + i}</b> -- ${el.name}`).join(`\n`),
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
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (req.resourceType() === 'image') {
                req.abort();
            }
            else {
                req.continue();
            }
        });
        ctx.reply("OPEN BROWSER");

        await page.goto(`${urls.wtf2019}?tags=`)
        await page.type('#user_login', login)
        await page.type('#user_pass', password)
        page.click('#inform_box button');
        ctx.reply("WAIT LOGIN");
        await page.waitForNavigation();
        ctx.reply("WAIT DATA");

        const result = await page.evaluate(() => {
            const items = [];
            let textTag = '';
            const links = document.querySelectorAll('a[id*=tag]');
            for (const link of links) {
                const name = link.innerText;
                const id = link.id.replace('tag', '')
                if (name.indexOf('WTF') !== -1) {
                    items.push({ id, name })
                }
                if (name === 'тексты') {
                    textTag = id;
                }
            }
            return { items, textTag };
        });
        ctx.session.textTag = result.textTag;
        ctx.session.commands = {};
        ctx.session.commands.items = result.items;
        ctx.session.commands.curPage = 1;
        ctx.session.commands.pages = Math.ceil(result.items.length / pageSize);
        const { curPage, pages, items } = ctx.session.commands;
        const response = renderList(items, curPage, pages, 'c');
        ctx.reply(response[0], response[1]);
    })(ctx)
})
wtfScene.leave((ctx) => {
    (async (ctx) => {
        await browser.close();
        ctx.reply("CLOSE BROWSER");
    })(ctx);
});

wtfScene.hears(/^c\d{1,}/gi, ctx => {
    (async (ctx) => {
        const value = ctx.match[0].replace('c', '');
        const { commands, textTag } = ctx.session;
        if (!commands[value]) {
            ctx.reply('Нет такой команды')
        } else {
            ctx.reply(`Вы выбрали команду ${commands[value].name}`);
            const page = (await browser.pages())[0];
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (req.resourceType() === 'image') {
                    req.abort();
                }
                else {
                    req.continue();
                }
            });
            page.goto(`${urls.wtf2019}?tag%5B%5D=${textTag}&tag%5B%5D=${commands[value].id}`);
            await page.waitForNavigation();
            const newItems = await page.evaluate(() => {
                const res = [];
                const items = document.querySelectorAll('.singlePost');
                for (const post of items) {
                    const name = post.querySelector('.postTitle h2').innerText;
                    const id = post.id;
                    res.push({ id, name });
                }
                return res;
            });
            ctx.reply(JSON.stringify(newItems))
            ctx.session.posts = {};
            ctx.session.posts.items = newItems;
            ctx.session.posts.curPage = 1;
            ctx.session.posts.pages = Math.ceil((newItems || []).length / pageSize);
            const { items, curPage, pages } = ctx.session.posts;
            const result = renderList(items, curPage, pages, 'p');
            ctx.reply(result[0], result[1]);
        }
    })(ctx);
});


wtfScene.action('c_back', ctx => {
    const { curPage: oldCurPage, items, pages } = ctx.session.commands || {};
    if (!items.length) {
        ctx.reply('No commands');
    }
    ctx.session.commands.curPage = oldCurPage - 1;
    const { curPage } = ctx.session.commands;
    const response = renderList(items, curPage, pages, 'c');
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action('c_next', ctx => {
    const { curPage: oldCurPage, items, pages } = ctx.session.commands || {};
    if (!items.length) {
        ctx.reply('No commands');
    }
    ctx.session.commands.curPage = oldCurPage + 1;
    const { curPage } = ctx.session.commands;
    const response = renderList(items, curPage, pages, 'c');
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action('p_back', ctx => {
    const { curPage: oldCurPage, items, pages } = ctx.session.posts || {};
    if (!items.length) {
        ctx.reply('No posts');
    }
    ctx.session.posts.curPage = oldCurPage - 1;
    const { curPage } = ctx.session.posts;
    const response = renderList(items, curPage, pages, 'p');
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action('p_next', ctx => {
    const { curPage: oldCurPage, items, pages } = ctx.session.posts || {};
    if (!items.length) {
        ctx.reply('No posts');
    }
    ctx.session.posts.curPage = oldCurPage + 1;
    const { curPage } = ctx.session.posts;
    const response = renderList(items, curPage, pages, 'p');
    ctx.editMessageText(response[0], response[1]);
})

// Регистрируем сцену создания матча
stage.register(wtfScene);
stage.command('cancel', leave())

bot.command("wtfScene", (ctx) => ctx.scene.enter("wtfScene"));
bot.launch();