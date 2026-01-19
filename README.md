# DrawDrum

A modern, real-time drum drawing display application built with FastAPI and WebSockets.

## Features

- **Real-time Updates**: Changes broadcast instantly to all connected display screens via WebSocket
- **Multi-line Text**: Enter multiple passport numbers with line breaks
- **Rich Formatting**: Support for bold text, colored text, and larger text sizes
- **Auto-sizing Text**: Display text automatically scales to fit the screen
- **Logo Upload**: Upload and display custom logos (PNG, JPEG, GIF, WebP)
- **Persistent Storage**: SQLite database stores settings across restarts
- **Minimal Dark UI**: Clean, modern dark theme with subtle animations

## Quick Start

### Prerequisites

- Python 3.11 or higher
- pip (Python package manager)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/DrawDrum.git
   cd DrawDrum
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Open in browser**
   - Admin Panel: http://localhost:8000
   - Display View: http://localhost:8000/display

## Usage

### Admin Panel (/)

The admin panel allows you to:

1. **Enter Passport Numbers**: Use the textarea to enter text with line breaks
2. **Format Text**: Use special syntax for formatting:
   - `**bold text**` → **bold text**
   - `#FF0000:colored text` → red colored text
   - `##large text##` → larger text
3. **Upload Logo**: Click or drag-and-drop an image file
4. **Preview**: See live preview of how text will appear on displays

### Display View (/display)

The display view is designed for monitors and kiosks:

- Full-screen optimized layout
- Auto-connects via WebSocket
- Receives real-time updates from admin panel
- Text automatically scales to fit the screen
- Shows connection status overlay when disconnected

## Text Formatting Guide

| Syntax | Result |
|--------|--------|
| `**text**` | **Bold text** |
| `#FF0000:text` | Red colored text |
| `#00FF00:text` | Green colored text |
| `##text##` | Larger text |
| Line breaks | Preserved as-is |

You can combine formats, for example:
```
**Welcome!**
#FF0000:John Smith
#00FF00:Jane Doe
##Winner: ABC123##
```

## Deployment to Render

### Automatic Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Render will auto-detect the `render.yaml` configuration

3. **Deploy**
   - Render will automatically build and deploy your app
   - A persistent disk is configured for database and uploads

### Manual Configuration (if not using render.yaml)

- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment**: Python 3.11
- Add a **Disk** mounted at `/data` for persistent storage

## Project Structure

```
DrawDrum/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI app, routes, WebSocket
│   ├── database.py       # SQLite connection and models
│   └── static/
│       ├── index.html    # Admin panel
│       ├── display.html  # Display view
│       ├── styles.css    # Dark theme styles
│       └── app.js        # Client-side JavaScript
├── requirements.txt      # Python dependencies
├── render.yaml          # Render deployment config
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Admin panel |
| GET | `/display` | Display view |
| GET | `/api/settings` | Get current settings |
| POST | `/api/passport` | Update passport text |
| POST | `/api/logo` | Upload logo image |
| GET | `/uploads/{filename}` | Serve uploaded files |
| WS | `/ws` | WebSocket for real-time updates |

## Technology Stack

- **Backend**: Python 3.11+ with FastAPI
- **Real-time**: WebSockets (native FastAPI support)
- **Database**: SQLite with aiosqlite
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Fonts**: Space Grotesk & JetBrains Mono

## License

MIT License - feel free to use and modify as needed.
