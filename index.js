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

function renderList(items, curPage, pages, addSymbol = '', pageSize = 20) {
    const start = (curPage - 1) * pageSize;
    const end = curPage * pageSize;
    const btns = [];
    if (curPage > 1) {
        btns.push(Markup.callbackButton('Назад', `${addSymbol}_back_${pageSize}`))
    }
    if (curPage <= pages - 1) {
        btns.push(Markup.callbackButton('Вперед', `${addSymbol}_next_${pageSize}`))
    }
    const reply = {
        parse_mode: 'HTML',
    };
    if (end > 1) {
        reply.reply_markup = Markup.inlineKeyboard(btns)
    }
    return [
        `Всего <b>${items.length}</b>. Введите айди элемента:\n${items.slice(start, end).map((el, i) => `<b>${addSymbol}${start + i}</b> -- ${el.name}`.slice(0, 600)).join(`\n`)}`,
        reply
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
                let visualTag = '';
                const links = document.querySelectorAll('a[id*=tag]');
                for (const link of links) {
                    const name = link.innerText;
                    const id = link.id.replace('tag', '');
                    const count = link.closest('li').querySelector('span[style]').textContent;
                    if (name.indexOf('WTF') !== -1) {
                        items.push({ id, name: `${name} (${count})` })
                    }
                    if (name === 'тексты') {
                        textTag = id;
                    }
                    if (name === 'визуал') {
                        visualTag = id;
                    }
                }
                items.sort((a, b) => {
                    var nameA = a.name.toLowerCase(), nameB = b.name.toLowerCase()
                    if (nameA < nameB)
                        return -1
                    if (nameA > nameB)
                        return 1
                    return 0
                });
                return { items, textTag, visualTag };
            });
            ctx.session.textTag = result.textTag;
            ctx.session.visualTag = result.visualTag;
            ctx.session.commands = {};
            ctx.session.commands.items = result.items;
            ctx.session.commands.curPage = 1;
            const pageSize = 10;
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
            const { textTag, visualTag } = ctx.session;
            const { items } = ctx.session.commands;
            if (!items[value]) {
                ctx.reply('Нет такой команды')
            } else {
                const item = ctx.session.commands.items[value];
                ctx.reply(`Вы выбрали команду ${item.name}`);
                const page = (await browser.pages())[0];
                let data = [];
                let tempLink;
                let i = 0;
                const links = [
                    `${urls[ctx.scene.state.id || 'wtf2019']}?tag[]=${textTag}&tag[]=${item.id}`,
                    `${urls[ctx.scene.state.id || 'wtf2019']}?tag[]=${visualTag}&tag[]=${item.id}`
                ];
                for await (let link of links) {
                    do {
                        data[i] = [];
                        ctx.reply(`GO TO ${link}`);
                        await page.goto(link, {       waitUntil: 'networkidle2'    });
                        await page.waitForNavigation();
                        await page.evaluate(() => {
                            const items = document.querySelectorAll('.singlePost');
                            for (const post of items) {
                                post.querySelector('.LinkMore').click();
                            }
                        });
                        data[i] = data[i].concat(await page.evaluate(() => {
                            const res = [];
                            const items = document.querySelectorAll('.singlePost');
                            for (const post of items) {
                                const id = post.id.replace('post', '');
                                const name = post.querySelector('.postTitle h2').innerText;
                                const inner = post.querySelector('a+span').innerText.replace(/(?:\r\n|\r|\n)/g, ' __ ');
                                const titles = inner.match(/Название:?(.*?)__/g) || [];
                                const pairings = inner.match(/Пейринг\/Персонажи:?(.*?)__/g) || [];
                                const categories = inner.match(/Категория:?(.*?)__/g) || [];
                                const ratings = inner.match(/Рейтинг:?(.*?)__/g) || [];
                                const genres = inner.match(/Жанр:?(.*?)__/g) || [];
                                try {
                                    const temp = [];
                                    for (let i = 0; i < titles.length; i++) {
                                        const title = titles[i].replace('__', '').replace(/Название:? ?/, '').trim();
                                        const pairing = pairings[i].replace('__', '').replace(/Пейринг\/Персонажи:? ?/, '').trim();
                                        const category = categories[i].replace('__', '').replace(/Категория:? ?/, '').trim();
                                        const rating = ratings[i].replace('__', '').replace(/Рейтинг:? ?/, '').trim();
                                        const genre = genres[i].replace('__', '').replace(/Жанр:? ?/, '').trim();
                                        const string = `<i>${title}</i>, \n${pairing} (${rating}, ${genre}, ${category})`;
                                        temp.push(string);
                                    }
                                    res.push({ id, name: temp.join('') ? temp.join('\n\n') : name });
                                } catch {
                                    res.push({ id, name: name });
                                }
                            }
                            return res;
                        }));
                        tempLink = await page.evaluate(() => {
                            const link = document.querySelector('.pagination a:not(.active):last-child');
                            if (link) {
                                return link.href;
                            }
                        });
                        if (tempLink !== link) {
                            link = tempLink;
                        }
                        i++;
                    } while (link)
                }
                const [textItems = [], visualItems = []] = data;
                ctx.session.posts = {};
                ctx.session.posts.command = item;
                ctx.session.posts.textItems = textItems;
                ctx.session.posts.visualItems = visualItems;
                ctx.reply(
                    `Тексты: ${textItems.length}\nВизуал: ${visualItems.length}`,
                    {
                        reply_markup: Markup.inlineKeyboard([
                            Markup.callbackButton('Тексты', `command_texts`),
                            Markup.callbackButton('Визуал', `command_visual`)
                        ])
                    }
                )
            }
        } catch (err) { ctx.reply(err.toString().slice(0, 300)) };
    })(ctx);
});

