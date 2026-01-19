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
    UPLOADS_DIR
)


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
    """Update passport text and broadcast to all clients."""
    text = data.get("text", "")
    settings = await update_passport_text(text)
    
    # Broadcast update to all connected display clients
    await manager.broadcast({
        "type": "passport_update",
        "passport_text": settings["passport_text"]
    })
    
    return JSONResponse({"success": True, "settings": settings})


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
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1] or ".png"
    filename = f"logo_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)
    
    # Save file
    async with aiofiles.open(filepath, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Update database
    logo_url = f"/uploads/{filename}"
    settings = await update_logo_path(logo_url)
    
    # Broadcast update to all connected display clients
    await manager.broadcast({
        "type": "logo_update",
        "logo_path": logo_url
    })
    
    return JSONResponse({"success": True, "logo_path": logo_url})


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
        "logo_path": settings["logo_path"]
    })
    
    try:
        while True:
            # Keep connection alive, listen for client messages
            data = await websocket.receive_json()
            
            # Handle different message types from admin panel
            if data.get("type") == "passport_update":
                text = data.get("text", "")
                settings = await update_passport_text(text)
                await manager.broadcast({
                    "type": "passport_update",
                    "passport_text": settings["passport_text"]
                })
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
