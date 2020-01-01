const Telegraf = require('telegraf');
const session = require('telegraf/session')
const Stage = require('telegraf/stage')
const { leave } = Stage
const Scene = require('telegraf/scenes/base')
const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');
const puppeteer = require('puppeteer');
const EpubPress = require('epub-press-js');

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
        const { textTag } = ctx.session;
        const { items } = ctx.session.commands;
        if (!items[value]) {
            ctx.reply('Нет такой команды')
        } else {
            const item = ctx.session.commands.items[value];
            ctx.reply(`Вы выбрали команду ${item.name}`);
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
            const link = `${urls.wtf2019}?tag[]=${textTag}&tag[]=${item.id}`;
            page.goto(link);
            ctx.reply(`GO TO ${link}`)
            await page.waitForNavigation();
            const newItems = await page.evaluate(() => {
                const res = [];
                const items = document.querySelectorAll('.singlePost');
                for (const post of items) {
                    const name = post.querySelector('.postTitle h2').innerText;
                    const id = post.id.replace('post', '');
                    res.push({ id, name });
                }
                return res;
            });
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

wtfScene.hears(/^p\d{1,}/gi, ctx => {
    try {

        (async (ctx) => {
            const value = ctx.match[0].replace('p', '');
            const { items } = ctx.session.posts;
            if (!items[value]) {
                ctx.reply('Нет такого поста')
            } else {
                const item = ctx.session.posts.items[value];
                const page = (await browser.pages())[0];
                await page.setRequestInterception(true);
                page.on('request', (req) => {
                    if (req.resourceType() === 'image') {
                        // req.abort();
                    }
                    else {
                        req.continue();
                    }
                });
                const link = `${urls.wtf2019}p${item.id}.html?oam=1`;
                page.goto(link);
                ctx.reply(`GO TO ${link}`)
                await page.waitForNavigation();
                const result = await page.evaluate(() => {
                    return document.querySelector('#page-t').innerText;
                });
                const string = `<?xml version="1.0" encoding="UTF-8"?>
                <FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:xlink="http://www.w3.org/1999/xlink">
                <description>
                <title-info>
                <book-title>${item.name}</book-title>
                  <lang>ru</lang>
                  <src-lang>ru</src-lang>
                  </title-info>  
                  <src-url>${link}</src-url>
                  <id>${item.id}</id>
                  <version>2.0</version>
                  </description>
                  <body>
                  <title>${item.name}</title>
                  <p>
                  ${result}
                  </p>
                  </body>
                  </FictionBook>`;
                  ctx.reply(string.slice(300, 600));
                const f = new File([new Blob([`<?xml version="1.0" encoding="UTF-8"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:xlink="http://www.w3.org/1999/xlink"><description><title-info><book-title>{item.name}</book-title><lang>ru</lang></title-info><id>{item.id}</id><version>2.0</version></description><body><title>{item.name}</title><p> {result} </p></body></FictionBook>`])], 'ff.fb2', {type: 'text/plain'})
                  ctx.telegram.sendDocument(ctx.from.id, {
                    source: new Blob([string]),
                    filename: `${item.id}.fb2`
                }
                ).catch(function (error) {
                    ctx.reply({ error })
                })
                ctx.replyWithDocument(
                    f
                //     {
                //     source: f,
                //     filename: `${item.id}.fb2`
                // }
                // 'http://www.lehtml.com/download/js_doc.pdf'
                )
            }
        })(ctx);
    } catch (err) {
        ctx.reply({ err })
    }
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

function stringToArrayBuffer(str) {
    if (/[\u0080-\uffff]/.test(str)) {
        throw new Error("this needs encoding, like UTF-8");
    }
    var arr = new Uint8Array(str.length);
    for (var i = str.length; i--;)
        arr[i] = str.charCodeAt(i);
    return new Blob(arr.buffer, { type: "" });
}

function arrayBufferToString(buffer) {
    var arr = new Uint8Array(buffer);
    var str = String.fromCharCode.apply(String, arr);
    if (/[\u0080-\uffff]/.test(str)) {
        throw new Error("this string seems to contain (still encoded) multibytes");
    }
    return str;
}