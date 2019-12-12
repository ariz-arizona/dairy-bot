const axios = require('axios');
const puppeteer = require('puppeteer');

const Telegraf = require('telegraf')
const token = '1023369485:AAE0nFWhuBO-al13tMM8ULsYERw3RelGrHc';
const url = 'http://www.diary.ru/api/';

const bot = new Telegraf(token)
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
bot.hears('beetle', ctx => {
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
            await page.goto('https://911911.org/oper/login')
            await page.type('#formoperlogin-login', 'a.pluta')
            await page.type('#formoperlogin-password', '71284198')
            page.click('button[type="submit"]')
            await page.waitForNavigation()
            await page.goto('https://911911.org/dashboard/main/requests-ltv', { waitUntil: 'domcontentloaded' });
            const res = await page.evaluate(() => {
                // return document.querySelectorAll('[data-spoiler-content-requests1] tr')[0].innerText
                try {
                    return [].forEach.call(document.querySelectorAll(
                        '[data-spoiler-content-requests1] tr:nth-child(n+2)'),
                        function (node, i) {
                            const item = {};
                            const cells = node.querySelectorAll('td');
                            if (cells) {
                                item.id = cells[0].querySelector('*:first-child').innerText;
                                item.address = cells[1].querySelector('*:last-child').innerText;
                            }
                            console.log(item)
                            return item;
                        }
                    );
                } catch (err) {
                    return err;
                }
            });
            ctx.reply(JSON.stringify(res).slice(0, 4096))
        } catch (err) {
            ctx.reply(`ERROR ${JSON.stringify(err).slice(0, 4000)}`)
        }
        await browser.close();
    })(ctx)
})
bot.launch()