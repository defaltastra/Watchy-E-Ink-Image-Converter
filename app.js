/**
 * Watchy E-Ink Image Converter
 * Converts images to 200x200 1-bit format compatible with Watchy e-paper display
 */

class WatchyConverter {
    constructor() {
        this.originalCanvas = document.getElementById('originalCanvas');
        this.convertedCanvas = document.getElementById('convertedCanvas');
        this.originalCtx = this.originalCanvas.getContext('2d');
        this.convertedCtx = this.convertedCanvas.getContext('2d');

        this.WIDTH = 200;
        this.HEIGHT = 200;

        this.currentImage = null;
        this.processedImageData = null;

        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');

        // Click to upload
        uploadZone.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));

        // Drag and drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.handleFileSelect(file);
            }
        });

        // Settings changes
        document.getElementById('threshold').addEventListener('input', (e) => {
            document.getElementById('thresholdValue').textContent = e.target.value;
            this.processImage();
        });

        document.getElementById('ditherMethod').addEventListener('change', () => this.processImage());
        document.getElementById('invertColors').addEventListener('change', () => this.processImage());
        document.getElementById('imageName').addEventListener('input', () => this.generateCode());

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Copy buttons
        document.getElementById('copyArduino').addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('arduinoCode').textContent, 'copyArduino');
        });

        document.getElementById('copyRaw').addEventListener('click', () => {
            this.copyToClipboard(document.getElementById('rawCode').textContent, 'copyRaw');
        });

        // Download buttons
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadHeaderFile());
        document.getElementById('downloadPngBtn').addEventListener('click', () => this.downloadPng());

        // Code to Preview functionality
        document.getElementById('parseCodeBtn').addEventListener('click', () => this.parseCode());
        document.getElementById('clearCodeBtn').addEventListener('click', () => this.clearCodeInput());
        document.getElementById('downloadParsedPngBtn').addEventListener('click', () => this.downloadParsedPng());
    }

    handleFileSelect(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                this.displayOriginal(img);
                this.processImage();
                this.showSections();

                // Set default image name from filename
                const name = file.name.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '_');
                document.getElementById('imageName').value = name;
                this.generateCode();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    displayOriginal(img) {
        // Scale original for preview
        const scale = Math.min(200 / img.width, 200 / img.height);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        this.originalCanvas.width = w;
        this.originalCanvas.height = h;
        this.originalCtx.drawImage(img, 0, 0, w, h);

        document.getElementById('originalInfo').textContent = `${img.width} × ${img.height}px`;
    }

    processImage() {
        if (!this.currentImage) return;

        const threshold = parseInt(document.getElementById('threshold').value);
        const ditherMethod = document.getElementById('ditherMethod').value;
        const invert = document.getElementById('invertColors').checked;

        // Create off-screen canvas for processing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.WIDTH;
        tempCanvas.height = this.HEIGHT;
        const tempCtx = tempCanvas.getContext('2d');

        // Calculate crop/resize to fit 200x200 while maintaining aspect ratio
        const img = this.currentImage;
        const scale = Math.max(this.WIDTH / img.width, this.HEIGHT / img.height);
        const scaledW = img.width * scale;
        const scaledH = img.height * scale;
        const offsetX = (this.WIDTH - scaledW) / 2;
        const offsetY = (this.HEIGHT - scaledH) / 2;

        // Draw scaled and centered image
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
        tempCtx.drawImage(img, offsetX, offsetY, scaledW, scaledH);

        // Get image data
        let imageData = tempCtx.getImageData(0, 0, this.WIDTH, this.HEIGHT);
        let pixels = imageData.data;

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

        // Apply inversion if needed
        if (invert) {
            for (let i = 0; i < binaryData.length; i++) {
                binaryData[i] = binaryData[i] === 0 ? 255 : 0;
            }
        }

        this.processedImageData = binaryData;

        // Render to canvas
        for (let i = 0; i < binaryData.length; i++) {
            const val = binaryData[i];
            pixels[i * 4] = val;
            pixels[i * 4 + 1] = val;
            pixels[i * 4 + 2] = val;
            pixels[i * 4 + 3] = 255;
        }

        // Draw to converted canvas - set background to e-ink paper color (Gruvbox light)
        this.convertedCtx.fillStyle = '#ebdbb2';
        this.convertedCtx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
        this.convertedCtx.putImageData(imageData, 0, 0);

        this.generateCode();
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

        // 4x4 Bayer matrix
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
        if (!this.processedImageData) return;

        let name = document.getElementById('imageName').value || 'image';
        name = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (/^[0-9]/.test(name)) name = '_' + name;

        const bytes = this.convertToBytes(this.processedImageData);

        // Generate Arduino code
        let arduinoCode = `// '${name}', 200x200px\n`;
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
    }

    convertToBytes(binaryData) {
        // Convert 200x200 1-bit image to byte array
        // Each byte contains 8 horizontal pixels
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

    showSections() {
        document.getElementById('settingsSection').classList.add('visible');
        document.getElementById('previewSection').classList.add('visible');
        document.getElementById('outputSection').classList.add('visible');
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${tab}Panel`);
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
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy
                `;
            }, 2000);
        });
    }

    downloadHeaderFile() {
        const code = document.getElementById('arduinoCode').textContent;
        const name = document.getElementById('imageName').value || 'image';
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.h`;
        a.click();
        URL.revokeObjectURL(url);
    }

    downloadPng() {
        const name = document.getElementById('imageName').value || 'image';
        const url = this.convertedCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}_200x200.png`;
        a.click();
    }

    // ===== Code to Preview Methods =====

    parseCode() {
        const codeInput = document.getElementById('codeInput');
        const errorDiv = document.getElementById('parseError');
        const previewSection = document.getElementById('codePreviewSection');
        const code = codeInput.value.trim();

        // Clear previous errors
        errorDiv.classList.remove('visible');
        errorDiv.textContent = '';

        if (!code) {
            this.showParseError('Please paste some Arduino bitmap code first.');
            return;
        }

        try {
            // Extract image name from code
            const nameMatch = code.match(/(?:const\s+)?unsigned\s+char\s+(\w+)\s*\[\s*\]/);
            const imageName = nameMatch ? nameMatch[1] : 'parsed_image';

            // Extract hex bytes from code
            const hexMatches = code.match(/0x[0-9a-fA-F]{2}/g);

            if (!hexMatches || hexMatches.length === 0) {
                this.showParseError('No valid hex data found. Make sure your code contains 0xNN format bytes.');
                return;
            }

            // Convert hex strings to bytes
            const bytes = hexMatches.map(hex => parseInt(hex, 16));

            // Expected size for 200x200 1-bit image: 200 * 200 / 8 = 5000 bytes
            const expectedBytes = 5000;

            if (bytes.length < expectedBytes) {
                this.showParseError(`Not enough data: found ${bytes.length} bytes, expected ${expectedBytes} bytes for a 200x200 image.`);
                return;
            }

            // Use only the first 5000 bytes if more are provided
            const imageBytes = bytes.slice(0, expectedBytes);

            // Render the image
            this.renderBytesToCanvas(imageBytes, imageName);

        } catch (error) {
            this.showParseError(`Error parsing code: ${error.message}`);
        }
    }

    renderBytesToCanvas(bytes, imageName) {
        const canvas = document.getElementById('codePreviewCanvas');
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(this.WIDTH, this.HEIGHT);
        const pixels = imageData.data;

        // Convert bytes to pixels
        // Each byte contains 8 horizontal pixels
        let pixelIndex = 0;
        for (let i = 0; i < bytes.length; i++) {
            const byte = bytes[i];
            for (let bit = 7; bit >= 0; bit--) {
                const isWhite = (byte >> bit) & 1;
                const val = isWhite ? 255 : 0;
                pixels[pixelIndex * 4] = val;
                pixels[pixelIndex * 4 + 1] = val;
                pixels[pixelIndex * 4 + 2] = val;
                pixels[pixelIndex * 4 + 3] = 255;
                pixelIndex++;
            }
        }

        // Draw to canvas
        ctx.putImageData(imageData, 0, 0);

        // Update UI
        document.getElementById('parsedImageName').textContent = imageName;
        document.getElementById('codePreviewSection').classList.add('visible');

        // Store for download
        this.parsedImageName = imageName;

        // Scroll to preview
        document.getElementById('codePreviewSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    showParseError(message) {
        const errorDiv = document.getElementById('parseError');
        errorDiv.textContent = message;
        errorDiv.classList.add('visible');
    }

    clearCodeInput() {
        document.getElementById('codeInput').value = '';
        document.getElementById('parseError').classList.remove('visible');
        document.getElementById('codePreviewSection').classList.remove('visible');
    }

    downloadParsedPng() {
        const canvas = document.getElementById('codePreviewCanvas');
        const name = this.parsedImageName || 'parsed_image';
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}_200x200.png`;
        a.click();
    }
}

// Initialize the converter when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WatchyConverter();
});