wtfScene.hears(/^(v|V)\d{1,}/gi, ctx => {
    (async (ctx) => {
        try {
            const value = ctx.match[0].replace(/(v|V)/, '');
            const { visualItems: items } = ctx.session.posts;
            if (!items[value]) {
                ctx.reply('Нет такого поста')
            } else {
                const item = ctx.session.posts.visualItems[value];
                const page = (await browser.pages())[0];
                const link = `${urls[ctx.scene.state.id || 'wtf2019']}p${item.id}.html?oam=1`;
                page.goto(link);
                ctx.reply(`GO TO ${link}`)
                await page.waitForNavigation();
                const frameLinks = await page.evaluate(() => {
                    const frames = document.querySelectorAll('.singlePost iframe');
                    const res = [];
                    if (frames) {
                        for (const frame of frames) {
                            res.push(frame.src);
                        }
                    }
                    return res;
                });
                const imageLinks = await page.evaluate(() => {
                    const images = document.querySelectorAll('.singlePost a > img');
                    const res = [];
                    if (images) {
                        for (const image of images) {
                            res.push(image.src);
                        }
                    }
                    return res;
                });
                const replies = [];
                imageLinks.map((media, i) => { replies.push({ type: 'photo', media, caption: i }) });
                // frameLinks.map(media => { replies.push({ type: 'video', media }) });
                const size = 4;
                for (let i = 0; i < Math.ceil(replies.length / size); i++) {
                    const arr = replies.slice((i * size), (i * size) + size);
                    if (arr.length > 1) {
                        try {
                            await ctx.replyWithMediaGroup(arr)
                        } catch (err) {
                            ctx.reply(`Отправка изображений не удалась:\n${arr.map(el => el.media).join('\n')}`)
                        }
                    } else {
                        ctx.replyWithPhoto({ url: arr[0].media })
                    }
                }
                frameLinks.map(media => {
                    ctx.reply(`НаЙдены фреймы ${media}`);
                });

            }
        } catch (err) { ctx.reply(err.toString().slice(0, 300)) };
    })(ctx);
});

