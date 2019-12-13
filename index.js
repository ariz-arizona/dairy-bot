const axios = require('axios');
const puppeteer = require('puppeteer');
const Telegraf = require('telegraf');
const Markup = require('telegraf/markup');

const url = 'http://www.diary.ru/api/';

const bot = new Telegraf(process.env.TOKEN)
bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err)
});
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
bot.command('beetle', ctx => {
    (async (ctx) => {
        const browser = await puppeteer.launch({
            headless: true, args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process'
            ],
        })
        try {
            const page = await browser.newPage()
            ctx.reply("OPEN BROWSER");
            await page.goto('https://911911.org/oper/login')
            await page.type('#formoperlogin-login', 'a.pluta')
            await page.type('#formoperlogin-password', '71284198')
            page.click('button[type="submit"]');
            ctx.reply("WAIT LOGIN");
            await page.waitForNavigation()
            ctx.reply("WAIT DATA");
            await page.goto('https://911911.org/dashboard/main/requests-ltv', { waitUntil: 'domcontentloaded' });
            const res = await page.evaluate(() => {
                try {
                    const data = [];
                    const items = document.querySelectorAll('[data-spoiler-content-requests1] tr:nth-child(n+2)');
                    for (const tr of items) {
                        data.push({
                            id: tr.querySelector('td:nth-child(1) > a').innerText.trim(),
                            date: tr.querySelector('td:nth-child(1) > div').innerText.trim(),
                            name: tr.querySelector('td:nth-child(2) > div:nth-child(2)').innerText.trim(),
                            type: tr.querySelector('td:nth-child(3) > div:nth-child(2)').innerText.trim(),
                            comment: tr.querySelector('td:nth-child(4) > div').innerText.replace(/[ , \t]{2,}/g, " ").replace(/\n{2,}/g, /\n/)
                        })
                    }
                    return data;
                } catch (err) {
                    return [err];
                }
            });
            const types = [];
            res.map(el => {
                if (types.indexOf(el.type) !== -1) {
                    types.push(el.type);
                }
            })
            ctx.state.data = res;
            ctx.state.types = types;
            ctx.reply(
                `Найдено записей: <b>${res.length}</b>\n${JSON.stringify(types)}`,
                {
                    parse_mode: 'HTML',
                    reply_markup: Markup.inlineKeyboard(
                        types.map((el, i) => {
                            return [Markup.callbackButton(el, 'show_items_by_type', i)]
                        })
                    )
                }
            )
        } catch (err) {
            ctx.reply(`ERROR ${JSON.stringify(err).slice(0, 4000)}`)
        }
        await browser.close();
    })(ctx)
});
bot.action('show_items_by_type', (ctx, id) => {
    const type = ctx.state.types[id];
    const res = ctx.state.data.filter(el => { el.type === type });
    res.map(el => {
        ctx.reply(el.name)
    })
});
bot.launch()