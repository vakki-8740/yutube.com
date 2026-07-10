import os
import requests
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

BACKEND_URL = os.environ.get('BACKEND_URL', 'https://yutube-com-pcu9.onrender.com')
TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN') or '8995589618:AAHWxs2-bmpuwZi3BI7LIjppxpdH5-WmYkw'

def get_status():
    try:
        r = requests.get(f'{BACKEND_URL}/api/admin/status', timeout=10)
        data = r.json()
        return data.get('enabled', True)
    except Exception as e:
        logger.error(f'Failed to get status: {e}')
        return None

def set_status(enabled: bool):
    try:
        r = requests.post(f'{BACKEND_URL}/api/admin/toggle', json={'enabled': enabled}, timeout=10)
        data = r.json()
        return data.get('enabled')
    except Exception as e:
        logger.error(f'Failed to set status: {e}')
        return None

def get_keyboard():
    keyboard = [
        [
            InlineKeyboardButton('✅ ON', callback_data='toggle_on'),
            InlineKeyboardButton('❌ OFF', callback_data='toggle_off')
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    enabled = get_status()
    if enabled is None:
        status_text = '⚠️ Unable to fetch status'
    elif enabled:
        status_text = '✅ App is currently ON'
    else:
        status_text = '❌ App is currently OFF'

    await update.message.reply_text(
        f'*App Control Bot*\n\n{status_text}\n\nUse the buttons below to turn the app ON or OFF:',
        parse_mode='Markdown',
        reply_markup=get_keyboard()
    )

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data == 'toggle_on':
        result = set_status(True)
        if result is True:
            status_text = '✅ App is now *ON*'
        else:
            status_text = '⚠️ Failed to turn ON'
    elif query.data == 'toggle_off':
        result = set_status(False)
        if result is False:
            status_text = '❌ App is now *OFF*'
        else:
            status_text = '⚠️ Failed to turn OFF'
    else:
        status_text = '⚠️ Unknown action'

    enabled = get_status()
    if enabled is None:
        current_status = '⚠️ Unable to fetch status'
    elif enabled:
        current_status = '✅ App is ON'
    else:
        current_status = '❌ App is OFF'

    try:
        await query.edit_message_text(
            f'*App Control Bot*\n\n{current_status}\n\nUse the buttons below to turn the app ON or OFF:',
            parse_mode='Markdown',
            reply_markup=get_keyboard()
        )
    except Exception as e:
        logger.error(f'Failed to edit message: {e}')
        await query.message.reply_text(status_text, parse_mode='Markdown')

async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    enabled = get_status()
    if enabled is None:
        await update.message.reply_text('⚠️ Unable to fetch app status.')
    elif enabled:
        await update.message.reply_text('✅ App is currently *ON*', parse_mode='Markdown')
    else:
        await update.message.reply_text('❌ App is currently *OFF*', parse_mode='Markdown')

def main():
    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler('start', start))
    app.add_handler(CommandHandler('status', status))
    app.add_handler(CallbackQueryHandler(button_handler))

    logger.info('Bot started. Polling...')
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
