"""Database module for DrawDrum settings persistence."""

import os
import aiosqlite
from datetime import datetime
from typing import Optional

# Use /data for Render persistent disk, fallback to local for development
DATA_DIR = "/data" if os.path.exists("/data") else "."
DB_PATH = os.path.join(DATA_DIR, "drawdrum.db")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")

# Ensure uploads directory exists
os.makedirs(UPLOADS_DIR, exist_ok=True)


async def init_db():
    """Initialize the database and create tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY,
                passport_text TEXT DEFAULT '',
                logo_path TEXT DEFAULT '',
                text_color TEXT DEFAULT '#FFFFFF',
                text_style TEXT DEFAULT 'normal',
                display_text_size INTEGER DEFAULT 96,
                timer_size INTEGER DEFAULT 96,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Ensure we have a settings row
        cursor = await db.execute("SELECT COUNT(*) FROM settings")
        count = await cursor.fetchone()
        if count[0] == 0:
            await db.execute(
                "INSERT INTO settings (id, passport_text, logo_path, text_color, text_style, display_text_size, timer_size) VALUES (1, '', '', '#FFFFFF', 'normal', 96, 96)"
            )
        
        # Migration: Add new columns if they don't exist
        try:
            await db.execute("ALTER TABLE settings ADD COLUMN text_color TEXT DEFAULT '#FFFFFF'")
        except:
            pass
        try:
            await db.execute("ALTER TABLE settings ADD COLUMN text_style TEXT DEFAULT 'normal'")
        except:
            pass
        try:
            await db.execute("ALTER TABLE settings ADD COLUMN display_text_size INTEGER DEFAULT 96")
        except:
            pass
        try:
            await db.execute("ALTER TABLE settings ADD COLUMN timer_size INTEGER DEFAULT 96")
        except:
            pass
        try:
            await db.execute("ALTER TABLE settings ADD COLUMN prize_text TEXT DEFAULT ''")
        except:
            pass
        try:
            await db.execute("ALTER TABLE settings ADD COLUMN columns INTEGER DEFAULT 1")
        except:
            pass
        try:
            await db.execute("ALTER TABLE settings ADD COLUMN prize_size INTEGER DEFAULT 72")
        except:
            pass
        try:
            await db.execute("ALTER TABLE settings ADD COLUMN prize_color TEXT DEFAULT '#F97316'")
        except:
            pass
        
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
                "text_color": row["text_color"] or "#FFFFFF",
                "text_style": row["text_style"] or "bold",
                "display_text_size": row["display_text_size"] or 72,
                "timer_size": row["timer_size"] or 24,
                "columns": row["columns"] if "columns" in keys else 1,
                "prize_size": row["prize_size"] if "prize_size" in keys else 72,
                "prize_color": row["prize_color"] if "prize_color" in keys else "#F97316",
                "updated_at": row["updated_at"]
            }
        return {
            "passport_text": "", 
            "prize_text": "",
            "logo_path": "", 
            "text_color": "#FFFFFF",
            "text_style": "bold",
            "display_text_size": 72,
            "timer_size": 24,
            "columns": 1,
            "prize_size": 72,
            "prize_color": "#F97316",
            "updated_at": None
        }


async def update_passport_text(text: str, prize: str = None) -> dict:
    """Update the passport text and optionally prize text in the database."""
    async with aiosqlite.connect(DB_PATH) as db:
        if prize is not None:
            await db.execute(
                "UPDATE settings SET passport_text = ?, prize_text = ?, updated_at = ? WHERE id = 1",
                (text, prize, datetime.utcnow().isoformat())
            )
        else:
            await db.execute(
                "UPDATE settings SET passport_text = ?, updated_at = ? WHERE id = 1",
                (text, datetime.utcnow().isoformat())
            )
        await db.commit()
    return await get_settings()


async def update_logo_path(path: str) -> dict:
    """Update the logo path in the database."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE settings SET logo_path = ?, updated_at = ? WHERE id = 1",
            (path, datetime.utcnow().isoformat())
        )
        await db.commit()
    return await get_settings()


async def update_text_formatting(formatting: dict) -> dict:
    """Update text formatting settings in the database."""
    async with aiosqlite.connect(DB_PATH) as db:
        color = formatting.get("color", "#FFFFFF")
        style = formatting.get("style", "bold")
        display_text_size = formatting.get("displayTextSize", 72)
        timer_size = formatting.get("timerSize", 24)
        columns = formatting.get("columns", 1)
        prize_size = formatting.get("prizeSize", 72)
        prize_color = formatting.get("prizeColor", "#F97316")
        
        await db.execute(
            "UPDATE settings SET text_color = ?, text_style = ?, display_text_size = ?, timer_size = ?, columns = ?, prize_size = ?, prize_color = ?, updated_at = ? WHERE id = 1",
            (color, style, display_text_size, timer_size, columns, prize_size, prize_color, datetime.utcnow().isoformat())
        )
        await db.commit()
    return await get_settings()
