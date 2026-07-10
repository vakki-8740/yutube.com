const { pool } = require('./db');

let bot = null;

function startBot(token) {
  if (!token) {
    console.log('Telegram bot token not configured. Bot not started.');
    return;
  }

  try {
    const TelegramBot = require('node-telegram-bot-api');
    bot = new TelegramBot(token, { polling: true });

    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const currentStatus = await getAppStatus();
      const statusText = currentStatus ? '✅ App is ON' : '❌ App is OFF';

      bot.sendMessage(chatId,
        '*App Control*\n\n' + statusText + '\n\nUse the buttons below to turn the app ON or OFF:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ ON', callback_data: 'toggle_on' },
                { text: '❌ OFF', callback_data: 'toggle_off' }
              ]
            ]
          }
        }
      ).catch(err => console.error('Telegram send error:', err));
    });

    bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const data = query.data;

      if (data === 'toggle_on') {
        await setAppStatus(true);
        await bot.sendMessage(chatId, '✅ App is now *ON*', { parse_mode: 'Markdown' });
        await bot.answerCallbackQuery(query.id, { text: 'App turned ON' });
      } else if (data === 'toggle_off') {
        await setAppStatus(false);
        await bot.sendMessage(chatId, '❌ App is now *OFF*', { parse_mode: 'Markdown' });
        await bot.answerCallbackQuery(query.id, { text: 'App turned OFF' });
      }

      const newStatus = await getAppStatus();
      const statusText = newStatus ? '✅ App is ON' : '❌ App is OFF';

      try {
        await bot.editMessageText(
          '*App Control*\n\n' + statusText + '\n\nUse the buttons below to turn the app ON or OFF:',
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ ON', callback_data: 'toggle_on' },
                  { text: '❌ OFF', callback_data: 'toggle_off' }
                ]
              ]
            }
          }
        );
      } catch (err) {
        console.error('Telegram edit error:', err);
      }
    });

    bot.on('polling_error', (err) => {
      console.error('Telegram polling error:', err.message);
    });

    console.log('Telegram bot started successfully');
  } catch (err) {
    console.error('Failed to start Telegram bot:', err.message);
  }
}

async function getAppStatus() {
  try {
    const result = await pool.query("SELECT value FROM app_config WHERE key = 'app_enabled'");
    return result.rows.length > 0 ? result.rows[0].value === 'true' : true;
  } catch (err) {
    console.error('Error reading app status:', err);
    return true;
  }
}

async function setAppStatus(enabled) {
  try {
    await pool.query(
      "INSERT INTO app_config (key, value, updated_at) VALUES ('app_enabled', $1, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP",
      [enabled ? 'true' : 'false']
    );
  } catch (err) {
    console.error('Error setting app status:', err);
  }
}

function stopBot() {
  if (bot) {
    bot.stopPolling().catch(() => {});
    bot = null;
    console.log('Telegram bot stopped');
  }
}

module.exports = { startBot, stopBot, getAppStatus, setAppStatus };
