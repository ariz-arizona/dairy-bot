const Telegraf = require('telegraf');
const session = require('telegraf/session')
const Stage = require('telegraf/stage')
const { leave } = Stage
const Scene = require('telegraf/scenes/base')
const Markup = require('telegraf/markup');
const puppeteer = require('puppeteer');

const login = process.env.LOGIN;
const password = process.env.PASSWORD;
const urls = {
    wtf2019: 'https://wtf-2019.diary.ru/',
    wtf2020: 'https://wtfk2020.diary.ru/'
}
const browserArgs = {
    headless: true, args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process'
    ],
};

const bot = new Telegraf(process.env.TOKEN);
const stage = new Stage();

bot.use(session());
bot.use(stage.middleware());

bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err);
    ctx.reply("ERROR! LOOK LOGS PLS")
});

let browser;
const wtfScene = new Scene('wtfScene');

function renderList(commands, curPage, pages, addSymbol = '', pageSize = 20) {
    const start = (curPage - 1) * pageSize;
    const end = curPage * pageSize;
    const btns = [];
    if (curPage > 1) {
        btns.push(Markup.callbackButton('Назад', `${addSymbol}_back_${pageSize}`))
    }
    if (curPage <= pages - 1) {
        btns.push(Markup.callbackButton('Вперед', `${addSymbol}_next_${pageSize}`))
    }
    return [
        `Введите идентификатор элемента:\n
        ${commands.slice(start, end).map((el, i) => `<b>${addSymbol}${start + i}</b> -- ${el.name}`.slice(0, 600)).join(`\n`)}`,
        {
            parse_mode: 'HTML',
            reply_markup: end > 1 ? Markup.inlineKeyboard(btns) : false
        }
    ]
}

wtfScene.enter((ctx, initialState) => {
    (async (ctx, initialState) => {
        try {
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
            page.on("error", function (err) {
                theTempValue = err.toString();
                console.log("Error: " + theTempValue);
                ctx.reply("Browser error: " + theTempValue)
            });

            ctx.reply("OPEN BROWSER");
            await page.goto(`${urls[ctx.scene.state.id || 'wtf2019']}?tags=`)
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
            const pageSize = 20;
            ctx.session.commands.pages = Math.ceil(result.items.length / pageSize);
            const { curPage, pages, items } = ctx.session.commands;
            const response = renderList(items, curPage, pages, 'c', pageSize);
            ctx.reply(response[0], response[1]);
        } catch (err) { ctx.reply(err.toString().slice(0, 300)) };
    })(ctx)
});

wtfScene.leave((ctx) => {
    (async (ctx) => {
        await browser.close();
        ctx.reply("CLOSE BROWSER");
    })(ctx);
});

wtfScene.hears(/^(c|C)\d{1,}/gi, ctx => {
    (async (ctx) => {
        try {
            const value = ctx.match[0].replace(/(c|C)/, '');
            const { textTag } = ctx.session;
            const { items } = ctx.session.commands;
            if (!items[value]) {
                ctx.reply('Нет такой команды')
            } else {
                const item = ctx.session.commands.items[value];
                ctx.reply(`Вы выбрали команду ${item.name}`);
                const page = (await browser.pages())[0];
                const link = `${urls[ctx.scene.state.id || 'wtf2019']}?tag[]=${textTag}&tag[]=${item.id}`;
                page.goto(link);
                ctx.reply(`GO TO ${link}`)
                // todo многостраничность, выбор комментариев
                await page.waitForNavigation();
                await page.evaluate(() => {
                    const items = document.querySelectorAll('.singlePost');
                    for (const post of items) {
                        post.querySelector('.LinkMore').click();
                    }
                })
                const data = await page.evaluate((commandName) => {
                    const res = [];
                    const test = [];
                    const items = document.querySelectorAll('.singlePost');
                    for (const post of items) {
                        const id = post.id.replace('post', '');
                        const inner = post.querySelector('a+span').innerText.replace(/(?:\r\n|\r|\n)/g, ' __ ');
                        const titles = inner.match(/Название:(.*?)__/g) || [];
                        const pairings = inner.match(/Пейринг\/Персонажи:(.*?)__/g) || [];
                        const categories = inner.match(/Категория:(.*?)__/g) || [];
                        const ratings = inner.match(/Рейтинг:(.*?)__/g) || [];
                        const genres = inner.match(/Жанр:(.*?)__/g) || [];
                        test.push({ inner: inner.slice(0, 300), titles, pairings, categories });
                        if (pairings.length) {
                            const temp = [];
                            for (let i = 0; i < titles.length; i++) {
                                const title = titles[i].replace('__', '').replace(/Название:? ?/, '').trim();
                                const pairing = pairings[i].replace('__', '').replace(/Пейринг\/Персонажи:? ?/, '').trim();
                                const category = categories[i].replace('__', '').replace(/Категория:? ?/, '').trim();
                                const rating = ratings[i].replace('__', '').replace(/Рейтинг:? ?/, '').trim();
                                const genre = genres[i].replace('__', '').replace(/Жанр:? ?/, '').trim();
                                const string = `${title}, ${pairing} (${rating}, ${genre}, ${category})`;
                                temp.push(string);
                            }
                            res.push({ id, name: temp.join('\n') });
                        } else {
                            const name = post.querySelector('.postTitle h2').innerText;
                            res.push({ id, name: name });
                        }
                    }
                    return [res];
                }, item.name);
                const newItems = data[0];
                ctx.session.posts = {};
                ctx.session.posts.command = item;
                ctx.session.posts.items = newItems;
                ctx.session.posts.curPage = 1;
                const pageSize = 5;
                ctx.session.posts.pages = Math.ceil((newItems || []).length / pageSize);
                const { items, curPage, pages } = ctx.session.posts;
                const result = renderList(items, curPage, pages, 'p', pageSize);
                ctx.reply(result[0], result[1]);
            }
        } catch (err) { ctx.reply(err.toString().slice(0, 300)) };
    })(ctx);
});

