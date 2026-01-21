# Watchy E-Ink Image Converter

A web-based tool to convert images into a 200x200 1-bit format compatible with the [Watchy](https://watchy.sqfmi.com/) e-paper display. Features a premium **Gruvbox** dark theme.

![Watchy Converter](screenshot.png)

## Features

- **Image Conversion**:
  - Upload any image format (JPG, PNG, GIF, WebP).
  - Automatically resizes and centers functionality to 200x200px.
  - **Dithering Algorithms**: Floyd-Steinberg (Best), Atkinson, Ordered (Bayer), and None.
  - Adjustable brightness **Threshold**.
  - **Invert Colors** toggle for dark-on-light or light-on-dark styles.

- **Code Generation**:
  - Generates ready-to-use **Arduino C++ code** (`PROGMEM`) for your Watchy project.
  - view **Raw Hex** data.
  - Download as a `.h` header file.
  - Download the converted 1-bit image as a PNG.

- **Preview Tool**:
  - Paste existing Arduino bitmap code to instantly generate a visual preview.
  - Useful for checking what a codebase's images look like without flashing the watch.

## Usage

1. **Open the Tool**: Simply open `index.html` in any modern web browser.
2. **Convert an Image**:
   - Drag & drop an image or click to upload.
   - Adjust the **Threshold** slider to get the best detail.
   - Try different **Dithering** methods (Floyd-Steinberg is recommended for photos).
   - Copy the generates C++ code or download the `.h` file.
3. **Add to Watchy**:
   - Copy the generated array into your Watchy project's `images.h` file.
   - Use it in your code: `display.drawBitmap(0, 0, my_image, 200, 200, GxEPD_WHITE);`

## Tech Stack

- **Core**: HTML5, CSS3, Vanilla JavaScript
- **Styling**: Custom CSS variables, Gruvbox color palette, Glassmorphism effects
- **Processing**: Client-side Canvas API for pixel manipulation

## License

This project is open source and available under the [MIT License](../MIT%20License).
