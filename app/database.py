"""Database module for DrawDrum settings persistence."""

import os
import aiosqlite
from datetime import datetime, timezone

# Use /data for Render persistent disk, fallback to local for development
DATA_DIR = "/data" if os.path.exists("/data") else "."
DB_PATH = os.path.join(DATA_DIR, "drawdrum.db")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")

# Ensure uploads directory exists
os.makedirs(UPLOADS_DIR, exist_ok=True)

# =============================================================================
# Constants - Default values (must match main.py and app.js)
# =============================================================================
DEFAULT_TEXT_COLOR = "#FFFFFF"
DEFAULT_TEXT_STYLE = "bold"
DEFAULT_DISPLAY_TEXT_SIZE = 72
DEFAULT_TIMER_SIZE = 48
DEFAULT_COLUMNS = 1
DEFAULT_PRIZE_SIZE = 72
DEFAULT_PRIZE_COLOR = "#F97316"


def get_utc_now() -> str:
    """Get current UTC time in ISO format."""
    return datetime.now(timezone.utc).isoformat()


async def init_db():
    """Initialize the database and create tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(f"""
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY,
                passport_text TEXT DEFAULT '',
                logo_path TEXT DEFAULT '',
                text_color TEXT DEFAULT '{DEFAULT_TEXT_COLOR}',
                text_style TEXT DEFAULT '{DEFAULT_TEXT_STYLE}',
                display_text_size INTEGER DEFAULT {DEFAULT_DISPLAY_TEXT_SIZE},
                timer_size INTEGER DEFAULT {DEFAULT_TIMER_SIZE},
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Ensure we have a settings row
        cursor = await db.execute("SELECT COUNT(*) FROM settings")
        count = await cursor.fetchone()
        if count[0] == 0:
            await db.execute(
                f"INSERT INTO settings (id, passport_text, logo_path, text_color, text_style, display_text_size, timer_size) VALUES (1, '', '', '{DEFAULT_TEXT_COLOR}', '{DEFAULT_TEXT_STYLE}', {DEFAULT_DISPLAY_TEXT_SIZE}, {DEFAULT_TIMER_SIZE})"
            )
        
        # Migration: Add new columns if they don't exist
        # Using sqlite_master to check for existing columns is more robust than catching exceptions
        cursor = await db.execute("PRAGMA table_info(settings)")
        existing_columns = {row[1] for row in await cursor.fetchall()}
        
        migrations = [
            ("text_color", f"TEXT DEFAULT '{DEFAULT_TEXT_COLOR}'"),
            ("text_style", f"TEXT DEFAULT '{DEFAULT_TEXT_STYLE}'"),
            ("display_text_size", f"INTEGER DEFAULT {DEFAULT_DISPLAY_TEXT_SIZE}"),
            ("timer_size", f"INTEGER DEFAULT {DEFAULT_TIMER_SIZE}"),
            ("prize_text", "TEXT DEFAULT ''"),
            ("columns", f"INTEGER DEFAULT {DEFAULT_COLUMNS}"),
            ("prize_size", f"INTEGER DEFAULT {DEFAULT_PRIZE_SIZE}"),
            ("prize_color", f"TEXT DEFAULT '{DEFAULT_PRIZE_COLOR}'"),
        ]
        
        for column_name, column_def in migrations:
            if column_name not in existing_columns:
                await db.execute(f"ALTER TABLE settings ADD COLUMN {column_name} {column_def}")
        
        await db.commit()


async def get_settings() -> dict:
    """Get current settings from database."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT passport_text, prize_text, logo_path, text_color, text_style, display_text_size, timer_size, columns, prize_size, prize_color, updated_at FROM settings WHERE id = 1"
        )
        row = await cursor.fetchone()
        if row:
            keys = row.keys()
            return {
                "passport_text": row["passport_text"] or "",
                "prize_text": row["prize_text"] if "prize_text" in keys else "",
                "logo_path": row["logo_path"] or "",
                "text_color": row["text_color"] or DEFAULT_TEXT_COLOR,
                "text_style": row["text_style"] or DEFAULT_TEXT_STYLE,
                "display_text_size": row["display_text_size"] or DEFAULT_DISPLAY_TEXT_SIZE,
                "timer_size": row["timer_size"] or DEFAULT_TIMER_SIZE,
                "columns": row["columns"] if "columns" in keys else DEFAULT_COLUMNS,
                "prize_size": row["prize_size"] if "prize_size" in keys else DEFAULT_PRIZE_SIZE,
                "prize_color": row["prize_color"] if "prize_color" in keys else DEFAULT_PRIZE_COLOR,
                "updated_at": row["updated_at"]
            }
        return {
            "passport_text": "", 
            "prize_text": "",
            "logo_path": "", 
            "text_color": DEFAULT_TEXT_COLOR,
            "text_style": DEFAULT_TEXT_STYLE,
            "display_text_size": DEFAULT_DISPLAY_TEXT_SIZE,
            "timer_size": DEFAULT_TIMER_SIZE,
            "columns": DEFAULT_COLUMNS,
            "prize_size": DEFAULT_PRIZE_SIZE,
            "prize_color": DEFAULT_PRIZE_COLOR,
            "updated_at": None
        }


async def update_passport_text(text: str, prize: str = None) -> dict:
    """Update the passport text and optionally prize text in the database."""
    async with aiosqlite.connect(DB_PATH) as db:
        if prize is not None:
            await db.execute(
                "UPDATE settings SET passport_text = ?, prize_text = ?, updated_at = ? WHERE id = 1",
                (text, prize, get_utc_now())
            )
        else:
            await db.execute(
                "UPDATE settings SET passport_text = ?, updated_at = ? WHERE id = 1",
                (text, get_utc_now())
            )
        await db.commit()
    return await get_settings()


async def update_logo_path(path: str) -> dict:
    """Update the logo path in the database."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE settings SET logo_path = ?, updated_at = ? WHERE id = 1",
            (path, get_utc_now())
        )
        await db.commit()
    return await get_settings()


async def update_text_formatting(formatting: dict) -> dict:
    """Update text formatting settings in the database."""
    async with aiosqlite.connect(DB_PATH) as db:
        color = formatting.get("color", DEFAULT_TEXT_COLOR)
        style = formatting.get("style", DEFAULT_TEXT_STYLE)
        display_text_size = formatting.get("displayTextSize", DEFAULT_DISPLAY_TEXT_SIZE)
        timer_size = formatting.get("timerSize", DEFAULT_TIMER_SIZE)
        columns = formatting.get("columns", DEFAULT_COLUMNS)
        prize_size = formatting.get("prizeSize", DEFAULT_PRIZE_SIZE)
        prize_color = formatting.get("prizeColor", DEFAULT_PRIZE_COLOR)
        
        await db.execute(
            "UPDATE settings SET text_color = ?, text_style = ?, display_text_size = ?, timer_size = ?, columns = ?, prize_size = ?, prize_color = ?, updated_at = ? WHERE id = 1",
            (color, style, display_text_size, timer_size, columns, prize_size, prize_color, get_utc_now())
        )
        await db.commit()
    return await get_settings()
