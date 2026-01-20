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
                text_size TEXT DEFAULT 'normal',
                text_style TEXT DEFAULT 'normal',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Ensure we have a settings row
        cursor = await db.execute("SELECT COUNT(*) FROM settings")
        count = await cursor.fetchone()
        if count[0] == 0:
            await db.execute(
                "INSERT INTO settings (id, passport_text, logo_path, text_color, text_size, text_style) VALUES (1, '', '', '#FFFFFF', 'normal', 'normal')"
            )
        
        # Migration: Add new columns if they don't exist
        try:
            await db.execute("ALTER TABLE settings ADD COLUMN text_color TEXT DEFAULT '#FFFFFF'")
        except:
            pass
        try:
            await db.execute("ALTER TABLE settings ADD COLUMN text_size TEXT DEFAULT 'normal'")
        except:
            pass
        try:
            await db.execute("ALTER TABLE settings ADD COLUMN text_style TEXT DEFAULT 'normal'")
        except:
            pass
        
        await db.commit()


async def get_settings() -> dict:
    """Get current settings from database."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT passport_text, logo_path, text_color, text_size, text_style, updated_at FROM settings WHERE id = 1"
        )
        row = await cursor.fetchone()
        if row:
            return {
                "passport_text": row["passport_text"] or "",
                "logo_path": row["logo_path"] or "",
                "text_color": row["text_color"] or "#FFFFFF",
                "text_size": row["text_size"] or "normal",
                "text_style": row["text_style"] or "normal",
                "updated_at": row["updated_at"]
            }
        return {
            "passport_text": "", 
            "logo_path": "", 
            "text_color": "#FFFFFF",
            "text_size": "normal",
            "text_style": "normal",
            "updated_at": None
        }


async def update_passport_text(text: str) -> dict:
    """Update the passport text in the database."""
    async with aiosqlite.connect(DB_PATH) as db:
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
        size = formatting.get("size", "normal")
        style = formatting.get("style", "normal")
        
        await db.execute(
            "UPDATE settings SET text_color = ?, text_size = ?, text_style = ?, updated_at = ? WHERE id = 1",
            (color, size, style, datetime.utcnow().isoformat())
        )
        await db.commit()
    return await get_settings()
