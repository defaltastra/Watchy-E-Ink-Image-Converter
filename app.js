/**
 * Watchy Watchface Designer
 * A Canva-like tool for creating custom watchfaces for the Watchy e-ink smartwatch
 */

class WatchfaceDesigner {
    constructor() {
        this.canvas = document.getElementById('designCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlayCanvas = document.getElementById('overlayCanvas');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        this.elementsContainer = document.getElementById('canvasElements');
        this.brushCircle = document.getElementById('brushCircle');
        this.exportCanvas = document.getElementById('exportPreviewCanvas');
        this.exportCtx = this.exportCanvas.getContext('2d');

        this.WIDTH = 200;
        this.HEIGHT = 200;

        this.elements = [];
        this.selectedElement = null;
        this.activeTool = 'select'; // 'select', 'brush', 'eraser'
        this.isDrawing = false;
        this.currentPath = null;
        this.isDragging = false;
        this.isResizing = false;
        this.resizeHandle = null;
        this.dragOffset = { x: 0, y: 0 };
        this.zoom = 2;
        this.showGrid = false;

        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;

        this.elementIdCounter = 0;
        this.customFonts = [];

        this.init();
    }

    init() {
        this.clearCanvas();
        this.bindEvents();
        this.setZoom(this.zoom);
        this.updateExportPreview();
    }

    clearCanvas() {
        this.ctx.fillStyle = '#ebdbb2';
        this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
    }

    bindEvents() {
        // Widget drag and drop
        document.querySelectorAll('.widget-item').forEach(widget => {
            widget.addEventListener('dragstart', (e) => this.handleWidgetDragStart(e));
            widget.addEventListener('dragend', (e) => this.handleWidgetDragEnd(e));
        });

        // Canvas drop zone
        const watchyDisplay = document.getElementById('watchyDisplay');
        watchyDisplay.addEventListener('dragover', (e) => this.handleCanvasDragOver(e));
        watchyDisplay.addEventListener('drop', (e) => this.handleCanvasDrop(e));

        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleCanvasMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleCanvasMouseUp());

        // Brush circle tracking on the whole watchy display
        watchyDisplay.addEventListener('mousemove', (e) => this.updateBrushCircle(e));
        watchyDisplay.addEventListener('mouseleave', () => {
            if (this.activeTool !== 'select') {
                this.brushCircle.style.display = 'none';
            }
        });
        watchyDisplay.addEventListener('mouseenter', () => {
            if (this.activeTool !== 'select') {
                this.brushCircle.style.display = 'block';
            }
        });

        // Image upload
        const widgetUploadZone = document.getElementById('widgetUploadZone');
        const widgetImageInput = document.getElementById('widgetImageInput');

        widgetUploadZone.addEventListener('click', () => widgetImageInput.click());
        widgetImageInput.addEventListener('change', (e) => this.handleImageUpload(e.target.files[0]));

        widgetUploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            widgetUploadZone.style.borderColor = 'var(--accent-primary)';
        });
        widgetUploadZone.addEventListener('dragleave', () => {
            widgetUploadZone.style.borderColor = '';
        });
        widgetUploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            widgetUploadZone.style.borderColor = '';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleImageUpload(file);
            }
        });

        // Toolbar buttons
        document.getElementById('selectTool').addEventListener('click', () => this.setActiveTool('select'));
        document.getElementById('brushTool').addEventListener('click', () => this.setActiveTool('brush'));
        document.getElementById('eraserTool').addEventListener('click', () => this.setActiveTool('eraser'));
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        document.getElementById('zoomInBtn').addEventListener('click', () => this.setZoom(this.zoom + 0.25));
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.setZoom(this.zoom - 0.25));
        document.getElementById('gridToggle').addEventListener('click', () => this.toggleGrid());
        document.getElementById('clearCanvasBtn').addEventListener('click', () => this.clearAllElements());

        // Property inputs
        document.getElementById('propX').addEventListener('input', (e) => this.updateElementProperty('x', parseInt(e.target.value) || 0));
        document.getElementById('propY').addEventListener('input', (e) => this.updateElementProperty('y', parseInt(e.target.value) || 0));
        document.getElementById('propWidth').addEventListener('input', (e) => this.updateElementProperty('width', parseInt(e.target.value) || 1));
        document.getElementById('propHeight').addEventListener('input', (e) => this.updateElementProperty('height', parseInt(e.target.value) || 1));
        document.getElementById('propTextContent').addEventListener('input', (e) => this.updateElementProperty('text', e.target.value));
        document.getElementById('propFontSize').addEventListener('input', (e) => {
            document.getElementById('propFontSizeValue').textContent = e.target.value + 'px';
            this.updateElementProperty('fontSize', parseInt(e.target.value));
        });
        document.getElementById('propStrokeWidth').addEventListener('input', (e) => {
            document.getElementById('propStrokeWidthValue').textContent = e.target.value + 'px';
            this.updateElementProperty('strokeWidth', parseInt(e.target.value));
        });
        document.getElementById('propBrushSize').addEventListener('input', (e) => {
            document.getElementById('propBrushSizeValue').textContent = e.target.value + 'px';
            this.updateElementProperty('strokeWidth', parseInt(e.target.value));
        });

        // Color buttons
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateElementProperty('color', btn.dataset.color);
            });
        });

        // Property actions
        document.getElementById('duplicateBtn').addEventListener('click', () => this.duplicateSelected());
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteSelected());
        document.getElementById('fillScreenBtn').addEventListener('click', () => this.fillScreenSelected());

        // Layer actions
        document.getElementById('layerUpBtn').addEventListener('click', () => this.moveLayerUp());
        document.getElementById('layerDownBtn').addEventListener('click', () => this.moveLayerDown());

        // Export settings
        document.getElementById('threshold').addEventListener('input', (e) => {
            document.getElementById('thresholdValue').textContent = e.target.value;
            this.updateExportPreview();
        });
        document.getElementById('ditherMethod').addEventListener('change', () => this.updateExportPreview());
        document.getElementById('invertColors').addEventListener('change', () => this.updateExportPreview());

        // Export actions
        document.getElementById('generateCodeBtn').addEventListener('click', () => this.generateCode());
        document.getElementById('downloadPngBtn').addEventListener('click', () => this.downloadPng());
        document.getElementById('saveProjectBtn').addEventListener('click', () => this.saveProject());
        document.getElementById('importProjectBtn').addEventListener('click', () => document.getElementById('projectImportInput').click());
        document.getElementById('projectImportInput').addEventListener('change', (e) => this.importProject(e.target.files[0]));

        // Font upload events
        const fontUploadZone = document.getElementById('fontUploadZone');
        const fontInput = document.getElementById('fontInput');

        fontUploadZone.addEventListener('click', () => fontInput.click());
        fontInput.addEventListener('change', (e) => this.handleFontUpload(e.target.files[0]));

        fontUploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            fontUploadZone.style.borderColor = 'var(--accent-primary)';
        });
        fontUploadZone.addEventListener('dragleave', () => {
            fontUploadZone.style.borderColor = '';
        });
        fontUploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            fontUploadZone.style.borderColor = '';
            const file = e.dataTransfer.files[0];
            if (file && (file.name.endsWith('.ttf') || file.name.endsWith('.otf'))) {
                this.handleFontUpload(file);
            }
        });

        // Font family change
        document.getElementById('propFontFamily').addEventListener('change', (e) => {
            this.updateElementProperty('fontFamily', e.target.value);
        });

        // Modal
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('codeModal').addEventListener('click', (e) => {
            if (e.target.id === 'codeModal') this.closeModal();
        });

        // Code tabs
        document.querySelectorAll('.code-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchCodeTab(tab.dataset.tab));
        });

        // Copy buttons
        document.getElementById('copyIno').addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('inoCode').textContent, 'copyIno');
        });
        document.getElementById('copyH').addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('hCode').textContent, 'copyH');
        });
        document.getElementById('copyCpp').addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('cppCode').textContent, 'copyCpp');
        });
        document.getElementById('copyBitmaps').addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('bitmapsCode').textContent, 'copyBitmaps');
        });
        document.getElementById('copySettings').addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('settingsCode').textContent, 'copySettings');
        });
        document.getElementById('copyRaw').addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('rawCode').textContent, 'copyRaw');
        });
        document.getElementById('downloadHeaderBtn').addEventListener('click', () => this.downloadHeaderFile());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Window resize
        window.addEventListener('resize', () => this.updateLayout());

        // Code Preview events
        document.getElementById('toggleCodePreview').addEventListener('click', () => this.toggleCodePreviewSection());
        document.getElementById('previewCodeBtn').addEventListener('click', () => this.previewBitmapCode());
        document.getElementById('addToCanvasBtn').addEventListener('click', () => this.addBitmapToCanvas());
        document.getElementById('clearCodeBtn').addEventListener('click', () => this.clearCodePreview());
        document.getElementById('bitmapCodeInput').addEventListener('input', () => this.detectBitmapDimensions());
        document.getElementById('previewAutoSize').addEventListener('change', (e) => {
            const inputs = document.querySelectorAll('.dimension-input-group input');
            inputs.forEach(input => input.disabled = e.target.checked);
            if (e.target.checked) this.detectBitmapDimensions();
        });
    }

    setActiveTool(tool) {
        this.activeTool = tool;

        // Update toolbar UI
        document.getElementById('selectTool').classList.toggle('active', tool === 'select');
        document.getElementById('brushTool').classList.toggle('active', tool === 'brush');
        document.getElementById('eraserTool').classList.toggle('active', tool === 'eraser');

        if (tool !== 'select') {
            this.selectElement(null);
            this.elementsContainer.classList.add('drawing-mode');
            document.getElementById('watchyDisplay').classList.add('drawing-mode');
            this.canvas.style.cursor = 'none'; // Hide cursor, we use brush circle
        } else {
            this.elementsContainer.classList.remove('drawing-mode');
            document.getElementById('watchyDisplay').classList.remove('drawing-mode');
            this.canvas.style.cursor = 'default';
            this.brushCircle.style.display = 'none';
        }
    }

    // ===== Widget Drag & Drop =====
    handleWidgetDragStart(e) {
        const widgetType = e.target.closest('.widget-item').dataset.widget;
        e.dataTransfer.setData('widget-type', widgetType);
        e.target.closest('.widget-item').style.opacity = '0.5';
    }

    handleWidgetDragEnd(e) {
        e.target.closest('.widget-item').style.opacity = '1';
    }

    handleCanvasMouseDown(e) {
        if (this.activeTool === 'select') {
            if (e.target === this.canvas) {
                this.selectElement(null);
            }
            return;
        }

        this.isDrawing = true;
        this.saveState();

        const rect = this.canvas.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / this.zoom);
        const y = Math.round((e.clientY - rect.top) / this.zoom);

        const brushSize = parseInt(document.getElementById('propBrushSize').value);

        this.currentPath = {
            id: ++this.elementIdCounter,
            type: 'drawing',
            points: [{ x, y }],
            color: 'black',
            isEraser: this.activeTool === 'eraser',
            strokeWidth: brushSize,
            visible: true
        };

        this.elements.push(this.currentPath);
        this.renderCanvas();
    }

    updateBrushCircle(e) {
        if (this.activeTool === 'select') return;

        const watchyRect = document.getElementById('watchyDisplay').getBoundingClientRect();
        // Divide by zoom because the container is CSS transformed
        const brushX = (e.clientX - watchyRect.left) / this.zoom;
        const brushY = (e.clientY - watchyRect.top) / this.zoom;

        this.brushCircle.style.left = brushX + 'px';
        this.brushCircle.style.top = brushY + 'px';

        // Brush size in logical pixels (not scaled)
        const brushSize = parseInt(document.getElementById('propBrushSize').value);
        this.brushCircle.style.width = brushSize + 'px';
        this.brushCircle.style.height = brushSize + 'px';
        this.brushCircle.style.display = 'block';
    }

    handleCanvasMouseMove(e) {
        // Update brush circle position
        this.updateBrushCircle(e);

        if (!this.isDrawing || !this.currentPath) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / this.zoom);
        const y = Math.round((e.clientY - rect.top) / this.zoom);

        // Only add point if it's different from last point
        const lastPoint = this.currentPath.points[this.currentPath.points.length - 1];
        if (lastPoint.x !== x || lastPoint.y !== y) {
            this.currentPath.points.push({ x, y });
            this.renderCanvas();
        }
    }

    handleCanvasMouseUp() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.currentPath = null;
            this.updateLayers();
            this.updateExportPreview();
        }
    }

    handleCanvasDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

    handleCanvasDrop(e) {
        e.preventDefault();
        const widgetType = e.dataTransfer.getData('widget-type');
        if (!widgetType) return;

        const rect = document.getElementById('canvasElements').getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / this.zoom);
        const y = Math.round((e.clientY - rect.top) / this.zoom);

        this.addWidget(widgetType, x, y);
    }

    // ===== Widget Creation =====
    addWidget(type, x = 50, y = 50) {
        this.saveState();

        const element = {
            id: ++this.elementIdCounter,
            type: type,
            x: Math.max(0, Math.min(x, this.WIDTH - 20)),
            y: Math.max(0, Math.min(y, this.HEIGHT - 20)),
            width: 60,
            height: 30,
            color: 'black',
            fontSize: 24,
            strokeWidth: 2,
            text: '',
            fontFamily: "'JetBrains Mono', monospace",
            visible: true,
            locked: false
        };

        // Set defaults based on widget type
        switch (type) {
            case 'digital-clock':
                element.width = 80;
                element.height = 36;
                element.text = '12:30';
                element.fontSize = 32;
                break;
            case 'analog-clock':
                element.width = 60;
                element.height = 60;
                break;
            case 'date':
                element.width = 60;
                element.height = 20;
                element.text = 'Jan 23';
                element.fontSize = 16;
                break;
            case 'day-of-week':
                element.width = 40;
                element.height = 16;
                element.text = 'THU';
                element.fontSize = 14;
                break;
            case 'weather-temp':
                element.width = 50;
                element.height = 30;
                element.text = '23°';
                element.fontSize = 28;
                break;
            case 'weather-icon':
                element.width = 40;
                element.height = 40;
                break;
            case 'weather-condition':
                element.width = 50;
                element.height = 16;
                element.text = 'Sunny';
                element.fontSize = 12;
                break;
            case 'weather-hi-lo':
                element.width = 70;
                element.height = 14;
                element.text = 'H:28° L:15°';
                element.fontSize = 10;
                break;
            case 'battery':
                element.width = 30;
                element.height = 14;
                break;
            case 'steps':
                element.width = 50;
                element.height = 16;
                element.text = '5.2k';
                element.fontSize = 12;
                break;
            case 'wifi':
            case 'bluetooth':
                element.width = 20;
                element.height = 20;
                break;
            case 'rectangle':
                element.width = 60;
                element.height = 40;
                break;
            case 'circle':
                element.width = 40;
                element.height = 40;
                break;
            case 'line':
                element.width = 60;
                element.height = 2;
                break;
            case 'text':
                element.width = 60;
                element.height = 20;
                element.text = 'Text';
                element.fontSize = 16;
                break;
        }

        // Center the element at drop position
        element.x = Math.max(0, Math.min(element.x - element.width / 2, this.WIDTH - element.width));
        element.y = Math.max(0, Math.min(element.y - element.height / 2, this.HEIGHT - element.height));

        this.elements.push(element);
        this.createElementDOM(element);
        this.selectElement(element);
        this.updateLayers();
        this.renderCanvas();
        this.updateExportPreview();
    }

    createElementDOM(element) {
        const div = document.createElement('div');
        div.className = 'canvas-element' + (element.type === 'image' ? ' element-image' : '');
        div.dataset.id = element.id;
        div.style.left = element.x + 'px';
        div.style.top = element.y + 'px';
        div.style.width = element.width + 'px';
        div.style.height = element.height + 'px';

        // Add resize handles
        ['nw', 'ne', 'sw', 'se'].forEach(handle => {
            const handleEl = document.createElement('div');
            handleEl.className = `resize-handle ${handle}`;
            handleEl.dataset.handle = handle;
            div.appendChild(handleEl);
        });

        // Add visual content
        div.appendChild(this.createElementContent(element));

        // Event listeners
        div.addEventListener('mousedown', (e) => this.handleElementMouseDown(e, element));
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectElement(element);
        });

        this.elementsContainer.appendChild(div);
    }

    createElementContent(element) {
        const content = document.createElement('div');
        content.className = 'element-content';
        content.style.width = '100%';
        content.style.height = '100%';
        content.style.display = 'flex';
        content.style.alignItems = 'center';
        content.style.justifyContent = 'center';
        content.style.pointerEvents = 'none';
        content.style.overflow = 'hidden';

        const color = element.color === 'white' ? '#ebdbb2' : '#1d2021';
        const bgColor = element.color === 'white' ? '#1d2021' : 'transparent';

        switch (element.type) {
            case 'digital-clock':
            case 'date':
            case 'day-of-week':
            case 'weather-temp':
            case 'weather-condition':
            case 'weather-hi-lo':
            case 'steps':
            case 'text':
                content.innerHTML = `<span style="font-family: ${element.fontFamily || "'JetBrains Mono', monospace"}; font-size: ${element.fontSize}px; color: ${color}; white-space: nowrap;">${element.text}</span>`;
                break;
            case 'analog-clock':
                content.innerHTML = `
                    <svg viewBox="0 0 50 50" style="width: 100%; height: 100%;">
                        <circle cx="25" cy="25" r="23" fill="none" stroke="${color}" stroke-width="2"/>
                        <line x1="25" y1="25" x2="25" y2="8" stroke="${color}" stroke-width="2.5"/>
                        <line x1="25" y1="25" x2="38" y2="25" stroke="${color}" stroke-width="2"/>
                        <circle cx="25" cy="25" r="2" fill="${color}"/>
                    </svg>
                `;
                break;
            case 'weather-icon':
                content.innerHTML = `
                    <svg viewBox="0 0 40 40" style="width: 100%; height: 100%;">
                        <circle cx="20" cy="20" r="8" fill="${color}"/>
                        <g stroke="${color}" stroke-width="2">
                            <line x1="20" y1="4" x2="20" y2="9"/>
                            <line x1="20" y1="31" x2="20" y2="36"/>
                            <line x1="4" y1="20" x2="9" y2="20"/>
                            <line x1="31" y1="20" x2="36" y2="20"/>
                            <line x1="8.6" y1="8.6" x2="12.1" y2="12.1"/>
                            <line x1="27.9" y1="27.9" x2="31.4" y2="31.4"/>
                            <line x1="8.6" y1="31.4" x2="12.1" y2="27.9"/>
                            <line x1="27.9" y1="12.1" x2="31.4" y2="8.6"/>
                        </g>
                    </svg>
                `;
                break;
            case 'battery':
                content.innerHTML = `
                    <svg viewBox="0 0 34 16" style="width: 100%; height: 100%;">
                        <rect x="1" y="2" width="28" height="12" rx="2" fill="none" stroke="${color}" stroke-width="2"/>
                        <rect x="29" y="5" width="4" height="6" rx="1" fill="${color}"/>
                        <rect x="4" y="5" width="18" height="6" rx="1" fill="${color}"/>
                    </svg>
                `;
                break;
            case 'wifi':
                content.innerHTML = `
                    <svg viewBox="0 0 24 24" style="width: 100%; height: 100%;">
                        <path d="M5 12.55a11 11 0 0 1 14.08 0" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
                        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="20" r="1.5" fill="${color}"/>
                    </svg>
                `;
                break;
            case 'bluetooth':
                content.innerHTML = `
                    <svg viewBox="0 0 24 24" style="width: 100%; height: 100%;">
                        <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
                break;
            case 'rectangle':
                content.style.border = `${element.strokeWidth}px solid ${color}`;
                content.style.background = bgColor;
                content.style.borderRadius = '2px';
                break;
            case 'circle':
                content.style.border = `${element.strokeWidth}px solid ${color}`;
                content.style.background = bgColor;
                content.style.borderRadius = '50%';
                break;
            case 'line':
                content.style.background = color;
                content.style.height = element.strokeWidth + 'px';
                break;
            case 'image':
                if (element.imageData) {
                    content.innerHTML = `<img src="${element.imageData}" style="width: 100%; height: 100%; object-fit: contain;">`;
                }
                break;
        }

        return content;
    }

    updateElementDOM(element) {
        const div = this.elementsContainer.querySelector(`[data-id="${element.id}"]`);
        if (!div) return;

        div.style.left = element.x + 'px';
        div.style.top = element.y + 'px';
        div.style.width = element.width + 'px';
        div.style.height = element.height + 'px';

        // Update content
        const oldContent = div.querySelector('.element-content');
        if (oldContent) {
            div.replaceChild(this.createElementContent(element), oldContent);
        }
    }

    // ===== Element Interaction =====
    handleElementMouseDown(e, element) {
        if (element.locked) return;

        const handle = e.target.dataset.handle;
        if (handle) {
            this.isResizing = true;
            this.resizeHandle = handle;
        } else {
            this.isDragging = true;
        }

        this.selectElement(element);

        const rect = e.target.closest('.canvas-element').getBoundingClientRect();
        // Divide by zoom because getBoundingClientRect returns scaled coordinates
        this.dragOffset = {
            x: (e.clientX - rect.left) / this.zoom,
            y: (e.clientY - rect.top) / this.zoom,
            startX: element.x,
            startY: element.y,
            startWidth: element.width,
            startHeight: element.height,
            mouseStartX: e.clientX,
            mouseStartY: e.clientY
        };

        const moveHandler = (e) => this.handleMouseMove(e);
        const upHandler = () => {
            this.isDragging = false;
            this.isResizing = false;
            this.resizeHandle = null;
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
            this.updateExportPreview();
        };

        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    }

    handleMouseMove(e) {
        if (!this.selectedElement) return;

        const containerRect = this.elementsContainer.getBoundingClientRect();

        if (this.isResizing) {
            const dx = (e.clientX - this.dragOffset.mouseStartX) / this.zoom;
            const dy = (e.clientY - this.dragOffset.mouseStartY) / this.zoom;

            let newX = this.dragOffset.startX;
            let newY = this.dragOffset.startY;
            let newWidth = this.dragOffset.startWidth;
            let newHeight = this.dragOffset.startHeight;

            if (this.resizeHandle.includes('e')) {
                newWidth = Math.max(10, this.dragOffset.startWidth + dx);
            }
            if (this.resizeHandle.includes('w')) {
                newWidth = Math.max(10, this.dragOffset.startWidth - dx);
                newX = this.dragOffset.startX + dx;
            }
            if (this.resizeHandle.includes('s')) {
                newHeight = Math.max(10, this.dragOffset.startHeight + dy);
            }
            if (this.resizeHandle.includes('n')) {
                newHeight = Math.max(10, this.dragOffset.startHeight - dy);
                newY = this.dragOffset.startY + dy;
            }

            // Lock aspect ratio if checked
            if (document.getElementById('propLockRatio').checked) {
                const ratio = this.dragOffset.startWidth / this.dragOffset.startHeight;
                if (this.resizeHandle === 'se' || this.resizeHandle === 'nw') {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        newHeight = newWidth / ratio;
                    } else {
                        newWidth = newHeight * ratio;
                    }
                }
            }

            this.selectedElement.x = Math.max(0, Math.min(newX, this.WIDTH - newWidth));
            this.selectedElement.y = Math.max(0, Math.min(newY, this.HEIGHT - newHeight));
            this.selectedElement.width = Math.round(newWidth);
            this.selectedElement.height = Math.round(newHeight);
        } else if (this.isDragging) {
            const x = (e.clientX - containerRect.left) / this.zoom - this.dragOffset.x;
            const y = (e.clientY - containerRect.top) / this.zoom - this.dragOffset.y;

            // Allow dragging even for elements larger than canvas
            const minX = Math.min(0, this.WIDTH - this.selectedElement.width);
            const maxX = Math.max(0, this.WIDTH - this.selectedElement.width);
            const minY = Math.min(0, this.HEIGHT - this.selectedElement.height);
            const maxY = Math.max(0, this.HEIGHT - this.selectedElement.height);

            this.selectedElement.x = Math.max(minX, Math.min(Math.round(x), maxX));
            this.selectedElement.y = Math.max(minY, Math.min(Math.round(y), maxY));
        }

        this.updateElementDOM(this.selectedElement);
        this.updatePropertyPanel();
        this.renderCanvas();
    }

    selectElement(element) {
        this.selectedElement = element;

        // Update DOM selection
        this.elementsContainer.querySelectorAll('.canvas-element').forEach(el => {
            el.classList.remove('selected');
        });

        if (element) {
            const div = this.elementsContainer.querySelector(`[data-id="${element.id}"]`);
            if (div) div.classList.add('selected');
        }

        this.updatePropertyPanel();
        this.updateLayers();
    }

    updatePropertyPanel() {
        const noSelectionPanel = document.getElementById('noSelectionPanel');
        const elementProperties = document.getElementById('elementProperties');
        const textProps = document.getElementById('textPropertiesGroup');
        const fontProps = document.getElementById('fontPropertiesGroup');
        const strokeProps = document.getElementById('strokePropertiesGroup');
        const imageProps = document.getElementById('imagePropertiesGroup');
        const brushProps = document.getElementById('brushPropertiesGroup');

        if (!this.selectedElement) {
            noSelectionPanel.classList.remove('hidden');
            elementProperties.classList.add('hidden');

            // Still show brush properties if brush/eraser tool is active
            if (this.activeTool === 'brush' || this.activeTool === 'eraser') {
                elementProperties.classList.remove('hidden');
                document.querySelectorAll('.property-group').forEach(pg => pg.classList.add('hidden'));
                brushProps.classList.remove('hidden');
                document.querySelector('.property-group label').parentElement.classList.add('hidden'); // Hide position
                elementProperties.querySelector('h3').textContent = this.activeTool.charAt(0).toUpperCase() + this.activeTool.slice(1) + ' Settings';
            }
            return;
        }

        elementProperties.querySelector('h3').textContent = 'Properties';
        noSelectionPanel.classList.add('hidden');
        elementProperties.classList.remove('hidden');
        document.querySelectorAll('.property-group').forEach(pg => {
            if (pg.id !== 'noSelectionPanel' && pg.id !== 'elementProperties') pg.classList.remove('hidden');
        });

        // Update values
        document.getElementById('propX').value = this.selectedElement.x;
        document.getElementById('propY').value = this.selectedElement.y;
        document.getElementById('propWidth').value = this.selectedElement.width;
        document.getElementById('propHeight').value = this.selectedElement.height;

        // Show/hide text properties
        const hasText = ['digital-clock', 'date', 'day-of-week', 'weather-temp', 'weather-condition', 'weather-hi-lo', 'steps', 'text'].includes(this.selectedElement.type);
        textProps.classList.toggle('hidden', !hasText);
        fontProps.classList.toggle('hidden', !hasText);

        if (hasText) {
            document.getElementById('propTextContent').value = this.selectedElement.text || '';
            document.getElementById('propFontFamily').value = this.selectedElement.fontFamily || "'JetBrains Mono', monospace";
            document.getElementById('propFontSize').value = this.selectedElement.fontSize || 16;
            document.getElementById('propFontSizeValue').textContent = (this.selectedElement.fontSize || 16) + 'px';
        }

        // Show/hide stroke properties
        const hasStroke = ['rectangle', 'circle', 'line'].includes(this.selectedElement.type);
        strokeProps.classList.toggle('hidden', !hasStroke);

        if (hasStroke) {
            document.getElementById('propStrokeWidth').value = this.selectedElement.strokeWidth || 2;
            document.getElementById('propStrokeWidthValue').textContent = (this.selectedElement.strokeWidth || 2) + 'px';
        }

        // Show/hide image properties
        const isImage = this.selectedElement.type === 'image';
        imageProps.classList.toggle('hidden', !isImage);

        // Show/hide brush properties for drawing elements
        const isDrawing = this.selectedElement.type === 'drawing';
        brushProps.classList.toggle('hidden', !isDrawing);
        if (isDrawing) {
            document.getElementById('propBrushSize').value = this.selectedElement.strokeWidth;
            document.getElementById('propBrushSizeValue').textContent = this.selectedElement.strokeWidth + 'px';
            // Hide position for drawing elements as they are multipoint
            document.querySelector('.property-group label').parentElement.classList.add('hidden');
        } else {
            document.querySelector('.property-group label').parentElement.classList.remove('hidden');
        }

        // Update color selection
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === this.selectedElement.color);
        });
    }

    updateElementProperty(prop, value) {
        if (!this.selectedElement) return;
        this.saveState();

        this.selectedElement[prop] = value;
        this.updateElementDOM(this.selectedElement);
        this.renderCanvas();
        this.updateExportPreview();
    }

    fillScreenSelected() {
        if (!this.selectedElement || this.selectedElement.type !== 'image') return;
        this.saveState();

        this.selectedElement.x = 0;
        this.selectedElement.y = 0;
        this.selectedElement.width = 200;
        this.selectedElement.height = 200;

        this.updateElementDOM(this.selectedElement);
        this.updatePropertyPanel();
        this.renderCanvas();
        this.updateExportPreview();
    }

    duplicateSelected() {
        if (!this.selectedElement) return;
        this.saveState();

        const newElement = { ...this.selectedElement };
        newElement.id = ++this.elementIdCounter;
        newElement.x = Math.min(newElement.x + 10, this.WIDTH - newElement.width);
        newElement.y = Math.min(newElement.y + 10, this.HEIGHT - newElement.height);

        this.elements.push(newElement);
        this.createElementDOM(newElement);
        this.selectElement(newElement);
        this.updateLayers();
        this.renderCanvas();
        this.updateExportPreview();
    }

    deleteSelected() {
        if (!this.selectedElement) return;
        this.saveState();

        const index = this.elements.findIndex(el => el.id === this.selectedElement.id);
        if (index !== -1) {
            this.elements.splice(index, 1);
            const div = this.elementsContainer.querySelector(`[data-id="${this.selectedElement.id}"]`);
            if (div) div.remove();
        }

        this.selectElement(null);
        this.updateLayers();
        this.renderCanvas();
        this.updateExportPreview();
    }

    // ===== Layers =====
    updateLayers() {
        const layersList = document.getElementById('layersList');

        if (this.elements.length === 0) {
            layersList.innerHTML = '<div class="empty-layers">No elements yet</div>';
            return;
        }

        layersList.innerHTML = '';

        // Show in reverse order (top layer first)
        [...this.elements].reverse().forEach(element => {
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item' + (this.selectedElement?.id === element.id ? ' active' : '');
            layerItem.dataset.id = element.id;

            let iconSvg = '';
            switch (element.type) {
                case 'digital-clock':
                case 'analog-clock':
                    iconSvg = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="12 6 12 12 16 14" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
                    break;
                case 'text':
                case 'date':
                case 'day-of-week':
                    iconSvg = '<svg viewBox="0 0 24 24"><polyline points="4 7 4 4 20 4 20 7" fill="none" stroke="currentColor" stroke-width="2"/><line x1="9" y1="20" x2="15" y2="20" stroke="currentColor" stroke-width="2"/><line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="2"/></svg>';
                    break;
                case 'image':
                    iconSvg = '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
                    break;
                case 'drawing':
                    iconSvg = '<svg viewBox="0 0 24 24"><path d="M12 19l7-7 3 3-7 7-3-3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
                    break;
                default:
                    iconSvg = '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
            }

            layerItem.innerHTML = `
                <div class="layer-icon">${iconSvg}</div>
                <span class="layer-name">${element.type}${element.text ? ': ' + element.text.substring(0, 10) : ''}${element.type === 'drawing' ? ' (' + (element.color === 'white' ? 'Eraser' : 'Brush') + ')' : ''}</span>
                <button class="layer-visibility">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${element.visible ?
                    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' :
                    '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
                }
                    </svg>
                </button>
            `;

            layerItem.addEventListener('click', (e) => {
                if (!e.target.closest('.layer-visibility')) {
                    const el = this.elements.find(el => el.id === element.id);
                    this.selectElement(el);
                }
            });

            layerItem.querySelector('.layer-visibility').addEventListener('click', (e) => {
                e.stopPropagation();
                element.visible = !element.visible;
                this.updateLayers();
                this.updateElementDOM(element);
                this.renderCanvas();
                this.updateExportPreview();
            });

            layersList.appendChild(layerItem);
        });
    }

    moveLayerUp() {
        if (!this.selectedElement) return;
        const index = this.elements.findIndex(el => el.id === this.selectedElement.id);
        if (index < this.elements.length - 1) {
            this.saveState();
            [this.elements[index], this.elements[index + 1]] = [this.elements[index + 1], this.elements[index]];
            this.reorderElementsDOM();
            this.updateLayers();
            this.renderCanvas();
            this.updateExportPreview();
        }
    }

    moveLayerDown() {
        if (!this.selectedElement) return;
        const index = this.elements.findIndex(el => el.id === this.selectedElement.id);
        if (index > 0) {
            this.saveState();
            [this.elements[index], this.elements[index - 1]] = [this.elements[index - 1], this.elements[index]];
            this.reorderElementsDOM();
            this.updateLayers();
            this.renderCanvas();
            this.updateExportPreview();
        }
    }

    reorderElementsDOM() {
        this.elements.forEach(element => {
            const div = this.elementsContainer.querySelector(`[data-id="${element.id}"]`);
            if (div) this.elementsContainer.appendChild(div);
        });
    }

    // ===== Image Upload =====
    handleImageUpload(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.saveState();

                const element = {
                    id: ++this.elementIdCounter,
                    type: 'image',
                    x: 50,
                    y: 50,
                    width: Math.min(img.width, 100),
                    height: Math.min(img.height, 100),
                    color: 'black',
                    visible: true,
                    locked: false,
                    imageData: e.target.result
                };

                // Maintain aspect ratio
                const ratio = img.width / img.height;
                if (element.width / element.height > ratio) {
                    element.width = element.height * ratio;
                } else {
                    element.height = element.width / ratio;
                }

                this.elements.push(element);
                this.createElementDOM(element);
                this.selectElement(element);
                this.updateLayers();
                this.renderCanvas();
                this.updateExportPreview();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // ===== Font Upload =====
    handleFontUpload(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const fontName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
            const fontData = e.target.result;

            try {
                const fontFace = new FontFace(fontName, fontData);
                const loadedFace = await fontFace.load();
                document.fonts.add(loadedFace);

                this.customFonts.push({ name: fontName, family: fontName });

                // Add to font family select
                const select = document.getElementById('propFontFamily');
                const option = document.createElement('option');
                option.value = fontName;
                option.textContent = fontName;
                select.appendChild(option);

                // If a text element is selected, switch to this font
                if (this.selectedElement && ['digital-clock', 'date', 'day-of-week', 'weather-temp', 'weather-condition', 'weather-hi-lo', 'steps', 'text'].includes(this.selectedElement.type)) {
                    this.updateElementProperty('fontFamily', fontName);
                    select.value = fontName;
                }

                alert(`Font "${file.name}" loaded successfully!`);
            } catch (err) {
                console.error('Font loading failed:', err);
                alert('Failed to load font. Please use a valid TTF/OTF file.');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // ===== Canvas Rendering =====
    renderCanvas() {
        this.clearCanvas();
        this.overlayCtx.clearRect(0, 0, this.WIDTH, this.HEIGHT);

        // Only render drawing elements to canvas
        // Widgets and images are DOM elements - they're only rendered to canvas during export
        this.elements.forEach(element => {
            if (!element.visible) return;
            if (element.type !== 'drawing') return; // Skip non-drawing elements

            if (element.points.length < 2) return;

            // Draw on overlay context so it appears on top of images
            this.overlayCtx.beginPath();
            this.overlayCtx.moveTo(element.points[0].x, element.points[0].y);
            for (let i = 1; i < element.points.length; i++) {
                this.overlayCtx.lineTo(element.points[i].x, element.points[i].y);
            }
            this.overlayCtx.lineWidth = element.strokeWidth;
            this.overlayCtx.lineCap = 'round';
            this.overlayCtx.lineJoin = 'round';

            if (element.isEraser) {
                // Eraser: draw with background color (will show as "erased" on 1-bit export)
                this.overlayCtx.strokeStyle = '#ebdbb2';
            } else {
                // Brush: draw with black
                this.overlayCtx.strokeStyle = '#1d2021';
            }
            this.overlayCtx.stroke();
        });
    }

    drawWeatherIcon(element) {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        const r = Math.min(element.width, element.height) * 0.2;
        const color = element.color === 'white' ? '#ebdbb2' : '#1d2021';

        this.ctx.fillStyle = color;
        this.ctx.strokeStyle = color;

        // Sun circle
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.fill();

        // Sun rays
        this.ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const x1 = cx + Math.cos(angle) * (r + 4);
            const y1 = cy + Math.sin(angle) * (r + 4);
            const x2 = cx + Math.cos(angle) * (r + 8);
            const y2 = cy + Math.sin(angle) * (r + 8);
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
        }
    }

    drawBattery(element) {
        const color = element.color === 'white' ? '#ebdbb2' : '#1d2021';
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
        this.ctx.lineWidth = 1.5;

        // Battery body
        this.ctx.strokeRect(element.x + 1, element.y + 2, element.width - 5, element.height - 4);

        // Battery cap
        this.ctx.fillRect(element.x + element.width - 4, element.y + element.height / 2 - 3, 3, 6);

        // Fill level
        this.ctx.fillRect(element.x + 3, element.y + 4, (element.width - 10) * 0.75, element.height - 8);
    }

    drawWifi(element) {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        const color = element.color === 'white' ? '#ebdbb2' : '#1d2021';

        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';

        // Arcs
        for (let i = 3; i >= 1; i--) {
            const r = i * 5;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy + 5, r, Math.PI * 1.2, Math.PI * 1.8);
            this.ctx.stroke();
        }

        // Dot
        this.ctx.beginPath();
        this.ctx.arc(cx, cy + 5, 2, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawBluetooth(element) {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        const color = element.color === 'white' ? '#ebdbb2' : '#1d2021';
        const size = Math.min(element.width, element.height) * 0.35;

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();
        this.ctx.moveTo(cx - size, cy - size * 0.6);
        this.ctx.lineTo(cx + size * 0.6, cy + size * 0.6);
        this.ctx.lineTo(cx, cy + size);
        this.ctx.lineTo(cx, cy - size);
        this.ctx.lineTo(cx + size * 0.6, cy - size * 0.6);
        this.ctx.lineTo(cx - size, cy + size * 0.6);
        this.ctx.stroke();
    }

    // ===== Toolbar Actions =====
    setZoom(level) {
        this.zoom = Math.max(0.5, Math.min(3, level));
        document.getElementById('zoomLevel').textContent = Math.round(this.zoom * 100) + '%';

        // Use CSS transform on the whole display - simpler and more reliable
        const display = document.getElementById('watchyDisplay');
        display.style.transform = `scale(${this.zoom})`;
        display.style.transformOrigin = 'center center';
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        document.getElementById('gridOverlay').classList.toggle('visible', this.showGrid);
        document.getElementById('gridToggle').classList.toggle('active', this.showGrid);
    }

    clearAllElements() {
        if (this.elements.length === 0) return;
        if (!confirm('Clear all elements from the canvas?')) return;

        this.saveState();
        this.elements = [];
        this.elementsContainer.innerHTML = '';
        this.selectElement(null);
        this.updateLayers();
        this.renderCanvas();
        this.updateExportPreview();
    }

    // ===== Undo/Redo =====
    saveState() {
        const state = JSON.stringify(this.elements);
        this.undoStack.push(state);
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length === 0) return;

        this.redoStack.push(JSON.stringify(this.elements));
        const state = this.undoStack.pop();
        this.restoreState(state);
    }

    redo() {
        if (this.redoStack.length === 0) return;

        this.undoStack.push(JSON.stringify(this.elements));
        const state = this.redoStack.pop();
        this.restoreState(state);
    }

    renderElementsToCtx(targetCtx, onlyImages = null) {
        this.elements.forEach(element => {
            if (!element.visible || element.type === 'drawing') return;

            // If onlyImages is true, only draw images. If false, only draw widgets. If null, draw all.
            if (onlyImages === true && element.type !== 'image') return;
            if (onlyImages === false && element.type === 'image') return;

            const color = element.color === 'white' ? '#ebdbb2' : '#1d2021';
            targetCtx.fillStyle = color;
            targetCtx.strokeStyle = color;

            switch (element.type) {
                case 'digital-clock':
                case 'date':
                case 'day-of-week':
                case 'weather-temp':
                case 'weather-condition':
                case 'weather-hi-lo':
                case 'steps':
                case 'text':
                    targetCtx.font = `bold ${element.fontSize}px ${element.fontFamily || "'JetBrains Mono', monospace"}`;
                    targetCtx.textBaseline = 'middle';
                    targetCtx.textAlign = 'center';
                    targetCtx.fillText(element.text, element.x + element.width / 2, element.y + element.height / 2);
                    break;
                case 'analog-clock':
                    const cx = element.x + element.width / 2;
                    const cy = element.y + element.height / 2;
                    const r = Math.min(element.width, element.height) / 2 - 2;
                    targetCtx.beginPath();
                    targetCtx.arc(cx, cy, r, 0, Math.PI * 2);
                    targetCtx.lineWidth = 2;
                    targetCtx.stroke();
                    targetCtx.beginPath();
                    targetCtx.moveTo(cx, cy);
                    targetCtx.lineTo(cx, cy - r * 0.5);
                    targetCtx.lineWidth = 3;
                    targetCtx.stroke();
                    targetCtx.beginPath();
                    targetCtx.moveTo(cx, cy);
                    targetCtx.lineTo(cx + r * 0.7, cy);
                    targetCtx.lineWidth = 2;
                    targetCtx.stroke();
                    targetCtx.beginPath();
                    targetCtx.arc(cx, cy, 3, 0, Math.PI * 2);
                    targetCtx.fill();
                    break;
                case 'weather-icon':
                    this.drawWeatherIconOnCtx(element, targetCtx);
                    break;
                case 'battery':
                    this.drawBatteryOnCtx(element, targetCtx);
                    break;
                case 'wifi':
                    this.drawWifiOnCtx(element, targetCtx);
                    break;
                case 'bluetooth':
                    this.drawBluetoothOnCtx(element, targetCtx);
                    break;
                case 'rectangle':
                    targetCtx.lineWidth = element.strokeWidth;
                    targetCtx.strokeRect(element.x, element.y, element.width, element.height);
                    break;
                case 'circle':
                    const circleR = Math.min(element.width, element.height) / 2;
                    targetCtx.beginPath();
                    targetCtx.arc(element.x + element.width / 2, element.y + element.height / 2, circleR - element.strokeWidth / 2, 0, Math.PI * 2);
                    targetCtx.lineWidth = element.strokeWidth;
                    targetCtx.stroke();
                    break;
                case 'line':
                    targetCtx.beginPath();
                    targetCtx.moveTo(element.x, element.y + element.height / 2);
                    targetCtx.lineTo(element.x + element.width, element.y + element.height / 2);
                    targetCtx.lineWidth = element.strokeWidth;
                    targetCtx.stroke();
                    break;
                case 'image':
                    if (element.imageData) {
                        const img = new Image();
                        img.src = element.imageData;
                        targetCtx.drawImage(img, element.x, element.y, element.width, element.height);
                    }
                    break;
            }
        });
    }

    drawWeatherIconOnCtx(element, ctx) {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        const r = Math.min(element.width, element.height) * 0.2;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * (r + 4), cy + Math.sin(angle) * (r + 4));
            ctx.lineTo(cx + Math.cos(angle) * (r + 8), cy + Math.sin(angle) * (r + 8));
            ctx.stroke();
        }
    }

    drawBatteryOnCtx(element, ctx) {
        ctx.lineWidth = 1.5;
        ctx.strokeRect(element.x + 1, element.y + 2, element.width - 5, element.height - 4);
        ctx.fillRect(element.x + element.width - 4, element.y + element.height / 2 - 3, 3, 6);
        ctx.fillRect(element.x + 3, element.y + 4, (element.width - 10) * 0.75, element.height - 8);
    }

    drawWifiOnCtx(element, ctx) {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let i = 3; i >= 1; i--) {
            const r = i * 5; ctx.beginPath(); ctx.arc(cx, cy + 5, r, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(cx, cy + 5, 2, 0, Math.PI * 2); ctx.fill();
    }

    drawBluetoothOnCtx(element, ctx) {
        const cx = element.x + element.width / 2;
        const cy = element.y + element.height / 2;
        const size = Math.min(element.width, element.height) * 0.35;
        ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - size, cy - size * 0.6); ctx.lineTo(cx + size * 0.6, cy + size * 0.6); ctx.lineTo(cx, cy + size); ctx.lineTo(cx, cy - size); ctx.lineTo(cx + size * 0.6, cy - size * 0.6); ctx.lineTo(cx - size, cy + size * 0.6);
        ctx.stroke();
    }

    restoreState(state) {
        this.elements = JSON.parse(state);
        this.elementsContainer.innerHTML = '';
        this.elements.forEach(element => this.createElementDOM(element));
        this.selectElement(null);
        this.updateLayers();
        this.renderCanvas();
        this.updateExportPreview();
    }

    // ===== Export Functions =====
    updateExportPreview() {
        // First render the design canvas
        this.renderCanvas();

        // Combine base canvas and overlay canvas
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = this.WIDTH;
        finalCanvas.height = this.HEIGHT;
        const finalCtx = finalCanvas.getContext('2d');

        // Draw base
        finalCtx.drawImage(this.canvas, 0, 0);

        // Draw only images first
        this.renderElementsToCtx(finalCtx, true);

        // Draw overlay
        finalCtx.drawImage(this.overlayCanvas, 0, 0);

        // Draw other widgets (non-images) on top of overlay
        this.renderElementsToCtx(finalCtx, false);

        // Then convert to 1-bit
        const threshold = parseInt(document.getElementById('threshold').value);
        const ditherMethod = document.getElementById('ditherMethod').value;
        const invert = document.getElementById('invertColors').checked;

        // Get image data from final canvas
        const imageData = finalCtx.getImageData(0, 0, this.WIDTH, this.HEIGHT);
        const pixels = imageData.data;

        // Convert to grayscale
        const grayscale = new Float32Array(this.WIDTH * this.HEIGHT);
        for (let i = 0; i < pixels.length; i += 4) {
            const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
            grayscale[i / 4] = gray;
        }

        // Apply dithering
        let binaryData;
        switch (ditherMethod) {
            case 'floyd-steinberg':
                binaryData = this.floydSteinbergDither(grayscale, threshold);
                break;
            case 'atkinson':
                binaryData = this.atkinsonDither(grayscale, threshold);
                break;
            case 'ordered':
                binaryData = this.orderedDither(grayscale);
                break;
            default:
                binaryData = this.simpleDither(grayscale, threshold);
        }

        // Apply inversion
        if (invert) {
            for (let i = 0; i < binaryData.length; i++) {
                binaryData[i] = binaryData[i] === 0 ? 255 : 0;
            }
        }

        this.processedImageData = binaryData;

        // Render to export canvas
        const exportData = this.exportCtx.createImageData(this.WIDTH, this.HEIGHT);
        for (let i = 0; i < binaryData.length; i++) {
            const val = binaryData[i];
            exportData.data[i * 4] = val;
            exportData.data[i * 4 + 1] = val;
            exportData.data[i * 4 + 2] = val;
            exportData.data[i * 4 + 3] = 255;
        }
        this.exportCtx.putImageData(exportData, 0, 0);
    }

    floydSteinbergDither(grayscale, threshold) {
        const w = this.WIDTH;
        const h = this.HEIGHT;
        const data = Float32Array.from(grayscale);
        const output = new Uint8Array(w * h);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                const oldPixel = data[idx];
                const newPixel = oldPixel < threshold ? 0 : 255;
                output[idx] = newPixel;

                const error = oldPixel - newPixel;

                if (x + 1 < w) data[idx + 1] += error * 7 / 16;
                if (y + 1 < h) {
                    if (x > 0) data[idx + w - 1] += error * 3 / 16;
                    data[idx + w] += error * 5 / 16;
                    if (x + 1 < w) data[idx + w + 1] += error * 1 / 16;
                }
            }
        }

        return output;
    }

    atkinsonDither(grayscale, threshold) {
        const w = this.WIDTH;
        const h = this.HEIGHT;
        const data = Float32Array.from(grayscale);
        const output = new Uint8Array(w * h);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                const oldPixel = data[idx];
                const newPixel = oldPixel < threshold ? 0 : 255;
                output[idx] = newPixel;

                const error = (oldPixel - newPixel) / 8;

                if (x + 1 < w) data[idx + 1] += error;
                if (x + 2 < w) data[idx + 2] += error;
                if (y + 1 < h) {
                    if (x > 0) data[idx + w - 1] += error;
                    data[idx + w] += error;
                    if (x + 1 < w) data[idx + w + 1] += error;
                }
                if (y + 2 < h) {
                    data[idx + 2 * w] += error;
                }
            }
        }

        return output;
    }

    orderedDither(grayscale) {
        const w = this.WIDTH;
        const h = this.HEIGHT;
        const output = new Uint8Array(w * h);

        const bayer = [
            [0, 8, 2, 10],
            [12, 4, 14, 6],
            [3, 11, 1, 9],
            [15, 7, 13, 5]
        ];

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                const threshold = ((bayer[y % 4][x % 4] + 0.5) / 16) * 255;
                output[idx] = grayscale[idx] > threshold ? 255 : 0;
            }
        }

        return output;
    }

    simpleDither(grayscale, threshold) {
        const output = new Uint8Array(grayscale.length);
        for (let i = 0; i < grayscale.length; i++) {
            output[i] = grayscale[i] < threshold ? 0 : 255;
        }
        return output;
    }

    // Generate a bitmap that only contains STATIC content (drawings and images)
    // This excludes all dynamic widgets so they can be rendered as code instead
    generateStaticBitmap() {
        // Create a temporary canvas for static-only rendering
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.WIDTH;
        tempCanvas.height = this.HEIGHT;
        const tempCtx = tempCanvas.getContext('2d');

        // Fill with background color
        tempCtx.fillStyle = '#ebdbb2';
        tempCtx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

        // Draw ONLY images (no widgets)
        this.elements.forEach(element => {
            if (!element.visible) return;

            if (element.type === 'image' && element.imageData) {
                const img = new Image();
                img.src = element.imageData;
                tempCtx.drawImage(img, element.x, element.y, element.width, element.height);
            }
        });

        // Draw ONLY drawings (brush strokes and eraser)
        this.elements.forEach(element => {
            if (!element.visible || element.type !== 'drawing') return;
            if (element.points.length < 2) return;

            tempCtx.beginPath();
            tempCtx.moveTo(element.points[0].x, element.points[0].y);
            for (let i = 1; i < element.points.length; i++) {
                tempCtx.lineTo(element.points[i].x, element.points[i].y);
            }
            tempCtx.lineWidth = element.strokeWidth;
            tempCtx.lineCap = 'round';
            tempCtx.lineJoin = 'round';
            tempCtx.strokeStyle = element.isEraser ? '#ebdbb2' : '#1d2021';
            tempCtx.stroke();
        });

        // Convert to 1-bit using current settings
        const threshold = parseInt(document.getElementById('threshold').value);
        const ditherMethod = document.getElementById('ditherMethod').value;
        const invert = document.getElementById('invertColors').checked;

        const imageData = tempCtx.getImageData(0, 0, this.WIDTH, this.HEIGHT);
        const pixels = imageData.data;

        // Convert to grayscale
        const grayscale = new Float32Array(this.WIDTH * this.HEIGHT);
        for (let i = 0; i < pixels.length; i += 4) {
            const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
            grayscale[i / 4] = gray;
        }

        // Apply dithering
        let binaryData;
        switch (ditherMethod) {
            case 'floyd-steinberg':
                binaryData = this.floydSteinbergDither(grayscale, threshold);
                break;
            case 'atkinson':
                binaryData = this.atkinsonDither(grayscale, threshold);
                break;
            case 'ordered':
                binaryData = this.orderedDither(grayscale);
                break;
            default:
                binaryData = this.simpleDither(grayscale, threshold);
        }

        // Apply inversion
        if (invert) {
            for (let i = 0; i < binaryData.length; i++) {
                binaryData[i] = binaryData[i] === 0 ? 255 : 0;
            }
        }

        return binaryData;
    }

    // Collect all fonts required by the widgets
    collectRequiredFonts(widgets) {
        const fontMap = new Map();

        // Font database with include paths and download info
        const fontDatabase = {
            'DSEG7': {
                name: 'DSEG7 Classic Bold',
                include: 'Fonts/DSEG7_Classic_Bold.h',
                description: 'Seven-segment display font for digital clock',
                downloadUrl: 'https://github.com/sqfmi/Watchy/tree/master/src/Fonts',
                builtIn: true // Included with Watchy
            },
            'FreeSans': {
                name: 'FreeSans',
                include: 'Fonts/FreeSans.h',
                description: 'Sans-serif font (Adafruit GFX)',
                downloadUrl: 'https://github.com/adafruit/Adafruit-GFX-Library/tree/master/Fonts',
                builtIn: false
            },
            'FreeSansBold': {
                name: 'FreeSansBold',
                include: 'Fonts/FreeSansBold.h',
                description: 'Bold sans-serif font (Adafruit GFX)',
                downloadUrl: 'https://github.com/adafruit/Adafruit-GFX-Library/tree/master/Fonts',
                builtIn: false
            },
            'FreeSerif': {
                name: 'FreeSerif',
                include: 'Fonts/FreeSerif.h',
                description: 'Serif font (Adafruit GFX)',
                downloadUrl: 'https://github.com/adafruit/Adafruit-GFX-Library/tree/master/Fonts',
                builtIn: false
            },
            'FreeMono': {
                name: 'FreeMono',
                include: 'Fonts/FreeMono.h',
                description: 'Monospace font (Adafruit GFX)',
                downloadUrl: 'https://github.com/adafruit/Adafruit-GFX-Library/tree/master/Fonts',
                builtIn: false
            }
        };

        widgets.forEach(widget => {
            let fontKey = null;
            let fontSize = widget.fontSize || 16;

            switch (widget.type) {
                case 'digital-clock':
                    fontKey = 'DSEG7';
                    break;
                case 'date':
                case 'day-of-week':
                case 'weather-temp':
                case 'weather-condition':
                case 'weather-hi-lo':
                case 'steps':
                case 'text':
                    fontKey = 'FreeSansBold';
                    break;
            }

            if (fontKey && fontDatabase[fontKey] && !fontMap.has(fontKey)) {
                fontMap.set(fontKey, {
                    ...fontDatabase[fontKey],
                    sizes: new Set([fontSize])
                });
            } else if (fontKey && fontMap.has(fontKey)) {
                fontMap.get(fontKey).sizes.add(fontSize);
            }
        });

        return Array.from(fontMap.values());
    }

    generateCode() {
        let name = document.getElementById('exportName').value || 'watchface';
        name = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (/^[0-9]/.test(name)) name = '_' + name;

        const className = name.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join('');

        // Separate widgets from static content
        const widgets = this.elements.filter(el =>
            el.visible && !['drawing', 'image'].includes(el.type)
        );
        const hasStaticContent = this.elements.some(el =>
            el.visible && ['drawing', 'image'].includes(el.type)
        );

        const staticBitmapData = this.generateStaticBitmap();
        const requiredFonts = this.collectRequiredFonts(widgets);

        // 1. Generate INO File
        let inoCode = `#include "${className}Watch.h"\n`;
        inoCode += `#include "settings.h"\n\n`;
        inoCode += `${className}Watch watchy(settings);\n\n`;
        inoCode += `void setup() {\n`;
        inoCode += `  watchy.init();\n`;
        inoCode += `}\n\n`;
        inoCode += `void loop() {\n`;
        inoCode += `}\n`;

        // 2. Generate Header (.h) File
        let hCode = `#ifndef ${className.toUpperCase()}WATCH_H\n`;
        hCode += `#define ${className.toUpperCase()}WATCH_H\n\n`;
        hCode += `#include <Watchy.h>\n\n`;
        hCode += `class ${className}Watch : public Watchy {\n`;
        hCode += `  public:\n`;
        hCode += `    ${className}Watch(const watchySettings& settings);\n\n`;
        hCode += `    void drawWatchFace() override;\n\n`;
        hCode += `  private:\n`;
        if (hasStaticContent) hCode += `    void drawBackground();\n`;
        widgets.forEach(w => {
            const funcName = w.type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
            hCode += `    void draw${funcName}();\n`;
        });
        hCode += `};\n\n`;
        hCode += `#endif\n`;

        // 3. Generate Source (.cpp) File
        let cppCode = `#include "${className}Watch.h"\n`;
        cppCode += `#include "bitmaps.h"\n`;
        if (requiredFonts.length > 0) {
            requiredFonts.forEach(font => {
                cppCode += `#include "${font.include}"\n`;
            });
        }
        cppCode += `\n`;
        cppCode += `${className}Watch::${className}Watch(const watchySettings& settings)\n`;
        cppCode += `  : Watchy(settings) {}\n\n`;
        cppCode += `void ${className}Watch::drawWatchFace() {\n`;
        if (hasStaticContent) cppCode += `  drawBackground();\n`;
        widgets.forEach(w => {
            const funcName = w.type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
            cppCode += `  draw${funcName}();\n`;
        });
        cppCode += `}\n\n`;

        if (hasStaticContent) {
            cppCode += `void ${className}Watch::drawBackground() {\n`;
            cppCode += `  display.drawBitmap(0, 0, BITMAP_BACKGROUND, 200, 200, GxEPD_BLACK);\n`;
            cppCode += `}\n\n`;
        }

        widgets.forEach(widget => {
            const funcName = widget.type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
            cppCode += `void ${className}Watch::draw${funcName}() {\n`;
            const code = this.generateWidgetCode(widget);
            if (code) {
                const indentedCode = code.split('\n').filter(l => l.trim()).map(line => '  ' + line.trim()).join('\n');
                cppCode += indentedCode + '\n';
            }
            cppCode += `}\n\n`;
        });

        // 4. Generate bitmaps.h
        let bitmapsCode = `#ifndef BITMAPS_H\n`;
        bitmapsCode += `#define BITMAPS_H\n\n`;
        bitmapsCode += `#include <Arduino.h>\n\n`;
        if (hasStaticContent) {
            const bytes = this.convertToBytes(staticBitmapData);
            bitmapsCode += `const unsigned char BITMAP_BACKGROUND[] PROGMEM = {\n`;
            for (let i = 0; i < bytes.length; i++) {
                if (i % 16 === 0) bitmapsCode += '  ';
                bitmapsCode += '0x' + bytes[i].toString(16).padStart(2, '0');
                if (i < bytes.length - 1) bitmapsCode += ', ';
                if ((i + 1) % 16 === 0) bitmapsCode += '\n';
            }
            bitmapsCode += '\n};\n';
        } else {
            bitmapsCode += `// No static bitmaps generated\n`;
        }
        bitmapsCode += `\n#endif\n`;

        // 5. Generate settings.h
        let settingsCode = `#ifndef SETTINGS_H\n`;
        settingsCode += `#define SETTINGS_H\n\n`;
        settingsCode += `#include <Watchy.h>\n\n`;
        settingsCode += `watchySettings settings = {\n`;
        settingsCode += `  .cityID = "5128581",\n`;
        settingsCode += `  .weatherAPIKey = "your_key_here",\n`;
        settingsCode += `  .weatherURL = "https://api.openweathermap.org/data/2.5/weather?id=",\n`;
        settingsCode += `  .weatherUnit = "metric",\n`;
        settingsCode += `  .weatherLang = "en",\n`;
        settingsCode += `  .weatherUpdateInterval = 60,\n`;
        settingsCode += `  .ntpServer = "pool.ntp.org",\n`;
        settingsCode += `  .gmtOffset = 0,\n`;
        settingsCode += `  .vibrateOClock = true\n`;
        settingsCode += `};\n\n`;
        settingsCode += `#endif\n`;

        document.getElementById('inoCode').textContent = inoCode;
        document.getElementById('hCode').textContent = hCode;
        document.getElementById('cppCode').textContent = cppCode;
        document.getElementById('bitmapsCode').textContent = bitmapsCode;
        document.getElementById('settingsCode').textContent = settingsCode;

        // Generate raw hex (just the static background bitmap, no widgets)
        let rawCode = '';
        if (hasStaticContent) {
            const bytes = this.convertToBytes(staticBitmapData);
            for (let i = 0; i < bytes.length; i++) {
                rawCode += bytes[i].toString(16).padStart(2, '0');
                if ((i + 1) % 25 === 0) rawCode += '\n';
                else if (i < bytes.length - 1) rawCode += ' ';
            }
        } else {
            rawCode = '// No static background - all widgets are dynamic';
        }
        document.getElementById('rawCode').textContent = rawCode;

        this.showModal();
    }

    generateWidgetCode(widget) {
        const x = widget.x;
        const y = widget.y;
        const w = widget.width;
        const h = widget.height;
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        const color = widget.color === 'white' ? 'GxEPD_WHITE' : 'GxEPD_BLACK';

        switch (widget.type) {
            case 'digital-clock':
                return `  // ===== DIGITAL CLOCK =====\n` +
                    `  // Position: (${x}, ${y}) Size: ${w}x${h}\n` +
                    `  display.setFont(&DSEG7_Classic_Bold_${widget.fontSize});\n` +
                    `  display.setTextColor(${color});\n` +
                    `  display.setCursor(${x}, ${Math.round(y + h * 0.8)});\n` +
                    `  if (currentTime.Hour < 10) display.print("0");\n` +
                    `  display.print(currentTime.Hour);\n` +
                    `  display.print(":");\n` +
                    `  if (currentTime.Minute < 10) display.print("0");\n` +
                    `  display.print(currentTime.Minute);\n`;

            case 'date':
                return `  // ===== DATE =====\n` +
                    `  // Position: (${x}, ${y}) Size: ${w}x${h}\n` +
                    `  display.setFont(&FreeSansBold${widget.fontSize}pt7b);\n` +
                    `  display.setTextColor(${color});\n` +
                    `  display.setCursor(${x}, ${Math.round(y + h * 0.8)});\n` +
                    `  // Months array\n` +
                    `  const char* months[] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};\n` +
                    `  display.print(months[currentTime.Month - 1]);\n` +
                    `  display.print(" ");\n` +
                    `  display.print(currentTime.Day);\n`;

            case 'day-of-week':
                return `  // ===== DAY OF WEEK =====\n` +
                    `  // Position: (${x}, ${y}) Size: ${w}x${h}\n` +
                    `  display.setFont(&FreeSansBold${widget.fontSize}pt7b);\n` +
                    `  display.setTextColor(${color});\n` +
                    `  display.setCursor(${x}, ${Math.round(y + h * 0.8)});\n` +
                    `  const char* days[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};\n` +
                    `  display.print(days[currentTime.Wday - 1]);\n`;

            case 'weather-temp':
                return `  // ===== TEMPERATURE =====\n` +
                    `  // Position: (${x}, ${y}) Size: ${w}x${h}\n` +
                    `  display.setFont(&FreeSansBold${widget.fontSize}pt7b);\n` +
                    `  display.setTextColor(${color});\n` +
                    `  display.setCursor(${x}, ${Math.round(y + h * 0.8)});\n` +
                    `  display.print(getWeatherData().temperature);\n` +
                    `  display.print("°");\n`;

            case 'weather-icon':
                return `  // ===== WEATHER ICON =====\n` +
                    `  // Position: (${x}, ${y}) Size: ${w}x${h}\n` +
                    `  // TODO: Draw weather icon based on getWeatherData().weatherConditionCode\n`;

            case 'weather-condition':
                return `  // ===== WEATHER CONDITION =====\n` +
                    `  // Position: (${x}, ${y}) Size: ${w}x${h}\n` +
                    `  display.setFont(&FreeSans${widget.fontSize}pt7b);\n` +
                    `  display.setTextColor(${color});\n` +
                    `  display.setCursor(${x}, ${Math.round(y + h * 0.8)});\n` +
                    `  // Map condition code to string if needed\n` +
                    `  display.print("Sunny"); // Placeholder\n`;

            case 'weather-hi-lo':
                return `  // ===== HI/LO TEMPERATURE =====\n` +
                    `  // Position: (${x}, ${y}) Size: ${w}x${h}\n` +
                    `  display.setFont(&FreeSans${widget.fontSize}pt7b);\n` +
                    `  display.setTextColor(${color});\n` +
                    `  display.setCursor(${x}, ${Math.round(y + h * 0.8)});\n` +
                    `  display.print("H:28° L:15°"); // Placeholder\n`;

            case 'battery':
                return `  // ===== BATTERY INDICATOR =====\n` +
                    `  // Position: (${x}, ${y}) Size: ${w}x${h}\n` +
                    `  float batteryVoltage = getBatteryVoltage();\n` +
                    `  int batteryPercent = 100 * ((batteryVoltage - 3.3) / (4.2 - 3.3));\n` +
                    `  batteryPercent = batteryPercent > 100 ? 100 : (batteryPercent < 0 ? 0 : batteryPercent);\n` +
                    `  // Draw battery outline\n` +
                    `  display.drawRect(${x}, ${y + 2}, ${w - 4}, ${h - 4}, ${color});\n` +
                    `  display.fillRect(${x + w - 4}, ${y + Math.round(h / 3)}, 4, ${Math.round(h / 3)}, ${color});\n` +
                    `  // Draw battery fill\n` +
                    `  int fillWidth = (${w - 8}) * batteryPercent / 100;\n` +
                    `  display.fillRect(${x + 2}, ${y + 4}, fillWidth, ${h - 8}, ${color});\n`;

            case 'steps':
                return `  // ===== STEP COUNTER =====\n` +
                    `  // Position: (${x}, ${y}) Size: ${w}x${h}\n` +
                    `  display.setFont(&FreeSans${widget.fontSize}pt7b);\n` +
                    `  display.setTextColor(${color});\n` +
                    `  display.setCursor(${x}, ${Math.round(y + h * 0.8)});\n` +
                    `  uint32_t stepCount = sensor.getCounter();\n` +
                    `  display.print(stepCount);\n`;

            case 'wifi':
                return `  // ===== WIFI INDICATOR =====\n` +
                    `  // Position: (${x}, ${y}) Size: ${w}x${h}\n` +
                    `  // TODO: Draw WiFi icon based on connection status\n` +
                    `  // display.drawBitmap(${x}, ${y}, wifi_icon, ${w}, ${h}, ${color});\n`;

            case 'bluetooth':
                return `  // ===== BLUETOOTH INDICATOR =====\n` +
                    `  // Position: (${x}, ${y}) Size: ${w}x${h}\n` +
                    `  // TODO: Draw Bluetooth icon based on connection status\n` +
                    `  // display.drawBitmap(${x}, ${y}, bluetooth_icon, ${w}, ${h}, ${color});\n`;

            case 'analog-clock':
                return `  // ===== ANALOG CLOCK =====\n` +
                    `  // Position: center (${Math.round(centerX)}, ${Math.round(centerY)}) Radius: ${Math.round(Math.min(w, h) / 2)}\n` +
                    `  int cx = ${Math.round(centerX)};\n` +
                    `  int cy = ${Math.round(centerY)};\n` +
                    `  int r = ${Math.round(Math.min(w, h) / 2 - 2)};\n` +
                    `  // Draw clock face\n` +
                    `  display.drawCircle(cx, cy, r, ${color});\n` +
                    `  // Calculate hand angles\n` +
                    `  float hourAngle = ((currentTime.Hour % 12) + currentTime.Minute / 60.0) * 30 - 90;\n` +
                    `  float minAngle = currentTime.Minute * 6 - 90;\n` +
                    `  // Draw hour hand\n` +
                    `  int hx = cx + cos(hourAngle * PI / 180) * (r * 0.5);\n` +
                    `  int hy = cy + sin(hourAngle * PI / 180) * (r * 0.5);\n` +
                    `  display.drawLine(cx, cy, hx, hy, ${color});\n` +
                    `  // Draw minute hand\n` +
                    `  int mx = cx + cos(minAngle * PI / 180) * (r * 0.75);\n` +
                    `  int my = cy + sin(minAngle * PI / 180) * (r * 0.75);\n` +
                    `  display.drawLine(cx, cy, mx, my, ${color});\n` +
                    `  // Draw center dot\n` +
                    `  display.fillCircle(cx, cy, 3, ${color});\n`;

            case 'rectangle':
                return `  // ===== RECTANGLE =====\n` +
                    `  // Position: (${x}, ${y}) Size: ${w}x${h}\n` +
                    `  display.drawRect(${x}, ${y}, ${w}, ${h}, ${color});\n`;

            case 'circle':
                return `  // ===== CIRCLE =====\n` +
                    `  // Center: (${Math.round(centerX)}, ${Math.round(centerY)}) Radius: ${Math.round(Math.min(w, h) / 2)}\n` +
                    `  display.drawCircle(${Math.round(centerX)}, ${Math.round(centerY)}, ${Math.round(Math.min(w, h) / 2)}, ${color});\n`;

            case 'line':
                return `  // ===== LINE =====\n` +
                    `  // From: (${x}, ${Math.round(y + h / 2)}) To: (${x + w}, ${Math.round(y + h / 2)})\n` +
                    `  display.drawLine(${x}, ${Math.round(y + h / 2)}, ${x + w}, ${Math.round(y + h / 2)}, ${color});\n`;

            case 'text':
                return `  // ===== STATIC TEXT: "${widget.text}" =====\n` +
                    `  // Position: (${x}, ${y}) Size: ${w}x${h}\n` +
                    `  display.setFont(&FreeSans${widget.fontSize}pt7b);\n` +
                    `  display.setTextColor(${color});\n` +
                    `  display.setCursor(${x}, ${Math.round(y + h * 0.8)});\n` +
                    `  display.print("${widget.text}");\n`;

            default:
                return null;
        }
    }

    convertToBytes(binaryData) {
        const bytes = [];
        const w = this.WIDTH;
        const h = this.HEIGHT;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x += 8) {
                let byte = 0;
                for (let bit = 0; bit < 8; bit++) {
                    const idx = y * w + x + bit;
                    if (binaryData[idx] === 255) {
                        byte |= (1 << (7 - bit));
                    }
                }
                bytes.push(byte);
            }
        }

        return bytes;
    }

    showModal() {
        document.getElementById('codeModal').classList.add('visible');
    }

    closeModal() {
        document.getElementById('codeModal').classList.remove('visible');
    }

    switchCodeTab(tab) {
        document.querySelectorAll('.code-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        document.querySelectorAll('.code-panel').forEach(p => {
            p.classList.toggle('active', p.id === tab + 'CodePanel');
        });
    }

    copyToClipboard(text, buttonId) {
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById(buttonId);
            btn.classList.add('copied');
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copied!
            `;
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    Copy
                `;
            }, 2000);
        });
    }

    downloadPng() {
        this.updateExportPreview();
        const name = document.getElementById('exportName').value || 'watchface';
        const url = this.exportCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}_200x200.png`;
        a.click();
    }

    downloadHeaderFile() {
        const activeTab = document.querySelector('.code-tab.active').dataset.tab;
        let content = '';
        let filename = '';
        let name = document.getElementById('exportName').value || 'watchface';
        name = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const className = name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');

        switch (activeTab) {
            case 'ino':
                content = document.getElementById('inoCode').textContent;
                filename = `${className}.ino`;
                break;
            case 'h':
                content = document.getElementById('hCode').textContent;
                filename = `${className}Watch.h`;
                break;
            case 'cpp':
                content = document.getElementById('cppCode').textContent;
                filename = `${className}Watch.cpp`;
                break;
            case 'bitmaps':
                content = document.getElementById('bitmapsCode').textContent;
                filename = `bitmaps.h`;
                break;
            case 'settings':
                content = document.getElementById('settingsCode').textContent;
                filename = `settings.h`;
                break;
            case 'raw':
                content = document.getElementById('rawCode').textContent;
                filename = `${name}_raw.txt`;
                break;
        }

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    async saveProject() {
        // Generate the code first to ensure all content is ready
        this.generateCode();

        let name = document.getElementById('exportName').value || 'watchface';
        name = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (/^[0-9]/.test(name)) name = '_' + name;
        const className = name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');

        // Create project metadata
        const project = {
            version: 1,
            name: name,
            className: className,
            elements: this.elements,
            customFonts: this.customFonts.map(f => ({ name: f.name, dataUrl: f.dataUrl })),
            settings: {
                threshold: document.getElementById('threshold').value,
                ditherMethod: document.getElementById('ditherMethod').value,
                invertColors: document.getElementById('invertColors').checked
            }
        };

        // Get generated code from the modal
        const inoCode = document.getElementById('inoCode').textContent;
        const hCode = document.getElementById('hCode').textContent;
        const cppCode = document.getElementById('cppCode').textContent;
        const bitmapsCode = document.getElementById('bitmapsCode').textContent;
        const settingsCode = document.getElementById('settingsCode').textContent;

        // Create a zip file
        const zip = new JSZip();

        // Create a folder with the project name
        const folder = zip.folder(className);

        // Add project metadata
        folder.file('project.json', JSON.stringify(project, null, 2));

        // Add all generated code files
        folder.file(`${className}.ino`, inoCode);
        folder.file(`${className}Watch.h`, hCode);
        folder.file(`${className}Watch.cpp`, cppCode);
        folder.file('bitmaps.h', bitmapsCode);
        folder.file('settings.h', settingsCode);

        // Add a README file
        const readmeContent = `# ${className} Watchface

