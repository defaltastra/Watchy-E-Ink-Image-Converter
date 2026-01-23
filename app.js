/**
 * Watchy Watchface Designer
 * A Canva-like tool for creating custom watchfaces for the Watchy e-ink smartwatch
 */

class WatchfaceDesigner {
    constructor() {
        this.canvas = document.getElementById('designCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.elementsContainer = document.getElementById('canvasElements');
        this.exportCanvas = document.getElementById('exportPreviewCanvas');
        this.exportCtx = this.exportCanvas.getContext('2d');

        this.WIDTH = 200;
        this.HEIGHT = 200;

        this.elements = [];
        this.selectedElement = null;
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

        // Canvas click to deselect
        this.canvas.addEventListener('click', (e) => {
            if (e.target === this.canvas) {
                this.selectElement(null);
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
        document.getElementById('copyArduino').addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('arduinoCode').textContent, 'copyArduino');
        });
        document.getElementById('copyRaw').addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('rawCode').textContent, 'copyRaw');
        });
        document.getElementById('downloadHeaderBtn').addEventListener('click', () => this.downloadHeaderFile());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Window resize
        window.addEventListener('resize', () => this.updateLayout());
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
        div.className = 'canvas-element';
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
                content.innerHTML = `<span style="font-family: 'JetBrains Mono', monospace; font-size: ${element.fontSize}px; color: ${color}; white-space: nowrap;">${element.text}</span>`;
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
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
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

            this.selectedElement.x = Math.max(0, Math.min(Math.round(x), this.WIDTH - this.selectedElement.width));
            this.selectedElement.y = Math.max(0, Math.min(Math.round(y), this.HEIGHT - this.selectedElement.height));
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

        if (!this.selectedElement) {
            noSelectionPanel.classList.remove('hidden');
            elementProperties.classList.add('hidden');
            return;
        }

        noSelectionPanel.classList.add('hidden');
        elementProperties.classList.remove('hidden');

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
                default:
                    iconSvg = '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
            }

            layerItem.innerHTML = `
                <div class="layer-icon">${iconSvg}</div>
                <span class="layer-name">${element.type}${element.text ? ': ' + element.text.substring(0, 10) : ''}</span>
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

    // ===== Canvas Rendering =====
    renderCanvas() {
        this.clearCanvas();

        this.elements.forEach(element => {
            if (!element.visible) return;

            const color = element.color === 'white' ? '#ebdbb2' : '#1d2021';
            this.ctx.fillStyle = color;
            this.ctx.strokeStyle = color;

            switch (element.type) {
                case 'digital-clock':
                case 'date':
                case 'day-of-week':
                case 'weather-temp':
                case 'weather-condition':
                case 'weather-hi-lo':
                case 'steps':
                case 'text':
                    this.ctx.font = `bold ${element.fontSize}px JetBrains Mono, monospace`;
                    this.ctx.textBaseline = 'middle';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(element.text, element.x + element.width / 2, element.y + element.height / 2);
                    break;
                case 'analog-clock':
                    const cx = element.x + element.width / 2;
                    const cy = element.y + element.height / 2;
                    const r = Math.min(element.width, element.height) / 2 - 2;

                    this.ctx.beginPath();
                    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    this.ctx.lineWidth = 2;
                    this.ctx.stroke();

                    // Hour hand
                    this.ctx.beginPath();
                    this.ctx.moveTo(cx, cy);
                    this.ctx.lineTo(cx, cy - r * 0.5);
                    this.ctx.lineWidth = 3;
                    this.ctx.stroke();

                    // Minute hand
                    this.ctx.beginPath();
                    this.ctx.moveTo(cx, cy);
                    this.ctx.lineTo(cx + r * 0.7, cy);
                    this.ctx.lineWidth = 2;
                    this.ctx.stroke();

                    // Center dot
                    this.ctx.beginPath();
                    this.ctx.arc(cx, cy, 3, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;
                case 'weather-icon':
                    this.drawWeatherIcon(element);
                    break;
                case 'battery':
                    this.drawBattery(element);
                    break;
                case 'wifi':
                    this.drawWifi(element);
                    break;
                case 'bluetooth':
                    this.drawBluetooth(element);
                    break;
                case 'rectangle':
                    this.ctx.lineWidth = element.strokeWidth;
                    this.ctx.strokeRect(element.x, element.y, element.width, element.height);
                    break;
                case 'circle':
                    const circleR = Math.min(element.width, element.height) / 2;
                    this.ctx.beginPath();
                    this.ctx.arc(element.x + element.width / 2, element.y + element.height / 2, circleR - element.strokeWidth / 2, 0, Math.PI * 2);
                    this.ctx.lineWidth = element.strokeWidth;
                    this.ctx.stroke();
                    break;
                case 'line':
                    this.ctx.beginPath();
                    this.ctx.moveTo(element.x, element.y + element.height / 2);
                    this.ctx.lineTo(element.x + element.width, element.y + element.height / 2);
                    this.ctx.lineWidth = element.strokeWidth;
                    this.ctx.stroke();
                    break;
                case 'image':
                    if (element.imageData) {
                        const img = new Image();
                        img.src = element.imageData;
                        this.ctx.drawImage(img, element.x, element.y, element.width, element.height);
                    }
                    break;
            }
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
        this.zoom = Math.max(0.5, Math.min(2, level));
        document.getElementById('zoomLevel').textContent = Math.round(this.zoom * 100) + '%';

        const display = document.getElementById('watchyDisplay');
        display.style.transform = `scale(${this.zoom})`;
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

        // Then convert to 1-bit
        const threshold = parseInt(document.getElementById('threshold').value);
        const ditherMethod = document.getElementById('ditherMethod').value;
        const invert = document.getElementById('invertColors').checked;

        // Get image data from design canvas
        const imageData = this.ctx.getImageData(0, 0, this.WIDTH, this.HEIGHT);
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

    generateCode() {
        if (!this.processedImageData) {
            this.updateExportPreview();
        }

        let name = document.getElementById('exportName').value || 'watchface';
        name = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (/^[0-9]/.test(name)) name = '_' + name;

        const bytes = this.convertToBytes(this.processedImageData);

        // Generate Arduino code
        let arduinoCode = `// '${name}', 200x200px\n`;
        arduinoCode += `// Generated by Watchy Watchface Designer\n\n`;
        arduinoCode += `const unsigned char ${name}[] PROGMEM = {\n`;

        for (let i = 0; i < bytes.length; i++) {
            if (i % 16 === 0) arduinoCode += '  ';
            arduinoCode += '0x' + bytes[i].toString(16).padStart(2, '0');
            if (i < bytes.length - 1) arduinoCode += ', ';
            if ((i + 1) % 16 === 0) arduinoCode += '\n';
        }

        arduinoCode += '\n};';
        document.getElementById('arduinoCode').textContent = arduinoCode;

        // Generate raw hex
        let rawCode = '';
        for (let i = 0; i < bytes.length; i++) {
            rawCode += bytes[i].toString(16).padStart(2, '0');
            if ((i + 1) % 25 === 0) rawCode += '\n';
            else if (i < bytes.length - 1) rawCode += ' ';
        }
        document.getElementById('rawCode').textContent = rawCode;

        this.showModal();
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
        document.getElementById('arduinoCodePanel').classList.toggle('active', tab === 'arduino');
        document.getElementById('rawCodePanel').classList.toggle('active', tab === 'raw');
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
        const code = document.getElementById('arduinoCode').textContent;
        const name = document.getElementById('exportName').value || 'watchface';
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.h`;
        a.click();
        URL.revokeObjectURL(url);
    }

    saveProject() {
        const project = {
            version: 1,
            name: document.getElementById('exportName').value || 'watchface',
            elements: this.elements,
            settings: {
                threshold: document.getElementById('threshold').value,
                ditherMethod: document.getElementById('ditherMethod').value,
                invertColors: document.getElementById('invertColors').checked
            }
        };

        const json = JSON.stringify(project, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name}.watchface`;
        a.click();
        URL.revokeObjectURL(url);
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
