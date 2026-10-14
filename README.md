# V Paints — Infinite Canvas Studio

> **An ultra-fluid, zero-cloud infinite canvas painting, sketch, thumbnail & poster creation suite.**  
> Powered by an embedded WebGL2 engine, high-speed procedural brushes, aspect-ratio framing, and a 100% offline browser IndexedDB media pipeline.

---

## ✨ Features

- **Infinite WebGL2 Canvas**: Smooth panning, zooming, and drawing powered by WebGL2 and SDL3 assembly.
- **Aspect-Ratio Framing & Composition**:
  - `16:9` YouTube Thumbnail
  - `9:16` Shorts & Reels
  - `1:1` Square Post
  - `4:5` Portrait Poster
  - `21:9` Ultra-wide Banner
  - Built-in 3×3 Rule of Thirds alignment grid.
- **Thumbnail & Poster Typography Maker**:
  - High-impact slanted headline badges
  - Customizable stroke outlines, 3D drop shadows, and pill backgrounds.
- **Image Enhancer & Cutout FX**:
  - Filter adjustments: Brightness, Contrast, Saturation, Hue, Blur
  - Presets: *Thumbnail Pop*, *Cinematic*, *Flip H/V*
  - Pop-out outline glow effect for YouTube stickers & avatars.
- **Floating Uploads & Assets Library**:
  - Persistent **100% local offline storage** using browser **IndexedDB** (`vpaints_media_v1`).
  - Zero cloud dependencies — privacy-first and runs without network connectivity.
  - One-click drag/insert directly onto the active canvas.
- **Sticker & FX Pack**:
  - Curved Red Arrow pointer
  - Bold Yellow target arrow
  - Fiery "VS" Battle Badge
  - Warning Shock Triangle
  - Question (`?`) and Exclamation (`!`) pop-art tags
  - Flame and 16:9 Bottom Vignette Dimmer overlay.

---

## 🚀 Live Demo / Usage

1. Open `index.html` directly in any modern browser (Chrome, Edge, Firefox, Safari).
2. No backend server required — all assets, canvas state, and uploads run client-side.
3. Deployable straight to **GitHub Pages** with zero build step!

---

## 📁 Repository Structure

```
├── index.html            # Main application entry point & embedded WebGL2 engine
├── vpaints-style.css     # Dark glassmorphism UI & responsive styles
├── vpaints-creator.js    # Framing overlay, image enhancer, typography maker & IndexedDB library
├── vpaints-storage.js    # Canvas file manager, sync hooks & engine file drop bridge
├── vpaints-mobile.js     # Boot sequence, radial menu, touch gestures & modal manager
├── manifest.json         # PWA configuration
└── README.md             # Project documentation
```

---

## 📄 License
GPL-3.0 (Powered by InfiniPaint Engine).
