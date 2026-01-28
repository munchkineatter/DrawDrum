"""FastAPI application for DrawDrum - Real-time drum drawing display."""

import os
import uuid
from typing import List
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import aiofiles

from app.database import (
    init_db, 
    get_settings, 
    update_passport_text, 
    update_logo_path,
    update_text_formatting,
    UPLOADS_DIR
)

# =============================================================================
# Constants - Centralized default values
# =============================================================================
MAX_LOGO_SIZE_MB = 20
MAX_LOGO_SIZE_BYTES = MAX_LOGO_SIZE_MB * 1024 * 1024  # 20 MB

# Default formatting values (must match database.py and app.js)
DEFAULT_TEXT_COLOR = "#FFFFFF"
DEFAULT_TEXT_STYLE = "bold"
DEFAULT_DISPLAY_TEXT_SIZE = 72
DEFAULT_TIMER_SIZE = 48
DEFAULT_COLUMNS = 1
DEFAULT_PRIZE_SIZE = 72
DEFAULT_PRIZE_COLOR = "#F97316"


class ConnectionManager:
    """Manages WebSocket connections for real-time broadcasting."""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        """Send message to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="DrawDrum",
    description="Real-time drum drawing display application",
    version="2.0.0",
    lifespan=lifespan
)

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")


# ============================================================================
# Page Routes
# ============================================================================

@app.get("/")
async def admin_page():
    """Serve the admin panel."""
    return FileResponse("app/static/index.html")


@app.get("/display")
async def display_page():
    """Serve the display view for monitors/kiosks."""
    return FileResponse("app/static/display.html")


# ============================================================================
# API Routes
# ============================================================================

@app.get("/api/settings")
async def api_get_settings():
    """Get current settings (passport text and logo)."""
    settings = await get_settings()
    return JSONResponse(settings)


@app.post("/api/passport")
async def api_update_passport(data: dict):
    """Update passport text, prize text, and formatting, then broadcast to all clients."""
    text = data.get("text", "")
    prize = data.get("prize", "")
    formatting = data.get("formatting", {})
    
    settings = await update_passport_text(text, prize)
    if formatting:
        settings = await update_text_formatting(formatting)
    
    # Broadcast update to all connected display clients
    await manager.broadcast({
        "type": "passport_update",
        "passport_text": settings["passport_text"],
        "prize_text": settings.get("prize_text", ""),
        "formatting": {
            "color": settings.get("text_color", DEFAULT_TEXT_COLOR),
            "style": settings.get("text_style", DEFAULT_TEXT_STYLE),
            "displayTextSize": settings.get("display_text_size", DEFAULT_DISPLAY_TEXT_SIZE),
            "timerSize": settings.get("timer_size", DEFAULT_TIMER_SIZE),
            "columns": settings.get("columns", DEFAULT_COLUMNS),
            "prizeSize": settings.get("prize_size", DEFAULT_PRIZE_SIZE),
            "prizeColor": settings.get("prize_color", DEFAULT_PRIZE_COLOR)
        }
    })
    
    return JSONResponse({"success": True, "settings": settings})


@app.post("/api/timer")
async def api_timer_action(data: dict):
    """Handle timer actions and broadcast to all clients."""
    action = data.get("action", "")
    duration = data.get("duration", 0)
    timer_size = data.get("timerSize", 24)
    
    # Broadcast timer action to all connected clients
    await manager.broadcast({
        "type": "timer_action",
        "action": action,
        "duration": duration,
        "timerSize": timer_size
    })
    
    return JSONResponse({"success": True})


@app.post("/api/logo")
async def api_upload_logo(file: UploadFile = File(...)):
    """Upload a new logo image and broadcast to all clients."""
    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Allowed: PNG, JPEG, GIF, WebP"
        )
    
    # Read file content and check size
    content = await file.read()
    if len(content) > MAX_LOGO_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_LOGO_SIZE_MB} MB"
        )
    
    # Get current logo path to delete old file later
    current_settings = await get_settings()
    old_logo_path = current_settings.get("logo_path", "")
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1] or ".png"
    filename = f"logo_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)
    
    # Save new file
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(content)
    
    # Delete old logo file if it exists
    if old_logo_path:
        old_filename = old_logo_path.replace("/uploads/", "")
        old_filepath = os.path.join(UPLOADS_DIR, old_filename)
        if os.path.exists(old_filepath):
            try:
                os.remove(old_filepath)
            except OSError:
                pass  # Ignore deletion errors
    
    # Update database
    logo_url = f"/uploads/{filename}"
    settings = await update_logo_path(logo_url)
    
    # Broadcast update to all connected display clients
    await manager.broadcast({
        "type": "logo_update",
        "logo_path": logo_url
    })
    
    return JSONResponse({"success": True, "logo_path": logo_url})


@app.delete("/api/logo")
async def api_delete_logo():
    """Delete the current logo and broadcast to all clients."""
    # Get current logo path
    settings = await get_settings()
    current_logo = settings.get("logo_path", "")
    
    # Delete the file if it exists
    if current_logo:
        filename = current_logo.replace("/uploads/", "")
        filepath = os.path.join(UPLOADS_DIR, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
    
    # Clear logo path in database
    settings = await update_logo_path("")
    
    # Broadcast update to all connected display clients
    await manager.broadcast({
        "type": "logo_update",
        "logo_path": ""
    })
    
    return JSONResponse({"success": True})


@app.get("/uploads/{filename}")
async def serve_upload(filename: str):
    """Serve uploaded files."""
    filepath = os.path.join(UPLOADS_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)


# ============================================================================
# WebSocket Endpoint
# ============================================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await manager.connect(websocket)
    
    # Send current settings on connect
    settings = await get_settings()
    await websocket.send_json({
        "type": "init",
        "passport_text": settings["passport_text"],
        "prize_text": settings.get("prize_text", ""),
        "logo_path": settings["logo_path"],
        "formatting": {
            "color": settings.get("text_color", DEFAULT_TEXT_COLOR),
            "style": settings.get("text_style", DEFAULT_TEXT_STYLE),
            "displayTextSize": settings.get("display_text_size", DEFAULT_DISPLAY_TEXT_SIZE),
            "timerSize": settings.get("timer_size", DEFAULT_TIMER_SIZE),
            "columns": settings.get("columns", DEFAULT_COLUMNS),
            "prizeSize": settings.get("prize_size", DEFAULT_PRIZE_SIZE),
            "prizeColor": settings.get("prize_color", DEFAULT_PRIZE_COLOR)
        }
    })
    
    try:
        while True:
            # Keep connection alive, listen for client messages
            data = await websocket.receive_json()
            msg_type = data.get("type", "")
            
            # Handle different message types from admin panel
            if msg_type == "passport_update":
                text = data.get("text", "")
                prize = data.get("prize", "")
                formatting = data.get("formatting", {})
                settings = await update_passport_text(text, prize)
                if formatting:
                    settings = await update_text_formatting(formatting)
                await manager.broadcast({
                    "type": "passport_update",
                    "passport_text": settings["passport_text"],
                    "prize_text": settings.get("prize_text", ""),
                    "formatting": {
                        "color": settings.get("text_color", DEFAULT_TEXT_COLOR),
                        "style": settings.get("text_style", DEFAULT_TEXT_STYLE),
                        "displayTextSize": settings.get("display_text_size", DEFAULT_DISPLAY_TEXT_SIZE),
                        "timerSize": settings.get("timer_size", DEFAULT_TIMER_SIZE),
                        "columns": settings.get("columns", DEFAULT_COLUMNS),
                        "prizeSize": settings.get("prize_size", DEFAULT_PRIZE_SIZE),
                        "prizeColor": settings.get("prize_color", DEFAULT_PRIZE_COLOR)
                    }
                })
            
            elif msg_type == "timer_action":
                # Broadcast timer action to all clients
                await manager.broadcast({
                    "type": "timer_action",
                    "action": data.get("action", ""),
                    "duration": data.get("duration", 0),
                    "timerSize": data.get("timerSize", 48)
                })
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