Generated by Watchy Watchface Designer

## Files Included:
- ${className}.ino - Main Arduino sketch
- ${className}Watch.h - Watchface class header
- ${className}Watch.cpp - Watchface class implementation
- bitmaps.h - Bitmap data for static graphics
- settings.h - Watchy configuration settings
- project.json - Project metadata (for re-importing)

## Installation:
1. Copy all files to a new folder inside your Arduino sketches directory
2. Open ${className}.ino in Arduino IDE
3. Update settings.h with your WiFi and weather API credentials
4. Upload to your Watchy device

## Re-importing:
To edit this project again, use the "Import Project" button in the
Watchface Designer and select this .zip file.
`;
        folder.file('README.md', readmeContent);

        // Generate and download the zip
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${className}_watchface.zip`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async importProject(file) {
        if (!file) return;

        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(file);

            // Find the project.json file (might be in a subfolder)
            let projectJson = null;
            let projectFolder = '';

            for (const [path, zipEntry] of Object.entries(contents.files)) {
                if (path.endsWith('project.json') && !zipEntry.dir) {
                    projectJson = await zipEntry.async('string');
                    projectFolder = path.replace('project.json', '');
                    break;
                }
            }

            if (!projectJson) {
                alert('Invalid project file: project.json not found in the zip archive.');
                return;
            }

            const project = JSON.parse(projectJson);

            // Clear current elements
            this.elements = [];
            this.elementsContainer.innerHTML = '';
            this.selectedElement = null;
            this.clearCanvas();

            // Restore settings
            if (project.settings) {
                document.getElementById('threshold').value = project.settings.threshold || 128;
                document.getElementById('thresholdValue').textContent = project.settings.threshold || 128;
                document.getElementById('ditherMethod').value = project.settings.ditherMethod || 'floyd-steinberg';
                document.getElementById('invertColors').checked = project.settings.invertColors || false;
            }

            // Restore project name
            document.getElementById('exportName').value = project.name || 'watchface';

            // Restore custom fonts
            if (project.customFonts && project.customFonts.length > 0) {
                for (const fontData of project.customFonts) {
                    const fontName = fontData.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
                    const cssName = 'CustomFont_' + fontName;

                    // Check if font already exists
                    if (!this.customFonts.find(f => f.name === fontData.name)) {
                        const fontFace = new FontFace(cssName, `url(${fontData.dataUrl})`);
                        await fontFace.load();
                        document.fonts.add(fontFace);

                        this.customFonts.push({
                            name: fontData.name,
                            cssName: cssName,
                            dataUrl: fontData.dataUrl
                        });

                        // Add to font dropdown
                        const select = document.getElementById('propFontFamily');
                        const option = document.createElement('option');
                        option.value = `'${cssName}', monospace`;
                        option.textContent = fontName + ' (Custom)';
                        select.appendChild(option);
                    }
                }
            }

            // Restore elements
            if (project.elements) {
                for (const element of project.elements) {
                    this.elementIdCounter = Math.max(this.elementIdCounter, element.id);
                    this.elements.push(element);

                    // Create DOM for non-drawing elements
                    if (element.type !== 'drawing') {
                        this.createElementDOM(element);
                    }
                }
            }

            // Render and update
            this.renderCanvas();
            this.updateLayers();
            this.updateExportPreview();
            this.updatePropertyPanel();

            // Reset the file input so the same file can be imported again
            document.getElementById('projectImportInput').value = '';

            alert(`Project "${project.name}" imported successfully!`);
        } catch (error) {
            console.error('Error importing project:', error);
            alert('Error importing project: ' + error.message);
        }
    }

    // ===== Code Preview Methods =====
    toggleCodePreviewSection() {
        const btn = document.getElementById('toggleCodePreview');
        const content = document.getElementById('codePreviewContent');
        btn.classList.toggle('collapsed');
        content.classList.toggle('collapsed');
    }

    parseBitmapCode(code) {
        // Extract hex values from various C++ bitmap array formats
        const bytes = [];

        // Remove comments
        code = code.replace(/\/\/.*$/gm, '');
        code = code.replace(/\/\*[\s\S]*?\*\//g, '');

        // Find array content between { and }
        const arrayMatch = code.match(/\{([^}]+)\}/);
        if (!arrayMatch) {
            return { success: false, error: 'No array found. Make sure code contains { ... }' };
        }

        const arrayContent = arrayMatch[1];

        // Match hex values (0xFF, 0xff), binary values (0b10101010), and decimal values
        const hexPattern = /0x([0-9a-fA-F]{1,2})/g;
        const binaryPattern = /0b([01]{8})/g;
        const decimalPattern = /\b(\d{1,3})\b/g;

        let match;

        // First try hex values
        while ((match = hexPattern.exec(arrayContent)) !== null) {
            bytes.push(parseInt(match[1], 16));
        }

        // If no hex, try binary
        if (bytes.length === 0) {
            while ((match = binaryPattern.exec(arrayContent)) !== null) {
                bytes.push(parseInt(match[1], 2));
            }
        }

        // If still nothing, try decimal (only values 0-255)
        if (bytes.length === 0) {
            while ((match = decimalPattern.exec(arrayContent)) !== null) {
                const val = parseInt(match[1], 10);
                if (val >= 0 && val <= 255) {
                    bytes.push(val);
                }
            }
        }

        if (bytes.length === 0) {
            return { success: false, error: 'No valid byte values found' };
        }

        return { success: true, bytes };
    }

    detectBitmapDimensions() {
        const code = document.getElementById('bitmapCodeInput').value;
        const dimSpan = document.getElementById('detectedDimensions');

        if (!code.trim()) {
            dimSpan.textContent = 'Auto-detect dimensions';
            dimSpan.className = '';
            return;
        }

        const result = this.parseBitmapCode(code);

        if (!result.success) {
            dimSpan.textContent = result.error;
            dimSpan.className = 'error';
            return;
        }

        const totalBytes = result.bytes.length;
        const totalBits = totalBytes * 8;

        // Try to detect dimensions from common patterns
        let detectedWidth = 200;
        let detectedHeight = 200;

        // Try common Watchy dimensions first
        const commonSizes = [
            { w: 200, h: 200 }, // Full screen
            { w: 128, h: 128 },
            { w: 64, h: 64 },
            { w: 32, h: 32 },
            { w: 16, h: 16 },
            { w: 48, h: 48 },
            { w: 24, h: 24 },
            { w: 100, h: 100 },
        ];

        // For 1-bit images, each byte = 8 pixels
        // Look for width/height comments in code
        const widthMatch = code.match(/width\s*[:=]\s*(\d+)/i) || code.match(/(\d+)\s*x\s*\d+/i);
        const heightMatch = code.match(/height\s*[:=]\s*(\d+)/i) || code.match(/\d+\s*x\s*(\d+)/i);

        if (widthMatch && heightMatch) {
            detectedWidth = parseInt(widthMatch[1], 10);
            detectedHeight = parseInt(heightMatch[1], 10);
        } else {
            // Try to find matching dimensions from common sizes
            for (const size of commonSizes) {
                const expectedBytes = (size.w * size.h) / 8;
                if (totalBytes === expectedBytes) {
                    detectedWidth = size.w;
                    detectedHeight = size.h;
                    break;
                }
            }

            // If no exact match, calculate from byte count
            if (totalBits >= 40000) { // 200x200
                detectedWidth = 200;
                detectedHeight = 200;
            } else {
                // Try to find square dimensions
                const side = Math.sqrt(totalBits);
                if (Number.isInteger(side)) {
                    detectedWidth = side;
                    detectedHeight = side;
                }
            }
        }

        dimSpan.textContent = `Detected: ${detectedWidth}×${detectedHeight} (${totalBytes} bytes)`;
        dimSpan.className = 'detected';

        // Update dimension inputs if auto-detect is enabled
        if (document.getElementById('previewAutoSize').checked) {
            document.getElementById('previewWidth').value = detectedWidth;
            document.getElementById('previewHeight').value = detectedHeight;
        }
    }

    previewBitmapCode() {
        const code = document.getElementById('bitmapCodeInput').value;
        const resultContainer = document.getElementById('codePreviewResult');
        const canvas = document.getElementById('codePreviewCanvas');
        const placeholder = resultContainer.querySelector('.preview-placeholder');

        // Clear previous states
        resultContainer.classList.remove('success', 'error');

        if (!code.trim()) {
            this.showPreviewError('Please paste bitmap code first');
            return;
        }

        const result = this.parseBitmapCode(code);

        if (!result.success) {
            this.showPreviewError(result.error);
            return;
        }

        const width = parseInt(document.getElementById('previewWidth').value) || 200;
        const height = parseInt(document.getElementById('previewHeight').value) || 200;
        const invert = document.getElementById('previewInvert').checked;

        // Render the bitmap
        this.renderBitmapPreview(result.bytes, width, height, invert);

        // Show canvas, hide placeholder
        if (placeholder) placeholder.style.display = 'none';
        canvas.style.display = 'block';
        resultContainer.classList.add('success');

        // Store the parsed data for "Add to Canvas"
        this.lastParsedBitmap = {
            bytes: result.bytes,
            width,
            height,
            invert
        };
    }

    renderBitmapPreview(bytes, width, height, invert = false) {
        const canvas = document.getElementById('codePreviewCanvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size
        canvas.width = width;
        canvas.height = height;

        // Create image data
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        // Gruvbox colors
        const bgColor = invert ? [29, 32, 33] : [235, 219, 178]; // dark : light
        const fgColor = invert ? [235, 219, 178] : [29, 32, 33]; // light : dark

        // Fill with background first
        for (let i = 0; i < data.length; i += 4) {
            data[i] = bgColor[0];
            data[i + 1] = bgColor[1];
            data[i + 2] = bgColor[2];
            data[i + 3] = 255;
        }

        // Render bitmap (1-bit, MSB first)
        const bytesPerRow = Math.ceil(width / 8);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const byteIndex = y * bytesPerRow + Math.floor(x / 8);
                const bitIndex = 7 - (x % 8); // MSB first

                if (byteIndex < bytes.length) {
                    const byte = bytes[byteIndex];
                    const bit = (byte >> bitIndex) & 1;

                    // In typical e-ink: 1 = white/background, 0 = black/foreground
                    // But this can vary, so we treat 1 as foreground here
                    const pixelIndex = (y * width + x) * 4;

                    if (bit === 1) {
                        data[pixelIndex] = fgColor[0];
                        data[pixelIndex + 1] = fgColor[1];
                        data[pixelIndex + 2] = fgColor[2];
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    showPreviewError(message) {
        const resultContainer = document.getElementById('codePreviewResult');
        const canvas = document.getElementById('codePreviewCanvas');
        const placeholder = resultContainer.querySelector('.preview-placeholder');

        canvas.style.display = 'none';
        resultContainer.classList.add('error');

        // Show error in placeholder
        if (placeholder) {
            placeholder.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>${message}</p>
            `;
            placeholder.style.display = 'flex';
        }
    }

    addBitmapToCanvas() {
        if (!this.lastParsedBitmap) {
            alert('Please preview the code first');
            return;
        }

        const { bytes, width, height, invert } = this.lastParsedBitmap;

        // Create a temporary canvas to generate image data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');

        // Render to temp canvas
        const imageData = tempCtx.createImageData(width, height);
        const data = imageData.data;

        const bgColor = invert ? [29, 32, 33] : [235, 219, 178];
        const fgColor = invert ? [235, 219, 178] : [29, 32, 33];

        for (let i = 0; i < data.length; i += 4) {
            data[i] = bgColor[0];
            data[i + 1] = bgColor[1];
            data[i + 2] = bgColor[2];
            data[i + 3] = 255;
        }

        const bytesPerRow = Math.ceil(width / 8);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const byteIndex = y * bytesPerRow + Math.floor(x / 8);
                const bitIndex = 7 - (x % 8);

                if (byteIndex < bytes.length) {
                    const byte = bytes[byteIndex];
                    const bit = (byte >> bitIndex) & 1;

                    const pixelIndex = (y * width + x) * 4;

                    if (bit === 1) {
                        data[pixelIndex] = fgColor[0];
                        data[pixelIndex + 1] = fgColor[1];
                        data[pixelIndex + 2] = fgColor[2];
                    }
                }
            }
        }

        tempCtx.putImageData(imageData, 0, 0);

        // Convert to data URL
        const imageDataUrl = tempCanvas.toDataURL('image/png');

        // Add as image element
        this.saveState();

        const element = {
            id: ++this.elementIdCounter,
            type: 'image',
            x: 0,
            y: 0,
            width: Math.min(width, this.WIDTH),
            height: Math.min(height, this.HEIGHT),
            imageData: imageDataUrl,
            visible: true,
            locked: false
        };

        this.elements.push(element);
        this.createElementDOM(element);
        this.selectElement(element);
        this.updateLayers();
        this.renderCanvas();
        this.updateExportPreview();

        // Scroll to canvas
        document.getElementById('watchyDisplay').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    clearCodePreview() {
        document.getElementById('bitmapCodeInput').value = '';
        document.getElementById('detectedDimensions').textContent = 'Auto-detect dimensions';
        document.getElementById('detectedDimensions').className = '';

        const resultContainer = document.getElementById('codePreviewResult');
        const canvas = document.getElementById('codePreviewCanvas');
        const placeholder = resultContainer.querySelector('.preview-placeholder');

        canvas.style.display = 'none';
        resultContainer.classList.remove('success', 'error');

        if (placeholder) {
            placeholder.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <p>Preview will appear here</p>
            `;
            placeholder.style.display = 'flex';
        }

        this.lastParsedBitmap = null;
    }

    // ===== Keyboard Shortcuts =====
    handleKeyboard(e) {
        // Don't trigger shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this.deleteSelected();
        } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.duplicateSelected();
        } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (e.shiftKey) {
                this.redo();
            } else {
                this.undo();
            }
        } else if (e.key === 'Escape') {
            this.selectElement(null);
            this.closeModal();
        } else if (e.key === 'g' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.toggleGrid();
        } else if (e.key === 'v') {
            this.setActiveTool('select');
        } else if (e.key === 'b') {
            this.setActiveTool('brush');
        } else if (e.key === 'e') {
            this.setActiveTool('eraser');
        } else if (this.selectedElement && !e.ctrlKey && !e.metaKey) {
            // Arrow key movement
            const step = e.shiftKey ? 10 : 1;
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    this.updateElementProperty('y', Math.max(0, this.selectedElement.y - step));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.updateElementProperty('y', Math.min(this.HEIGHT - this.selectedElement.height, this.selectedElement.y + step));
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.updateElementProperty('x', Math.max(0, this.selectedElement.x - step));
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.updateElementProperty('x', Math.min(this.WIDTH - this.selectedElement.width, this.selectedElement.x + step));
                    break;
            }
        }
    }

    updateLayout() {
        // Responsive adjustments if needed
    }
}

// Initialize the designer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WatchfaceDesigner();
});