wtfScene.hears(/^(t|T)\d{1,}/gi, ctx => {
    (async (ctx) => {
        try {
            const value = ctx.match[0].replace(/(t|T)/, '');
            const { textItems: items, command } = ctx.session.posts;
            if (!items[value]) {
                ctx.reply('Нет такого поста')
            } else {
                const item = ctx.session.posts.textItems[value];
                const page = (await browser.pages())[0];
                const link = `${urls[ctx.scene.state.id || 'wtf2019']}p${item.id}.html?oam=1`;
                page.goto(link);
                ctx.reply(`GO TO ${link}`)
                await page.waitForNavigation();
                const frameLink = await page.evaluate(() => {
                    const frame = document.querySelector('.singlePost iframe');
                    if (frame) {
                        return frame.src;
                    }
                });
                let content;
                if (frameLink) {
                    page.goto(frameLink);
                    ctx.reply(`GO TO ${frameLink}`)
                    await page.waitForNavigation();
                    content = await page.evaluate(() => {
                        return `${document.body.innerText}`;
                    })
                } else {
                    content = await page.evaluate((command) => {
                        const post = document.querySelector('.singlePost .postContent .postInner').innerText;
                        const comments = document.querySelectorAll('#commentsArea .singleComment');
                        const content = [post];
                        const names = [];
                        for (const comment of comments) {
                            const text = comment.querySelector('[id^=morec]');
                            names.push(comment.querySelector('.authorName').innerText);
                            if (command.name.indexOf(comment.querySelector('.authorName').innerText) === -1) {
                                continue;
                            }
                            if (text) {
                                text.style.display = 'block';
                                content.push(text.innerText);
                            }
                        }
                        return `${content.join('\n\n')}`;
                    }, command);
                }
                const preparedContent = `<p>${content.replace(/(\n\r?|\r\n?|\v){1,}/gi, '</p><p>')}<p>`;
                const string = `<?xml version="1.0" encoding="UTF-8"?>
                <FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:xlink="http://www.w3.org/1999/xlink">
                <description><title-info><book-title>${item.name}</book-title><lang>ru</lang><src-lang>ru</src-lang></title-info><src-url>${link}</src-url><id>${item.id}</id><version>2.0</version></description>
                <body><title>${item.name}</title><p>${preparedContent}</p></body>
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

wtfScene.action(/^command_texts/gi, ctx => {
    (async (ctx) => {
        try {
            const curPage = 1;
            const pageSize = 3;
            const pages = Math.ceil(ctx.session.posts.textItems.length / pageSize);
            ctx.session.posts.curPage = curPage;
            ctx.session.posts.pages = pages;
            const { textItems: items } = ctx.session.posts;
            const result = renderList(items, curPage, pages, 't', pageSize);
            ctx.reply(result[0], result[1]);
        } catch (err) { ctx.reply(err.toString().slice(0, 300)) };
    })(ctx);
    return true;
});

wtfScene.action(/^command_visual/gi, ctx => {
    (async (ctx) => {
        try {
            const curPage = 1;
            const pageSize = 3;
            const pages = Math.ceil(ctx.session.posts.textItems.length / pageSize);
            ctx.session.posts.curPage = curPage;
            ctx.session.posts.pages = pages;
            const { visualItems: items } = ctx.session.posts;
            const result = renderList(items, curPage, pages, 'v', pageSize);
            ctx.reply(result[0], result[1]);
        } catch (err) { ctx.reply(err.toString().slice(0, 300)) };
    })(ctx);
    return true;
});

wtfScene.action(/c_back_\d{1,}/gi, ctx => {
    const pageSize = parseInt(ctx.match[0].replace('c_back_', ''));
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
    const pageSize = parseInt(ctx.match[0].replace('c_next_', ''));
    const { curPage: oldCurPage, items, pages } = ctx.session.commands || {};
    if (!items.length) {
        ctx.reply('No commands');
    }
    ctx.session.commands.curPage = oldCurPage + 1;
    const { curPage } = ctx.session.commands;
    const response = renderList(items, curPage, pages, 'c', pageSize);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action(/t_back_\d{1,}/gi, ctx => {
    const pageSize = parseInt(ctx.match[0].replace('t_back_', ''));
    const { curPage: oldCurPage, textItems: items, pages } = ctx.session.posts || {};
    if (!items.length) {
        ctx.reply('No posts');
    }
    ctx.session.posts.curPage = oldCurPage - 1;
    const { curPage } = ctx.session.posts;
    const response = renderList(items, curPage, pages, 't', pageSize);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action(/t_next_\d{1,}/gi, ctx => {
    const pageSize = parseInt(ctx.match[0].replace('t_next_', ''));
    const { curPage: oldCurPage, textItems: items, pages } = ctx.session.posts || {};
    if (!items.length) {
        ctx.reply('No posts');
    }
    ctx.session.posts.curPage = oldCurPage + 1;
    const { curPage } = ctx.session.posts;
    const response = renderList(items, curPage, pages, 't', pageSize);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action(/v_back_\d{1,}/gi, ctx => {
    const pageSize = parseInt(ctx.match[0].replace('v_back_', ''));
    const { curPage: oldCurPage, visualItems: items, pages } = ctx.session.posts || {};
    if (!items.length) {
        ctx.reply('No posts');
    }
    ctx.session.posts.curPage = oldCurPage - 1;
    const { curPage } = ctx.session.posts;
    const response = renderList(items, curPage, pages, 'v', pageSize);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action(/v_next_\d{1,}/gi, ctx => {
    const pageSize = parseInt(ctx.match[0].replace('v_next_', ''));
    const { curPage: oldCurPage, visualItems: items, pages } = ctx.session.posts || {};
    if (!items.length) {
        ctx.reply('No posts');
    }
    ctx.session.posts.curPage = oldCurPage + 1;
    const { curPage } = ctx.session.posts;
    const response = renderList(items, curPage, pages, 'v', pageSize);
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
