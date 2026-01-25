/**
 * DrawDrum - Client-side JavaScript
 * Handles WebSocket connections, text formatting, timer, and user-controlled sizing
 */

// ============================================================================
// Global State
// ============================================================================

let currentFormatting = {
    color: '#FFFFFF',
    style: 'bold',
    displayTextSize: 72,
    timerSize: 48,
    columns: 1,
    prizeSize: 72
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
function formatTextWithSettings(text, formatting, useColumns = false) {
    if (!text || text.trim() === '') {
        return '';
    }

    const color = formatting.color || '#FFFFFF';
    const style = formatting.style || 'bold';
    let styleTag = style === 'bold' ? 'strong' : 'span';
    
    // Split by newlines and wrap each line
    const lines = text.split('\n');
    
    if (useColumns) {
        // For columns, wrap each line to prevent breaking mid-line
        const formattedLines = lines.map(line => {
            const escapedLine = escapeHtml(line);
            return `<span class="display-line"><${styleTag} style="color: ${color}">${escapedLine}</${styleTag}></span>`;
        });
        return formattedLines.join('');
    } else {
        // For single column, wrap each line in a div for proper line breaks
        const formattedLines = lines.map(line => {
            const escapedLine = escapeHtml(line);
            return `<div class="display-line-single"><${styleTag} style="color: ${color}">${escapedLine}</${styleTag}></div>`;
        });
        return formattedLines.join('');
    }
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
    const prizeInput = document.getElementById('prizeText');
    const updateTextBtn = document.getElementById('updateTextBtn');
    const clearTextBtn = document.getElementById('clearTextBtn');
    const uploadArea = document.getElementById('uploadArea');
    const logoUpload = document.getElementById('logoUpload');
    const previewText = document.getElementById('previewText');
    const previewLogo = document.getElementById('previewLogo');
    const previewPrize = document.getElementById('previewPrize');
    const connectionStatus = document.getElementById('connectionStatus');
    
    // Logo preview/delete elements
    const currentLogoPreview = document.getElementById('currentLogoPreview');
    const currentLogoImg = document.getElementById('currentLogoImg');
    const deleteLogoBtn = document.getElementById('deleteLogoBtn');
    
    // Formatting controls
    const textColor = document.getElementById('textColor');
    const timerDisplaySize = document.getElementById('timerDisplaySize');
    
    // Column buttons
    const col1Btn = document.getElementById('col1Btn');
    const col2Btn = document.getElementById('col2Btn');
    const col3Btn = document.getElementById('col3Btn');
    
    // Prize size controls
    const prizeDecrease = document.getElementById('prizeDecrease');
    const prizeIncrease = document.getElementById('prizeIncrease');
    const prizeSizeDisplay = document.getElementById('prizeSizeDisplay');
    
    let currentColumns = 1;
    let currentPrizeSize = 72;
    
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
            style: 'bold', // Always bold
            displayTextSize: 72, // Auto-sized, but keep default
            timerSize: parseInt(timerDisplaySize.value) || 48,
            columns: currentColumns,
            prizeSize: currentPrizeSize
        };
    }
    
    // Update column button states
    function updateColumnButtons(cols) {
        currentColumns = cols;
        col1Btn.classList.toggle('active', cols === 1);
        col2Btn.classList.toggle('active', cols === 2);
        col3Btn.classList.toggle('active', cols === 3);
        // Update preview columns
        previewText.classList.remove('columns-2', 'columns-3');
        if (cols === 2) previewText.classList.add('columns-2');
        if (cols === 3) previewText.classList.add('columns-3');
    }
    
    // Update prize size display
    function updatePrizeSizeDisplay() {
        prizeSizeDisplay.textContent = currentPrizeSize + 'px';
    }

    // Handle incoming WebSocket messages
    function handleMessage(data) {
        switch (data.type) {
            case 'init':
                if (data.passport_text) {
                    passportTextarea.value = data.passport_text;
                }
                if (data.prize_text) {
                    prizeInput.value = data.prize_text;
                }
                if (data.formatting) {
                    currentFormatting = data.formatting;
                    textColor.value = data.formatting.color || '#FFFFFF';
                    timerDisplaySize.value = data.formatting.timerSize || 48;
                    currentColumns = data.formatting.columns || 1;
                    currentPrizeSize = data.formatting.prizeSize || 72;
                    updateColumnButtons(currentColumns);
                    updatePrizeSizeDisplay();
                }
                updatePreviewText();
                updatePreviewPrize();
                // Always call updatePreviewLogo to show/hide the current logo preview
                updatePreviewLogo(data.logo_path || '');
                break;
            case 'passport_update':
                if (data.formatting) {
                    currentFormatting = data.formatting;
                }
                if (data.prize_text !== undefined) {
                    prizeInput.value = data.prize_text;
                    updatePreviewPrize();
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
            previewText.innerHTML = '<span class="placeholder-text">Enter text to preview</span>';
        } else {
            previewText.innerHTML = formatTextWithSettings(text, formatting);
        }
    }

    // Update preview prize
    function updatePreviewPrize() {
        const prize = prizeInput.value;
        if (prize && prize.trim() !== '') {
            previewPrize.textContent = prize;
        } else {
            previewPrize.textContent = '';
        }
    }

    // Update preview logo and current logo preview
    function updatePreviewLogo(path) {
        if (path) {
            previewLogo.innerHTML = `<img src="${path}" alt="Logo">`;
            // Show current logo preview with delete button
            currentLogoImg.src = path;
            currentLogoPreview.style.display = 'flex';
        } else {
            previewLogo.innerHTML = '';
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
    prizeInput.addEventListener('input', updatePreviewPrize);
    textColor.addEventListener('change', updatePreviewText);
    
    // Column button handlers
    col1Btn.addEventListener('click', () => updateColumnButtons(1));
    col2Btn.addEventListener('click', () => updateColumnButtons(2));
    col3Btn.addEventListener('click', () => updateColumnButtons(3));
    
    // Prize size handlers
    prizeDecrease.addEventListener('click', () => {
        if (currentPrizeSize > 16) {
            currentPrizeSize -= 4;
            updatePrizeSizeDisplay();
        }
    });
    
    prizeIncrease.addEventListener('click', () => {
        if (currentPrizeSize < 120) {
            currentPrizeSize += 4;
            updatePrizeSizeDisplay();
        }
    });

    // Update text button - sends formatting including sizes AND auto-starts timer
    updateTextBtn.addEventListener('click', async () => {
        const text = passportTextarea.value;
        const prize = prizeInput.value;
        const formatting = getCurrentFormatting();
        
        try {
            const response = await fetch('/api/passport', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, prize, formatting })
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
        prizeInput.value = '';
        updatePreviewText();
        updatePreviewPrize();
        
        try {
            await fetch('/api/passport', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: '', prize: '', formatting: getCurrentFormatting() })
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
        const timerClass = getTimerClass(timerState.remaining);
        // Remove previous state classes and add new one
        timerPreview.classList.remove('warning', 'danger', 'finished');
        if (timerClass) {
            timerPreview.classList.add(timerClass);
        }
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
    const displayPrize = document.getElementById('displayPrize');
    const displayTimer = document.getElementById('displayTimer');
    const connectionOverlay = document.getElementById('connectionOverlay');

    let displayFormatting = { 
        color: '#FFFFFF', 
        style: 'bold',
        displayTextSize: 72,
        timerSize: 48,
        columns: 1,
        prizeSize: 72
    };
    
    let currentPassportText = '';
    let currentPrizeText = '';
    
    // Update column display
    function updateColumnDisplay() {
        displayText.classList.remove('columns-2', 'columns-3');
        if (displayFormatting.columns === 2) {
            displayText.classList.add('columns-2');
        } else if (displayFormatting.columns === 3) {
            displayText.classList.add('columns-3');
        }
    }

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

    // Calculate optimal font size based on number of lines, columns, and viewport
    function calculateOptimalFontSize(text, baseSize, columns = 1) {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const lineCount = lines.length;
        
        if (lineCount === 0) return baseSize;
        
        // Get available height (viewport height minus logo space, prize, timer, and padding)
        const viewportHeight = window.innerHeight;
        const logoElement = document.getElementById('displayLogo');
        const prizeElement = document.getElementById('displayPrize');
        const logoHeight = logoElement ? logoElement.offsetHeight : 0;
        const prizeHeight = prizeElement ? prizeElement.offsetHeight : 0;
        
        // Reserve space for logo, prize, timer, and padding
        const reservedSpace = logoHeight + prizeHeight + 120; // 120px for timer and margins
        const availableHeight = viewportHeight - reservedSpace;
        
        // Calculate lines per column
        const linesPerColumn = Math.ceil(lineCount / columns);
        
        // Calculate line height (typically 1.35x font size)
        const lineHeight = 1.4;
        
        // Calculate max font size that would fit all lines in available height
        const maxSizeForLines = availableHeight / (linesPerColumn * lineHeight);
        
        // For columns, also consider width constraints
        let maxSizeForWidth = baseSize;
        if (columns > 1) {
            // Estimate max width per column (viewport width / columns - gaps)
            const viewportWidth = window.innerWidth;
            const gapSpace = (columns - 1) * 40; // Approximate gap space
            const columnWidth = (viewportWidth - gapSpace - 80) / columns; // 80px for margins
            
            // Assume average line is about 20 characters, calculate max font size
            const avgCharsPerLine = 20;
            maxSizeForWidth = columnWidth / (avgCharsPerLine * 0.6); // 0.6 is approx char width ratio
        }
        
        // Use the smaller of base size, height-based size, or width-based size
        let optimalSize = Math.min(baseSize, maxSizeForLines, maxSizeForWidth);
        
        // Set minimum font size
        optimalSize = Math.max(optimalSize, 24);
        
        return Math.floor(optimalSize);
    }

    // Update display text with auto-sizing for multiple lines
    function updateDisplayText(text) {
        currentPassportText = text;
        if (!text || text.trim() === '') {
            displayText.innerHTML = '';
            displayText.style.fontSize = '';
        } else {
            // Use columns mode when columns > 1
            const columns = displayFormatting.columns || 1;
            const useColumns = columns > 1;
            displayText.innerHTML = formatTextWithSettings(text, displayFormatting, useColumns);
            
            // Auto-size based on number of lines and columns
            const optimalSize = calculateOptimalFontSize(text, displayFormatting.displayTextSize, columns);
            displayText.style.fontSize = `${optimalSize}px`;
        }
        // Update column layout
        updateColumnDisplay();
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

    // Update display prize
    function updateDisplayPrize(prize) {
        currentPrizeText = prize || '';
        if (prize && prize.trim() !== '') {
            displayPrize.textContent = prize;
            displayPrize.style.fontSize = `${displayFormatting.prizeSize || 32}px`;
        } else {
            displayPrize.textContent = '';
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
                updateDisplayPrize(data.prize_text);
                updateDisplayText(data.passport_text);
                updateColumnDisplay();
                updateDisplayLogo(data.logo_path);
                break;
            case 'passport_update':
                if (data.formatting) {
                    displayFormatting = {
                        ...displayFormatting,
                        ...data.formatting
                    };
                }
                // Update prize if provided (update prize size before text)
                if (data.prize_text !== undefined) {
                    updateDisplayPrize(data.prize_text);
                }
                // Add animation class
                displayText.classList.add('updating');
                setTimeout(() => {
                    updateDisplayText(data.passport_text);
                    updateColumnDisplay();
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
    
    // Recalculate text size on window resize
    window.addEventListener('resize', debounce(() => {
        if (currentPassportText) {
            updateDisplayText(currentPassportText);
        }
    }, 250));
}
