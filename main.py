import os
import asyncio
import logging
import random
from datetime import datetime, timedelta

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.fsm.storage.memory import MemoryStorage

# --- НАЛАШТУВАННЯ ---
TELEGRAM_TOKEN = os.environ["BOT_TOKEN"]

logging.basicConfig(level=logging.INFO)
bot = Bot(token=TELEGRAM_TOKEN)
dp = Dispatcher(storage=MemoryStorage())

# Сховище даних користувачів
users = {}

MOTIVATION_QUOTES = [
    "Кожна година в еластиках — це крок до ідеальної посмішки! ✨",
    "Свіжі еластики тиснуть сильніше. Не давай зубам розслабитися! 🔥",
    "Твій ортодонт буде в шоці від прогресу, якщо ти їх зараз зміниш! 🦷",
    "Чим частіше змінюєш — тим швидше знімеш брекети. Факт! 🚀",
    "Пам'ятай про свою мету. Вона варта цих незручностей! ❤️"
]

def get_efficiency_bar(percent):
    length = 10
    filled = int(length * percent / 100)
    bar = "🔵" * filled + "⚪" * (length - filled)
    return f"[{bar}] {percent}%"

def calculate_wearing_efficiency(minutes):
    """
    Ефективність максимальна (100%) до 120 хв, потім падає.
    """
    if minutes <= 120:
        return 100
    else:
        # Падає на 1% кожні 5 хвилин після 2 годин
        loss = (minutes - 120) // 5
        return max(0, 100 - loss)

def calculate_off_danger(minutes):
    """
    Чим довше без еластиків, тим вища 'небезпека' відкату.
    """
    # 0-30 хв - ок (0-20%), далі різке зростання
    if minutes <= 30:
        return int((minutes / 30) * 20)
    else:
        danger = 20 + (minutes - 30) * 2
        return min(100, danger)

def get_main_keyboard():
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Змінила на свіжі", callback_data="change_done")
    builder.button(text="🥗 Починаю їсти", callback_data="start_eating")
    builder.button(text="🦷 Одягла (після їжі)", callback_data="end_eating")
    builder.button(text="📊 Мій прогрес", callback_data="show_stats")
    builder.adjust(1)
    return builder.as_markup()

async def send_loading_animation(message: types.Message, text="Аналізую твій прогрес..."):
    frames = ["⏳", "⌛", "🔄", "✨"]
    sent_message = await message.answer(f"{frames[0]} {text}")
    for i in range(1, 4):
        await asyncio.sleep(0.4)
        await sent_message.edit_text(f"{frames[i]} {text}")
    return sent_message

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    user_id = message.from_user.id
    users[user_id] = {
        "last_change": datetime.now(),
        "is_wearing": True,
        "is_eating": False,
        "streak": 0,
        "total_changes": 0
    }
    await message.answer(
        "Привіт, красуне! 🦷✨\nЯ твій персональний еластики-коуч.\n\n"
        "Я буду стежити за **ефективністю** твоїх еластиків. "
        "Пам'ятай: через 2 години вони починають 'слабшати'!",
        reply_markup=get_main_keyboard(),
        parse_mode="Markdown"
    )

@dp.callback_query(F.data == "change_done")
async def handle_change(callback: types.CallbackQuery):
    user_id = callback.from_user.id
    if user_id not in users: users[user_id] = {"last_change": datetime.now(), "is_wearing": True, "is_eating": False, "streak": 0, "total_changes": 0}
    
    users[user_id].update({
        "last_change": datetime.now(),
        "streak": users[user_id]["streak"] + 1,
        "total_changes": users[user_id]["total_changes"] + 1,
        "is_wearing": True,
        "is_eating": False
    })
    
    await callback.answer("Ти супер! 🔥")
    await callback.message.answer(
        f"✨ **Свіжі еластики в справі!**\n\n"
        f"Зараз вони тиснуть як слід. Наступні 2 години — твій піковий прогрес! 🔥\n"
        f"Це твоя {users[user_id]['streak']}-та зміна! Пишаюся тобою! 🌟",
        reply_markup=get_main_keyboard(),
        parse_mode="Markdown"
    )

