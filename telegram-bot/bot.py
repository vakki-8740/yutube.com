import os
import requests
import logging
from datetime import datetime
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
        logger.error(f'get_status error: {e}')
        return None

def set_status(enabled: bool):
    try:
        r = requests.post(f'{BACKEND_URL}/api/admin/toggle', json={'enabled': enabled}, timeout=10)
        data = r.json()
        return data.get('enabled')
    except Exception as e:
        logger.error(f'set_status error: {e}')
        return None

def status_line(enabled):
    if enabled is None:
        return '⚠️ *Status:* Unknown'
    status_emoji = '✅' if enabled else '❌'
    status_text = 'ON' if enabled else 'OFF'
    color = '🟢' if enabled else '🔴'
    return f'{color} *Status:* {status_emoji} `{status_text}`'

def main_menu(enabled):
    status_emoji = '✅' if enabled else '❌'
    status_word = 'ON' if enabled else 'OFF'
    color = '🟢' if enabled else '🔴'

    text = (
        f'┌─────────────────────────────┐\n'
        f'│      📱 *App Control*       │\n'
        f'├─────────────────────────────┤\n'
        f'│ {color} App is *{status_word}* {status_emoji}         │\n'
        f'├─────────────────────────────┤\n'
        f'│ Tap a button to control     │\n'
        f'│ the app:                    │\n'
        f'└─────────────────────────────┘'
    )
    return text

def home_keyboard():
    keyboard = [
        [
            InlineKeyboardButton('✅ Turn ON', callback_data='toggle_on'),
            InlineKeyboardButton('❌ Turn OFF', callback_data='toggle_off')
        ],
        [
            InlineKeyboardButton('🔄 Refresh Status', callback_data='refresh')
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

async def send_home(update: Update, context: ContextTypes.DEFAULT_TYPE, edit: bool = False):
    enabled = get_status()
    text = main_menu(enabled)

    if edit:
        try:
            await update.callback_query.edit_message_text(text, parse_mode='Markdown', reply_markup=home_keyboard())
        except Exception:
            await update.callback_query.message.reply_text(text, parse_mode='Markdown', reply_markup=home_keyboard())
    else:
        await update.message.reply_text(text, parse_mode='Markdown', reply_markup=home_keyboard())

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await send_home(update, context, edit=False)

async def home(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await send_home(update, context, edit=False)

async def menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await send_home(update, context, edit=False)

async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    enabled = get_status()
    line = status_line(enabled)
    msg = f'📊 *App Status*\n\n{line}'
    await update.message.reply_text(msg, parse_mode='Markdown')

async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    help_text = (
        '📖 *Available Commands*\n\n'
        '┌─────────────────────────┐\n'
        '│ `/start` ─ Open menu   │\n'
        '│ `/menu`  ─ Main menu   │\n'
        '│ `/status`─ Check status│\n'
        '│ `/help`  ─ This help   │\n'
        '└─────────────────────────┘\n\n'
        '*Buttons:*\n'
        '✅ *Turn ON*  — Enable the app for all users\n'
        '❌ *Turn OFF* — Disable the app, show maintenance\n'
        '🔄 *Refresh*  — Update current status'
    )
    await update.message.reply_text(help_text, parse_mode='Markdown')

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data == 'refresh':
        await send_home(update, context, edit=True)
        return

    if query.data == 'toggle_on':
        result = set_status(True)
    elif query.data == 'toggle_off':
        result = set_status(False)
    else:
        result = None

    if query.data == 'toggle_on' and result is True:
        toast = '✅ App turned *ON*'
    elif query.data == 'toggle_off' and result is False:
        toast = '❌ App turned *OFF*'
    else:
        toast = '⚠️ Failed — check backend connection'

    try:
        await query.answer(toast, parse_mode='Markdown', show_alert=False)
    except Exception:
        await query.answer('Done', show_alert=False)

    await send_home(update, context, edit=True)

def main():
    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler('start', start))
    app.add_handler(CommandHandler('menu', menu))
    app.add_handler(CommandHandler('home', home))
    app.add_handler(CommandHandler('status', status))
    app.add_handler(CommandHandler('help', help_cmd))
    app.add_handler(CallbackQueryHandler(button_handler))

    logger.info('Bot started — iOS style')
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
