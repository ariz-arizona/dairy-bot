const axios = require('axios');
const Telegraf = require('telegraf');
const session = require('telegraf/session')
const Stage = require('telegraf/stage')
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

const bot = new Telegraf(process.env.TOKEN)

bot.catch((err, ctx) => {
    console.log(`Ooops, ecountered an error for ${ctx.updateType}`, err);
    ctx.reply("ERROR! LOOK LOGS PLS")
});

const wtfScene = new WizardScene(
    "wtfScene", // Имя сцены
    (ctx) => {
      ctx.reply('Этап 1: выбор типа матча.');
      return ctx.wizard.next(); // Переходим к следующему обработчику.
    },
    (ctx) => {
      ctx.reply('Этап 2: выбор времени проведения матча.');
      return ctx.wizard.next(); // Переходим к следующему обработчику.
    },
    (ctx) => {
      if (ctx.message.text === "Назад") {
        ctx.wizard.back(); // Вернуться к предыдущиму обработчику
      }
      ctx.reply('Этап 3: выбор места проведения матча.');
      return ctx.wizard.next(); // Переходим к следующему обработчику.
    },
    
    // ...
  
    (ctx) => {
      ctx.reply('Финальный этап: создание матча.');
      return ctx.scene.leave();
    }
  );
  
  // Создаем менеджера сцен
  const stage = new Stage();
  
  // Регистрируем сцену создания матча
  stage.register(wtfScene);
  
  bot.use(session());
  bot.use(stage.middleware());
  bot.command("wtfScene", (ctx) => ctx.scene.enter("wtfScene"));

  bot.launch();