@dp.callback_query(F.data == "start_eating")
async def handle_eating(callback: types.CallbackQuery):
    user_id = callback.from_user.id
    if user_id not in users: users[user_id] = {"last_change": datetime.now(), "is_wearing": True, "is_eating": False, "streak": 0, "total_changes": 0}
    
    users[user_id]["is_eating"] = True
    users[user_id]["is_wearing"] = False
    users[user_id]["last_change"] = datetime.now()
    
    await callback.answer("Смачного! 😊")
    await callback.message.answer(
        "🥗 **Еластики знято.**\n\n"
        "Насолоджуйся їжею, але пам'ятай: через 45 хвилин зуби почнуть 'сумувати' за тиском. "
        "Я дам знати, коли час повертати їх! 🔔",
        reply_markup=get_main_keyboard(),
        parse_mode="Markdown"
    )

@dp.callback_query(F.data == "end_eating")
async def handle_end_eating(callback: types.CallbackQuery):
    user_id = callback.from_user.id
    if user_id not in users: users[user_id] = {"last_change": datetime.now(), "is_wearing": True, "is_eating": False, "streak": 0, "total_changes": 0}

    users[user_id]["is_eating"] = False
    users[user_id]["is_wearing"] = True
    users[user_id]["last_change"] = datetime.now()
    
    await callback.answer("З поверненням! 🦷")
    await callback.message.answer(
        "💎 **Знову в справі!**\n\n"
        "Ти вчасно повернула еластики. Процес вирівнювання продовжено. "
        "Таймер свіжості запущено! ✨",
        reply_markup=get_main_keyboard(),
        parse_mode="Markdown"
    )

@dp.callback_query(F.data == "show_stats")
async def handle_stats(callback: types.CallbackQuery):
    user_id = callback.from_user.id
    if user_id not in users:
        await callback.answer("Спочатку натисніть /start")
        return

    msg = await send_loading_animation(callback.message)
    await asyncio.sleep(0.5)

    now = datetime.now()
    diff = now - users[user_id]["last_change"]
    total_minutes = int(diff.total_seconds() / 60)
    hours, minutes = divmod(total_minutes, 60)
    
    if users[user_id]["is_wearing"]:
        eff = calculate_wearing_efficiency(total_minutes)
        bar = get_efficiency_bar(eff)
        status_text = f"⚙️ **Ефективність тиску:**\n{bar}\n"
        if total_minutes > 120:
            status_text += "⚠️ *Еластики розтягнулися! Пора змінити на нові!*"
        else:
            status_text += "✅ *Чудова робота! Вони ще добре тиснуть.*"
    else:
        danger = calculate_off_danger(total_minutes)
        bar = "🔴" * (danger // 10) + "⚪" * (10 - danger // 10)
        status_text = f"⚠️ **Ризик відкату (зуби повертаються):**\n[{bar}] {danger}%\n"
        if total_minutes > 45:
            status_text += "🚨 *Занадто довга пауза! Швидше одягай їх!*"
        else:
            status_text += "🥗 *Смачного! Постарайся вкластися в 45 хвилин.*"

    await msg.edit_text(
        f"📊 **Твій статус:**\n\n"
        f"⏱ Час: `{hours:02d}:{minutes:02d}`\n"
        f"{status_text}\n\n"
        f"🔥 Стрік замін: {users[user_id]['streak']}\n"
        f"💎 Всього за день: {users[user_id]['total_changes']}",
        reply_markup=get_main_keyboard(),
        parse_mode="Markdown"
    )

async def reminder_loop():
    while True:
        await asyncio.sleep(60)
        now = datetime.now()
        for user_id, data in users.items():
            diff = now - data["last_change"]
            minutes = int(diff.total_seconds() / 60)
            
            if data["is_wearing"] and not data["is_eating"] and minutes >= 90:
                try:
                    await bot.send_message(user_id, f"⏰ **Пора оновити еластики!**\nМинуло 1.5 години. Ефективність падає! 📉\n\n_{random.choice(MOTIVATION_QUOTES)}_", reply_markup=get_main_keyboard(), parse_mode="Markdown")
                    data["last_change"] = now
                except: pass
            
            if data["is_eating"] and minutes >= 45:
                try:
                    await bot.send_message(user_id, "🔔 **Гей, забарилася!**\nЗуби вже починають рухатися не туди. Швидше одягай еластики! 🏃‍♀️🦷", reply_markup=get_main_keyboard(), parse_mode="Markdown")
                    data["last_change"] = now
                except: pass

async def main():
    asyncio.create_task(reminder_loop())
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
