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
    wtf2017: 'https://www.diary.ru/~wtf-kombat2017/',
    wtf2018: 'https://www.diary.ru/~wtf-kombat2017/',
    wtf2019: 'https://wtf-2019.diary.ru/',
    wtf2020: 'https://wtfk2020.diary.ru/',
    fb2016: 'https://www.diary.ru/~fk-2016/',
    fb2017: 'https://www.diary.ru/~fk-2017/',
    fb2018: 'https://www.diary.ru/~fk-2018/',
    fb2019: 'https://www.diary.ru/~fk-2019/',
};
const types = {
    wtf: {
        commandNamePart: 'WTF',
        textTags: ['тексты'],
        visualTags: ['визуал']
    },
    fb: {
        commandNamePart: 'fandom',
        textTags: ['Макси', 'Миди', 'Мини', 'Драбблы'],
        visualTags: ['Арт/клип/коллаж']
    }
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

const errorHelper = (err) => {
    theTempValue = err.toString();
    console.log("Error: " + theTempValue);
    ctx.reply("Browser error: " + theTempValue)
}

const requestHelper = (req) => {
    const type = req.resourceType();
    headers = req.headers();
    if (
        ['image', 'font', 'stylesheet', 'xhr', 'other', 'script'].includes(type) ||
        headers['sec-fetch-dest'] !== 'document'
    ) { req.abort(); } else { req.continue(); }
}

let browser;
const wtfScene = new Scene('wtfScene');

function renderList(items, curPage, pages, addSymbol = '', pageSize = 20) {
    const start = (curPage - 1) * pageSize;
    const end = curPage * pageSize;
    const btns = [];
    if (curPage > 1) {
        btns.push(Markup.callbackButton(`Назад`, `${addSymbol}-back-${pageSize}`))
    }
    if (curPage < pages) {
        btns.push(Markup.callbackButton(`Вперед`, `${addSymbol}-next-${pageSize}`))
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

wtfScene.enter((ctx) => {
    (async (ctx) => {
        try {
            browser = await puppeteer.launch(browserArgs);
            const page = await browser.newPage();
            await page.setRequestInterception(true);
            page.on('request', requestHelper);
            page.on("error", errorHelper);
            ctx.reply("OPEN BROWSER");
            const type = types[ctx.scene.state.id.replace(/\d/g, '')];
            await page.goto(`${urls[ctx.scene.state.id || 'wtf2019']}?tags=`)
            await page.type('#user_login', login)
            await page.type('#user_pass', password)
            page.click('#inform_box button');
            ctx.reply("WAIT LOGIN");
            await page.waitForNavigation();
            ctx.reply("WAIT DATA");

            const result = await page.evaluate((type) => {
                const items = [];
                let textTags = [];
                let visualTags = [];
                const links = document.querySelectorAll('a[id*=tag]');
                for (const link of links) {
                    const name = link.innerText;
                    const id = link.id.replace('tag', '');
                    const count = link.closest('li').querySelector('span[style]').textContent;
                    if (name.indexOf(type.commandNamePart) !== -1) {
                        items.push({ id, name: `${name} (${count})` })
                    }
                    if (type.textTags.includes(name)) {
                        textTags.push(id);
                    }
                    if (type.visualTags.includes(name)) {
                        visualTags.push(id);
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
                return { items, textTags, visualTags };
            }, type);
            ctx.session.textTags = result.textTags;
            ctx.session.visualTags = result.visualTags;
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
            const { textTags, visualTags } = ctx.session;
            const { items } = ctx.session.commands;
            if (!items[value]) {
                ctx.reply('Нет такой команды')
            } else {
                const item = ctx.session.commands.items[value];
                ctx.reply(`Вы выбрали команду ${item.name}`);
                const generateLink = el => `${urls[ctx.scene.state.id || 'wtf2019']}?tag[]=${el}&tag[]=${item.id}`;
                const links = {
                    text: textTags.map(el => generateLink(el)),
                    visual: visualTags.map(el => generateLink(el)),
                };
                const linkList = [];
                const data = [];

                const page = await browser.newPage();
                await page.setRequestInterception(true);
                page.on('request', requestHelper);
                page.on("error", errorHelper);

                ctx.reply(`COLLECT DATA`);
                for (let j = 0; j < Object.keys(links).length; j++) {
                    linkList[j] = [];
                    data[j] = [];
                    for (let l = 0; l < Object.values(links)[j].length; l++) {
                        let link = Object.values(links)[j][l];
                        do {
                            linkList[j].push(link);
                            ctx.reply(
                                `${Object.keys(links)[j].toUpperCase()} PAGE ${linkList[j].length} ${link}`,
                                { disable_web_page_preview: true }
                            );
                            await page.goto(link, { waitUntil: "networkidle2", timeout: 60000 })

                            // await page.waitForSelector(".singlePost");
                            const result = await page.evaluate((linkListTemp) => {
                                const items = document.querySelectorAll('.singlePost');
                                const res = {};
                                res.data = [];
                                res.link = false;
                                for (const post of items) {
                                    post.querySelector('a+span').style.display = 'block';
                                }
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
                                            // const string = `<i>${title}</i>, \n${pairing} (${rating}, ${genre}, ${category})`;
                                            string = `<i>${title}</i>, \n${pairing}`;
                                            temp.push(string);
                                        }
                                        res.data.push({ id, name: temp.join('') ? temp.join('\n\n') : name });
                                    } catch {
                                        res.data.push({ id, name: name });
                                    }
                                }
                                const link = document.querySelector('.pagination a:not(.active):last-child');
                                if (link && !linkListTemp.includes(link)) {
                                    res.link = link.href;
                                }
                                return res;
                            }, linkList);
                            data[j] = data[j].concat(result.data);
                            link = result.link || false;
                        } while (link);
                    }
                }
                await page.close();
                const [textItems = [], visualItems = []] = data;
                ctx.session.posts = {};
                ctx.session.posts.command = item;
                ctx.session.posts.textItems = textItems;
                ctx.session.posts.visualItems = visualItems;
                ctx.reply(
                    `Тексты: ${textItems.length}\nВизуал: ${visualItems.length}`,
                    {
                        reply_markup: Markup.inlineKeyboard([
                            Markup.callbackButton('Тексты', `command-texts`),
                            Markup.callbackButton('Визуал', `command-visual`)
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
                const page = await browser.newPage();
                await page.setRequestInterception(true);
                page.on('request', requestHelper);
                page.on("error", errorHelper);

                const item = ctx.session.posts.visualItems[value];
                const link = `${urls[ctx.scene.state.id || 'wtf2019']}p${item.id}.html?oam=1`;
                ctx.reply(`GO TO ${link}`, { disable_web_page_preview: true })
                await page.goto(link, { waitUntil: "networkidle2", timeout: 60000 })
                await page.waitForSelector(".singlePost");
                const data = await page.evaluate(() => {
                    const res = { images: [], frames: [] };
                    const images = document.querySelectorAll('.singlePost a > img');
                    if (images) {
                        for (const image of images) {
                            res.images.push(image.src);
                        }
                    }
                    const frames = document.querySelectorAll('.singlePost iframe');
                    if (frames) {
                        for (const frame of frames) {
                            res.frames.push(frame.src);
                        }
                    }
                    return res;
                });
                const { images, frames } = data;
                const replies = [];
                // todo загрузка в чат
                const imagesBuffer = [];
                for (let imageId = 0; imageId < images.length; imageId++) {
                    try {
                        ctx.reply(`TRY LOAD IMAGE ${imageId} ${images[imageId]}`, { disable_web_page_preview: true })
                        const [response] = await Promise.all([
                            page.waitForResponse(response => response.url()),
                            page.goto(images[imageId])
                        ]);
                        const buffer = await response.buffer();
                        imagesBuffer.push(buffer);
                        ctx.replyWithPhoto({source: buffer})
                    } catch (err) {
                        ctx.reply(`ERROR LOAD IMAGE ${imageId} `)
                    }
                }
                imagesBuffer.map((buffer, i) => { replies.push({ type: 'photo', source: buffer, caption: i }) });
                // ctx.reply(JSON.stringify(replies).slice(0, 600))
                frames.map(media => { replies.push({ type: 'video', media }) });
                const size = 4;
                for (let i = 0; i < Math.ceil(replies.length / size); i++) {
                    const arr = replies.slice((i * size), (i * size) + size);
                    if (arr.length > 1) {
                        try {
                            await ctx.replyWithMediaGroup(arr)
                        } catch (err) {
                            ctx.reply(JSON.stringify(err).slice(0, 600));
                            ctx.reply(`Отправка изображений не удалась:\n${arr.map(el => el.media).join('\n')}`)
                        }
                    } else {
                        ctx.replyWithPhoto({ url: arr[0].media })
                    }
                }
                frames.map(media => {
                    ctx.reply(`Найдены фреймы ${media}`);
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
                const page = await browser.newPage();
                await page.setRequestInterception(true);
                page.on('request', requestHelper);
                page.on("error", errorHelper);

                const item = ctx.session.posts.textItems[value];
                const link = `${urls[ctx.scene.state.id || 'wtf2019']}p${item.id}.html?oam=1`;
                ctx.reply(`GO TO ${link}`, { disable_web_page_preview: true })
                await page.goto(link, { waitUntil: "networkidle2", timeout: 60000 })
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

wtfScene.action(/^command-texts/gi, ctx => {
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

wtfScene.action(/^command-visual/gi, ctx => {
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

wtfScene.action(/c-back-\d{1,}/gi, ctx => {
    const pageSize = parseInt(ctx.match[0].replace('c-back-', ''));
    const { curPage: oldCurPage, items, pages } = ctx.session.commands || {};
    if (!items.length) {
        ctx.reply('No commands');
    }
    ctx.session.commands.curPage = oldCurPage - 1;
    const { curPage } = ctx.session.commands;
    const response = renderList(items, curPage, pages, 'c', pageSize);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action(/c-next-\d{1,}/gi, ctx => {
    const pageSize = parseInt(ctx.match[0].replace('c-next-', ''));
    const { curPage: oldCurPage, items, pages } = ctx.session.commands || {};
    if (!items.length) {
        ctx.reply('No commands');
    }
    ctx.session.commands.curPage = oldCurPage + 1;
    const { curPage } = ctx.session.commands;
    const response = renderList(items, curPage, pages, 'c', pageSize);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action(/t-back-\d{1,}/gi, ctx => {
    const pageSize = parseInt(ctx.match[0].replace('t-back-', ''));
    const { curPage: oldCurPage, textItems: items, pages } = ctx.session.posts || {};
    if (!items.length) {
        ctx.reply('No posts');
    }
    ctx.session.posts.curPage = oldCurPage - 1;
    const { curPage } = ctx.session.posts;
    const response = renderList(items, curPage, pages, 't', pageSize);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action(/t-next-\d{1,}/gi, ctx => {
    const pageSize = parseInt(ctx.match[0].replace('t-next-', ''));
    const { curPage: oldCurPage, textItems: items, pages } = ctx.session.posts || {};
    if (!items.length) {
        ctx.reply('No posts');
    }
    ctx.session.posts.curPage = oldCurPage + 1;
    const { curPage } = ctx.session.posts;
    const response = renderList(items, curPage, pages, 't', pageSize);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action(/v-back-\d{1,}/gi, ctx => {
    const pageSize = parseInt(ctx.match[0].replace('v-back-', ''));
    const { curPage: oldCurPage, visualItems: items, pages } = ctx.session.posts || {};
    if (!items.length) {
        ctx.reply('No posts');
    }
    ctx.session.posts.curPage = oldCurPage - 1;
    const { curPage } = ctx.session.posts;
    const response = renderList(items, curPage, pages, 'v', pageSize);
    ctx.editMessageText(response[0], response[1]);
})

wtfScene.action(/v-next-\d{1,}/gi, ctx => {
    const pageSize = parseInt(ctx.match[0].replace('v-next-', ''));
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
            [
                Markup.callbackButton('wtf 2017', `wtf2017`),
                Markup.callbackButton('wtf 2018', `wtf2018`),
            ],
            [
                Markup.callbackButton('wtf 2019', `wtf2019`),
                Markup.callbackButton('wtf 2020', `wtf2020`),
            ],
            [
                Markup.callbackButton('wtf 2019', `wtf2019`),
                Markup.callbackButton('wtf 2020', `wtf2020`),
            ],
            [
                Markup.callbackButton('fb 2016', `fb2016`),
                Markup.callbackButton('fb 2017', `fb2017`),
            ],
            [
                Markup.callbackButton('fb 2018', `fb2018`),
                Markup.callbackButton('fb 2019', `fb2019`),
            ]
        ])
    }
));

Object.keys(urls).map((key) => {
    bot.action(key, ctx => { ctx.scene.enter("wtfScene", { id: key }); return true });
    bot.command(key, ctx => ctx.scene.enter("wtfScene", { id: key }));
});

bot.launch();