wtfScene.hears(/^(p|P)\d{1,}/gi, ctx => {
    (async (ctx) => {
        try {
            const value = ctx.match[0].replace(/(p|P)/, '');
            const { items, command } = ctx.session.posts;
            if (!items[value]) {
                ctx.reply('Нет такого поста')
            } else {
                const item = ctx.session.posts.items[value];
                const page = (await browser.pages())[0];
                const link = `${urls[ctx.scene.state.id || 'wtf2019']}p${item.id}.html?oam=1`;
                page.goto(link);
                ctx.reply(`GO TO ${link}`)
                // todo многостраничность, выбор комментариев
                await page.waitForNavigation();
                const result = await page.evaluate((command) => {
                    const pRegExp = /\n{1,}/gi;
                    const pRegReplace = '</p><p>';
                    const post = document.querySelector('.singlePost .postContent .postInner').innerText;
                    const comments = document.querySelectorAll('#commentsArea .singleComment');
                    const content = [];
                    const names = [];
                    for (const comment of comments) {
                        const text = comment.querySelector('[id^=morec]');
                        names.push(comment.querySelector('.sign').innerText);
                        if (comment.querySelector('.sign').innerText !== command.name) {
                            // continue;
                        }
                        if (text) {
                            text.style.display = 'block';
                            content.push(text.innerText.replace(pRegExp, pRegReplace));
                        }
                    }
                    return [names.join(', '), `<p>${post.replace(pRegExp, pRegReplace)}</p><p>${content.join(pRegReplace)}</p>`];
                }, command);
                const string = `<?xml version="1.0" encoding="UTF-8"?>
                <FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:xlink="http://www.w3.org/1999/xlink">
                <description><title-info><book-title>${item.name}</book-title><lang>ru</lang><src-lang>ru</src-lang></title-info><src-url>${link}</src-url><id>${item.id}</id><version>2.0</version></description>
                <body><title>${item.name}</title><p>${result[1]}</p></body>
                </FictionBook>`;
                ctx.replyWithDocument(
                    {
                        source: Buffer.from(string, 'utf8'),
                        filename: `${item.name}.fb2`
                    }
                )
            }
        } catch (err) { ctx.reply(err.toString().slice(0, 300)) };
    })(ctx);
});

wtfScene.action(/c_back_\d{1,}/gi, ctx => {
    const pageSize = ctx.match[0].replace('p_next','');
    const { curPage: oldCurPage, items, pages } = ctx.session.commands || {};
    if (!items.length) {
        ctx.reply('No commands');
    }
    ctx.session.commands.curPage = oldCurPage - 1;
    const { curPage } = ctx.session.commands;
    const response = renderList(items, curPage, pages, 'c', pageSize);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action(/c_next_\d{1,}/gi, ctx => {
    const pageSize = ctx.match[0].replace('p_next','');
    const { curPage: oldCurPage, items, pages } = ctx.session.commands || {};
    if (!items.length) {
        ctx.reply('No commands');
    }
    ctx.session.commands.curPage = oldCurPage + 1;
    const { curPage } = ctx.session.commands;
    const response = renderList(items, curPage, pages, 'c', pageSize);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action(/p_back_\d{1,}/gi, ctx => {
    const pageSize = ctx.match[0].replace('p_next','');
    const { curPage: oldCurPage, items, pages } = ctx.session.posts || {};
    if (!items.length) {
        ctx.reply('No posts');
    }
    ctx.session.posts.curPage = oldCurPage - 1;
    const { curPage } = ctx.session.posts;
    const response = renderList(items, curPage, pages, 'p', pageSize);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action(/p_next_\d{1,}/gi, ctx => {
    const pageSize = ctx.match[0].replace('p_next','');
    const { curPage: oldCurPage, items, pages } = ctx.session.posts || {};
    if (!items.length) {
        ctx.reply('No posts');
    }
    ctx.session.posts.curPage = oldCurPage + 1;
    const { curPage } = ctx.session.posts;
    const response = renderList(items, curPage, pages, 'p', pageSize);
    ctx.editMessageText(response[0], response[1]);
})

stage.register(wtfScene);
stage.command("cancel", leave());

bot.start((ctx) => ctx.reply(
    'Привет! \n\nЯ — бот-помощник для чтения текстов с Зимней фандомной битвы (проходит в асоциальной сети http://diary.ru) в формате FB2.\n\nЕсли я не работаю — напишите, пожалуйста, @aarizona',
    {
        reply_markup: Markup.inlineKeyboard([
            Markup.callbackButton('wtf 2019', `wtf2019`),
            Markup.callbackButton('wtf 2020', `wtf2020`)
        ])
    }
));

bot.action("wtf2019", ctx => { ctx.scene.enter("wtfScene", { id: 'wtf2019' }); return true });
bot.command("wtf2019", ctx => ctx.scene.enter("wtfScene", { id: 'wtf2019' }));
bot.action("wtf2020", ctx => { ctx.scene.enter("wtfScene", { id: 'wtf2020' }); return true });
bot.command("wtf2020", ctx => ctx.scene.enter("wtfScene", { id: 'wtf2020' }));
bot.launch();
