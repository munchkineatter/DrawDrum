/**
 * DrawDrum - Client-side JavaScript
 * Handles WebSocket connections, text formatting, timer, and user-controlled sizing
 */

// ============================================================================
// Global State
// ============================================================================

let currentFormatting = {
    color: '#FFFFFF',
    style: 'normal',
    displayTextSize: 96,
    timerSize: 48
};

let timerState = {
    duration: 300, // 5 minutes in seconds
    remaining: 300,
    isRunning: false,
    intervalId: null
};

// ============================================================================
// Text Formatting Engine
// ============================================================================

/**
 * Format text with the current formatting settings
 */
function formatTextWithSettings(text, formatting) {
    if (!text || text.trim() === '') {
        return '';
    }

    let formatted = escapeHtml(text);
    
    // Convert line breaks to <br>
    formatted = formatted.replace(/\n/g, '<br>');

    // Apply formatting
    const color = formatting.color || '#FFFFFF';
    const style = formatting.style || 'normal';

    let styleTag = style === 'bold' ? 'strong' : 'span';
    
    return `<${styleTag} style="color: ${color}">${formatted}</${styleTag}>`;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// Timer Functions
// ============================================================================

/**
 * Format seconds to MM:SS display
 */
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Get timer warning class based on remaining time
 */
function getTimerClass(remaining) {
    if (remaining <= 0) return 'finished';
    if (remaining <= 10) return 'danger';
    if (remaining <= 30) return 'warning';
    return '';
}

// ============================================================================
// Debounce Utility
// ============================================================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================================================
// WebSocket Connection Manager
// ============================================================================

class WebSocketManager {
    constructor(onMessage, onStatusChange) {
        this.ws = null;
        this.onMessage = onMessage;
        this.onStatusChange = onStatusChange;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.onStatusChange('connecting');

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.reconnectAttempts = 0;
                this.onStatusChange('connected');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.onMessage(data);
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };

            this.ws.onclose = () => {
                this.onStatusChange('disconnected');
                this.scheduleReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.onStatusChange('error');
            };
        } catch (e) {
            console.error('Failed to create WebSocket:', e);
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
            setTimeout(() => this.connect(), delay);
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
}

// ============================================================================
// Admin Panel Initialization
// ============================================================================

function initAdmin() {
    const passportTextarea = document.getElementById('passportText');
    const updateTextBtn = document.getElementById('updateTextBtn');
    const clearTextBtn = document.getElementById('clearTextBtn');
    const uploadArea = document.getElementById('uploadArea');
    const logoUpload = document.getElementById('logoUpload');
    const previewText = document.getElementById('previewText');
    const previewLogo = document.getElementById('previewLogo');
    const connectionStatus = document.getElementById('connectionStatus');
    
    // Logo preview/delete elements
    const currentLogoPreview = document.getElementById('currentLogoPreview');
    const currentLogoImg = document.getElementById('currentLogoImg');
    const deleteLogoBtn = document.getElementById('deleteLogoBtn');
    
    // Formatting controls
    const textColor = document.getElementById('textColor');
    const textStyle = document.getElementById('textStyle');
    const displayTextSize = document.getElementById('displayTextSize');
    const timerDisplaySize = document.getElementById('timerDisplaySize');
    
    // Timer controls
    const timerMinutes = document.getElementById('timerMinutes');
    const timerSeconds = document.getElementById('timerSeconds');
    const timerStartBtn = document.getElementById('timerStartBtn');
    const timerPauseBtn = document.getElementById('timerPauseBtn');
    const timerResetBtn = document.getElementById('timerResetBtn');
    const timerPreview = document.getElementById('timerPreview');

    let wsManager = null;

    // Update status indicator
    function updateStatus(status) {
        const dot = connectionStatus.querySelector('.status-dot');
        const text = connectionStatus.querySelector('.status-text');
        
        dot.className = 'status-dot';
        
        switch (status) {
            case 'connected':
                dot.classList.add('connected');
                text.textContent = 'Connected';
                break;
            case 'connecting':
                dot.classList.add('connecting');
                text.textContent = 'Connecting...';
                break;
            case 'disconnected':
            case 'error':
                dot.classList.add('disconnected');
                text.textContent = 'Disconnected';
                break;
        }
    }

    // Get current formatting from dropdowns
    function getCurrentFormatting() {
        return {
            color: textColor.value,
            style: textStyle.value,
            displayTextSize: parseInt(displayTextSize.value) || 96,
            timerSize: parseInt(timerDisplaySize.value) || 96
        };
    }

    // Handle incoming WebSocket messages
    function handleMessage(data) {
        switch (data.type) {
            case 'init':
                if (data.passport_text) {
                    passportTextarea.value = data.passport_text;
                }
                if (data.formatting) {
                    currentFormatting = data.formatting;
                    textColor.value = data.formatting.color || '#FFFFFF';
                    textStyle.value = data.formatting.style || 'normal';
                    displayTextSize.value = data.formatting.displayTextSize || 96;
                    timerDisplaySize.value = data.formatting.timerSize || 96;
                }
                updatePreviewText();
                // Always call updatePreviewLogo to show/hide the current logo preview
                updatePreviewLogo(data.logo_path || '');
                break;
            case 'passport_update':
                if (data.formatting) {
                    currentFormatting = data.formatting;
                }
                updatePreviewText();
                break;
            case 'logo_update':
                updatePreviewLogo(data.logo_path);
                break;
            case 'timer_action':
                handleTimerAction(data.action, data.duration, data.timerSize);
                break;
        }
    }

    // Initialize WebSocket
    wsManager = new WebSocketManager(handleMessage, updateStatus);
    wsManager.connect();

    // Update preview text with formatting
    function updatePreviewText() {
        const text = passportTextarea.value;
        const formatting = getCurrentFormatting();
        
        if (!text || text.trim() === '') {
            previewText.innerHTML = '<span class="placeholder-text">Enter text above to preview</span>';
        } else {
            previewText.innerHTML = formatTextWithSettings(text, formatting);
        }
    }

    // Update preview logo and current logo preview
    function updatePreviewLogo(path) {
        if (path) {
            previewLogo.innerHTML = `<img src="${path}" alt="Logo" class="logo-image">`;
            // Show current logo preview with delete button
            currentLogoImg.src = path;
            currentLogoPreview.style.display = 'flex';
        } else {
            previewLogo.innerHTML = '<span class="placeholder-text">No logo uploaded</span>';
            // Hide current logo preview
            currentLogoPreview.style.display = 'none';
            currentLogoImg.src = '';
        }
    }

    // Delete logo button handler
    deleteLogoBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete the logo?')) {
            return;
        }
        
        try {
            const response = await fetch('/api/logo', {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Failed to delete');
            
            updatePreviewLogo('');
        } catch (error) {
            console.error('Error deleting logo:', error);
            alert('Failed to delete logo');
        }
    });

    // Live preview as user types or changes formatting
    passportTextarea.addEventListener('input', updatePreviewText);
    textColor.addEventListener('change', updatePreviewText);
    textStyle.addEventListener('change', updatePreviewText);
    displayTextSize.addEventListener('change', updatePreviewText);

    // Update text button - sends formatting including sizes AND auto-starts timer
    updateTextBtn.addEventListener('click', async () => {
        const text = passportTextarea.value;
        const formatting = getCurrentFormatting();
        
        try {
            const response = await fetch('/api/passport', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, formatting })
            });
            
            if (!response.ok) throw new Error('Failed to update');
            
            // Auto-start the timer when text is pushed
            const duration = getTimerDuration();
            const timerSize = parseInt(timerDisplaySize.value) || 48;
            timerState.duration = duration;
            timerState.remaining = duration;
            timerState.isRunning = true;
            startTimerInterval();
            updateTimerPreview();
            updatePauseButtonState();
            
            // Send timer start to display
            await fetch('/api/timer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', duration, timerSize })
            });
            
            // Visual feedback
            updateTextBtn.textContent = 'Updated!';
            updateTextBtn.classList.add('success');
            setTimeout(() => {
                updateTextBtn.textContent = 'Update Text';
                updateTextBtn.classList.remove('success');
            }, 2000);
        } catch (error) {
            console.error('Error updating text:', error);
            updateTextBtn.textContent = 'Error!';
            setTimeout(() => {
                updateTextBtn.textContent = 'Update Text';
            }, 2000);
        }
    });

    // Clear text button
    clearTextBtn.addEventListener('click', async () => {
        passportTextarea.value = '';
        updatePreviewText();
        
        try {
            await fetch('/api/passport', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: '', formatting: getCurrentFormatting() })
            });
        } catch (error) {
            console.error('Error clearing text:', error);
        }
    });

    // Upload area click
    uploadArea.addEventListener('click', () => {
        logoUpload.click();
    });

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleLogoUpload(files[0]);
        }
    });

    // File input change
    logoUpload.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleLogoUpload(e.target.files[0]);
        }
    });

    // Handle logo upload
    async function handleLogoUpload(file) {
        const formData = new FormData();
        formData.append('file', file);

        uploadArea.classList.add('uploading');
        
        try {
            const response = await fetch('/api/logo', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Upload failed');
            }
            
            const data = await response.json();
            updatePreviewLogo(data.logo_path);
            
        } catch (error) {
            console.error('Error uploading logo:', error);
            alert('Failed to upload logo: ' + error.message);
        } finally {
            uploadArea.classList.remove('uploading');
        }
    }

    // ========================================================================
    // Timer Controls
    // ========================================================================

    function getTimerDuration() {
        const mins = parseInt(timerMinutes.value) || 0;
        const secs = parseInt(timerSeconds.value) || 0;
        return mins * 60 + secs;
    }

    function updateTimerPreview() {
        timerPreview.textContent = formatTime(timerState.remaining);
        timerPreview.className = 'timer-preview-display ' + getTimerClass(timerState.remaining);
    }

    function handleTimerAction(action, duration, timerSize) {
        switch (action) {
            case 'start':
                if (duration !== undefined) {
                    timerState.duration = duration;
                    timerState.remaining = duration;
                }
                timerState.isRunning = true;
                startTimerInterval();
                updatePauseButtonState();
                break;
            case 'pause':
                timerState.isRunning = false;
                stopTimerInterval();
                updatePauseButtonState();
                break;
            case 'resume':
                if (duration !== undefined) {
                    timerState.remaining = duration;
                }
                timerState.isRunning = true;
                startTimerInterval();
                updatePauseButtonState();
                break;
            case 'reset':
                timerState.remaining = timerState.duration;
                timerState.isRunning = false;
                stopTimerInterval();
                updateTimerPreview();
                updatePauseButtonState();
                break;
            case 'tick':
                timerState.remaining = duration;
                updateTimerPreview();
                break;
        }
    }

    function startTimerInterval() {
        stopTimerInterval();
        timerState.intervalId = setInterval(() => {
            if (timerState.remaining > 0) {
                timerState.remaining--;
                updateTimerPreview();
            } else {
                timerState.isRunning = false;
                stopTimerInterval();
            }
        }, 1000);
    }

    function stopTimerInterval() {
        if (timerState.intervalId) {
            clearInterval(timerState.intervalId);
            timerState.intervalId = null;
        }
    }

    // Timer input changes
    timerMinutes.addEventListener('change', () => {
        timerState.duration = getTimerDuration();
        timerState.remaining = timerState.duration;
        updateTimerPreview();
    });

    timerSeconds.addEventListener('change', () => {
        timerState.duration = getTimerDuration();
        timerState.remaining = timerState.duration;
        updateTimerPreview();
    });

    // Start button - includes timer size
    timerStartBtn.addEventListener('click', async () => {
        const duration = getTimerDuration();
        const timerSize = parseInt(timerDisplaySize.value) || 48;
        timerState.duration = duration;
        timerState.remaining = duration;
        timerState.isRunning = true;
        startTimerInterval();
        updateTimerPreview();
        updatePauseButtonState();
        
        try {
            await fetch('/api/timer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', duration, timerSize })
            });
        } catch (error) {
            console.error('Error starting timer:', error);
        }
    });

    // Update pause button text based on state
    function updatePauseButtonState() {
        if (timerState.isRunning) {
            timerPauseBtn.textContent = '⏸ Pause';
        } else {
            timerPauseBtn.textContent = '▶ Resume';
        }
    }

    // Pause/Resume button (toggle)
    timerPauseBtn.addEventListener('click', async () => {
        if (timerState.isRunning) {
            // Pause the timer
            timerState.isRunning = false;
            stopTimerInterval();
            updatePauseButtonState();
            
            try {
                await fetch('/api/timer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'pause', duration: timerState.remaining })
                });
            } catch (error) {
                console.error('Error pausing timer:', error);
            }
        } else {
            // Resume the timer (only if there's remaining time)
            if (timerState.remaining > 0) {
                timerState.isRunning = true;
                startTimerInterval();
                updatePauseButtonState();
                
                const timerSize = parseInt(timerDisplaySize.value) || 48;
                try {
                    await fetch('/api/timer', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'resume', duration: timerState.remaining, timerSize })
                    });
                } catch (error) {
                    console.error('Error resuming timer:', error);
                }
            }
        }
    });

    // Reset button
    timerResetBtn.addEventListener('click', async () => {
        const duration = getTimerDuration();
        const timerSize = parseInt(timerDisplaySize.value) || 48;
        timerState.duration = duration;
        timerState.remaining = duration;
        timerState.isRunning = false;
        stopTimerInterval();
        updateTimerPreview();
        updatePauseButtonState();
        
        try {
            await fetch('/api/timer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset', duration, timerSize })
            });
        } catch (error) {
            console.error('Error resetting timer:', error);
        }
    });

    // Initialize timer preview
    timerState.duration = getTimerDuration();
    timerState.remaining = timerState.duration;
    updateTimerPreview();
}

