const axios = require('axios');
const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const port_number = process.env.PORT || 3000;
app.listen(port_number);

const Telegraf = require('telegraf')
const token = '1023369485:AAE0nFWhuBO-al13tMM8ULsYERw3RelGrHc';
const url = 'http://www.diary.ru/api/';

const bot = new Telegraf(token)
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
                try {
                    const data = [];
                    const items = document.querySelectorAll('[data-spoiler-content-requests1] tr:nth-child(n+2)');
                    for (const tr of items) {
                        data.push({
                            id: tr.querySelector('td:nth-child(1) > a').innerText.trim(),
                            date: tr.querySelector('td:nth-child(1) > div').innerText.trim(),
                            name: tr.querySelector('td:nth-child(2) > div:nth-child(2)').innerText.trim(),
                            type: tr.querySelector('td:nth-child(3) > div:nth-child(2)').innerText.trim(),
                            comment: tr.querySelector('td:nth-child(4) > div').innerText.trim().replace(/\s{2,}/g, " "),
                        })
                    }
                    return data;
                } catch (err) {
                    return err;
                }
            });
            res.map(
                (el, i) => {
                    if (i < 5) {
                        ctx.reply(
                            `<b>${el.name}</b>: ${el.type} \n ${el.comment}`,
                            { parse_mode: 'HTML' }
                        )
                    }
                }
            )
        } catch (err) {
            ctx.reply(`ERROR ${JSON.stringify(err).slice(0, 4000)}`)
        }
        await browser.close();
    })(ctx)
})
bot.launch()