// ============================================================================
// Display View Initialization
// ============================================================================

function initDisplay() {
    const displayText = document.getElementById('displayText');
    const displayLogo = document.getElementById('displayLogo');
    const displayTimer = document.getElementById('displayTimer');
    const connectionOverlay = document.getElementById('connectionOverlay');

    let displayFormatting = { 
        color: '#FFFFFF', 
        style: 'normal',
        displayTextSize: 96,
        timerSize: 48
    };
    
    let currentPassportText = '';

    // Update connection overlay
    function updateConnectionStatus(status) {
        if (status === 'connected') {
            connectionOverlay.classList.add('hidden');
        } else {
            connectionOverlay.classList.remove('hidden');
            const message = connectionOverlay.querySelector('.connection-message span');
            if (status === 'connecting') {
                message.textContent = 'Connecting to server...';
            } else {
                message.textContent = 'Connection lost. Reconnecting...';
            }
        }
    }

    // Update display text with user-controlled size
    function updateDisplayText(text) {
        currentPassportText = text;
        if (!text || text.trim() === '') {
            displayText.innerHTML = '';
            displayText.style.fontSize = '';
        } else {
            displayText.innerHTML = formatTextWithSettings(text, displayFormatting);
            displayText.style.fontSize = `${displayFormatting.displayTextSize}px`;
        }
    }

    // Update display logo
    function updateDisplayLogo(path) {
        if (path) {
            displayLogo.innerHTML = `<img src="${path}" alt="Logo" class="display-logo-image">`;
            displayLogo.classList.add('has-logo');
        } else {
            displayLogo.innerHTML = '';
            displayLogo.classList.remove('has-logo');
        }
    }

    // Update timer display with user-controlled size
    function updateTimerDisplay(timerSize) {
        displayTimer.textContent = formatTime(timerState.remaining);
        displayTimer.className = 'display-timer ' + getTimerClass(timerState.remaining);
        if (timerSize) {
            displayTimer.style.fontSize = `${timerSize}px`;
        }
    }

    function startDisplayTimer(timerSize) {
        stopDisplayTimer();
        timerState.intervalId = setInterval(() => {
            if (timerState.remaining > 0) {
                timerState.remaining--;
                updateTimerDisplay(timerSize);
            } else {
                timerState.isRunning = false;
                stopDisplayTimer();
            }
        }, 1000);
    }

    function stopDisplayTimer() {
        if (timerState.intervalId) {
            clearInterval(timerState.intervalId);
            timerState.intervalId = null;
        }
    }

    // Handle incoming WebSocket messages
    function handleMessage(data) {
        switch (data.type) {
            case 'init':
                if (data.formatting) {
                    displayFormatting = {
                        ...displayFormatting,
                        ...data.formatting
                    };
                }
                updateDisplayText(data.passport_text);
                updateDisplayLogo(data.logo_path);
                break;
            case 'passport_update':
                if (data.formatting) {
                    displayFormatting = {
                        ...displayFormatting,
                        ...data.formatting
                    };
                }
                // Add animation class
                displayText.classList.add('updating');
                setTimeout(() => {
                    updateDisplayText(data.passport_text);
                    displayText.classList.remove('updating');
                }, 150);
                break;
            case 'logo_update':
                displayLogo.classList.add('updating');
                setTimeout(() => {
                    updateDisplayLogo(data.logo_path);
                    displayLogo.classList.remove('updating');
                }, 150);
                break;
            case 'timer_action':
                handleDisplayTimerAction(data.action, data.duration, data.timerSize);
                break;
        }
    }

    function handleDisplayTimerAction(action, duration, timerSize) {
        // Store timer size if provided
        if (timerSize) {
            displayFormatting.timerSize = timerSize;
        }
        
        switch (action) {
            case 'start':
                timerState.duration = duration;
                timerState.remaining = duration;
                timerState.isRunning = true;
                updateTimerDisplay(timerSize || displayFormatting.timerSize);
                startDisplayTimer(timerSize || displayFormatting.timerSize);
                break;
            case 'pause':
                timerState.isRunning = false;
                stopDisplayTimer();
                if (duration !== undefined) {
                    timerState.remaining = duration;
                    updateTimerDisplay(displayFormatting.timerSize);
                }
                break;
            case 'resume':
                if (duration !== undefined) {
                    timerState.remaining = duration;
                }
                timerState.isRunning = true;
                updateTimerDisplay(timerSize || displayFormatting.timerSize);
                startDisplayTimer(timerSize || displayFormatting.timerSize);
                break;
            case 'reset':
                timerState.duration = duration;
                timerState.remaining = duration;
                timerState.isRunning = false;
                stopDisplayTimer();
                updateTimerDisplay(timerSize || displayFormatting.timerSize);
                break;
        }
    }

    // Initialize WebSocket
    const wsManager = new WebSocketManager(handleMessage, updateConnectionStatus);
    wsManager.connect();

    // Initialize timer display (hidden until started)
    displayTimer.textContent = '';
}
