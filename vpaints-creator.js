/**
 * ============================================================================
 * V Paints — Thumbnail, Poster & Image Studio Engine (vpaints-creator.js)
 * Aspect Ratio Framing (16:9 YouTube, 9:16 Shorts, 1:1, 4:5 Poster),
 * Image Filter & Outline Glow Enhancer, Bold Thumbnail Typography Generator,
 * and Aspect Ratio Precision Snapshot Export. Zero emojis, pure SVG UI.
 * ============================================================================
 */
(function () {
    'use strict';

    // ------------------------------------------------------------------------
    // 1. ASPECT RATIO FRAMING OVERLAY
    // ------------------------------------------------------------------------
    const FRAMING_PRESETS = {
        free: { name: 'Full Canvas', ratio: null },
        yt: { name: 'YouTube (16:9)', ratio: 16 / 9, w: 1280, h: 720 },
        shorts: { name: 'Shorts / Reel (9:16)', ratio: 9 / 16, w: 1080, h: 1920 },
        square: { name: 'Square Post (1:1)', ratio: 1, w: 1080, h: 1080 },
        poster: { name: 'Portrait Poster (4:5)', ratio: 4 / 5, w: 1080, h: 1350 },
        banner: { name: 'Banner / Cover (21:9)', ratio: 21 / 9, w: 2560, h: 1080 }
    };

    let currentPresetKey = 'free';
    let showRuleOfThirds = false;

    function getFramingRect(ratio) {
        if (!ratio) return null;
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const pad = Math.min(screenW, screenH) * 0.05;
        const maxW = screenW - pad * 2;
        const maxH = screenH - pad * 2;

        let frameW = maxW;
        let frameH = frameW / ratio;

        if (frameH > maxH) {
            frameH = maxH;
            frameW = frameH * ratio;
        }

        const left = (screenW - frameW) / 2;
        const top = (screenH - frameH) / 2;

        return { left, top, width: frameW, height: frameH };
    }

    function renderFramingOverlay() {
        const overlay = document.getElementById('vp-framing-overlay');
        if (!overlay) return;

        const preset = FRAMING_PRESETS[currentPresetKey];
        if (!preset || !preset.ratio) {
            overlay.style.display = 'none';
            return;
        }

        overlay.style.display = 'block';
        const rect = getFramingRect(preset.ratio);
        if (!rect) return;

        const box = document.getElementById('vp-framing-box');
        if (box) {
            box.style.left = rect.left + 'px';
            box.style.top = rect.top + 'px';
            box.style.width = rect.width + 'px';
            box.style.height = rect.height + 'px';
        }

        const tag = document.getElementById('vp-framing-tag');
        if (tag) {
            tag.textContent = `${preset.name} • ${preset.w}×${preset.h}`;
        }

        const grid = document.getElementById('vp-framing-grid');
        if (grid) {
            grid.style.display = showRuleOfThirds ? 'grid' : 'none';
        }
    }

    window.addEventListener('resize', () => {
        if (currentPresetKey !== 'free') {
            renderFramingOverlay();
        }
    });

    // ------------------------------------------------------------------------
    // 2. IMAGE FILTER, ADJUSTMENT & OUTLINE GLOW ENGINE
    // ------------------------------------------------------------------------
    let loadedImage = null;
    let editCanvas = null;
    let editCtx = null;

    const DEFAULT_IMAGE_FILTERS = {
        brightness: 100, // %
        contrast: 105,   // %
        saturation: 125, // % (default vivid for thumbnails)
        blur: 0,         // px
        hue: 0,          // deg
        flipH: false,
        flipV: false,
        glowColor: '#ffffff',
        glowSize: 0      // 0 = off, 1-20 = outline
    };

    let activeFilters = Object.assign({}, DEFAULT_IMAGE_FILTERS);

    function initImageEditorCanvas() {
        if (!editCanvas) {
            editCanvas = document.getElementById('vp-img-editor-canvas');
            if (editCanvas) {
                editCtx = editCanvas.getContext('2d');
            }
        }
    }

    function applyImageFiltersToPreview() {
        if (!loadedImage || !editCanvas || !editCtx) return;

        const origW = loadedImage.naturalWidth || loadedImage.width;
        const origH = loadedImage.naturalHeight || loadedImage.height;

        editCanvas.width = origW;
        editCanvas.height = origH;
        editCtx.clearRect(0, 0, origW, origH);

        editCtx.save();

        // 1. Transform flips
        editCtx.translate(origW / 2, origH / 2);
        editCtx.scale(activeFilters.flipH ? -1 : 1, activeFilters.flipV ? -1 : 1);
        editCtx.translate(-origW / 2, -origH / 2);

        // 2. CSS Canvas filter string
        const filterStr = `brightness(${activeFilters.brightness}%) contrast(${activeFilters.contrast}%) saturate(${activeFilters.saturation}%) hue-rotate(${activeFilters.hue}deg) blur(${activeFilters.blur}px)`;
        editCtx.filter = filterStr;

        // 3. Optional Outline / Glow Cutout Effect (Popular on YouTube thumbnails)
        if (activeFilters.glowSize > 0) {
            editCtx.shadowColor = activeFilters.glowColor;
            editCtx.shadowBlur = activeFilters.glowSize * 2.2;
            editCtx.shadowOffsetX = 0;
            editCtx.shadowOffsetY = 0;
        }

        editCtx.drawImage(loadedImage, 0, 0, origW, origH);
        editCtx.restore();
    }

    function loadFileIntoImageEditor(file) {
        if (!file) return;
        if (window.VPaintsMedia && window.VPaintsMedia.saveAsset) {
            try { window.VPaintsMedia.saveAsset(file, file.name); } catch (e) {}
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                loadedImage = img;
                activeFilters = Object.assign({}, DEFAULT_IMAGE_FILTERS);
                syncImageFilterUIValues();
                initImageEditorCanvas();
                applyImageFiltersToPreview();
                openImageEditorModal();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function syncImageFilterUIValues() {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
            const label = document.getElementById(id + '-val');
            if (label) label.textContent = val;
        };

        setVal('vp-filter-bright', activeFilters.brightness);
        setVal('vp-filter-contrast', activeFilters.contrast);
        setVal('vp-filter-sat', activeFilters.saturation);
        setVal('vp-filter-hue', activeFilters.hue);
        setVal('vp-filter-blur', activeFilters.blur);
        setVal('vp-filter-glow', activeFilters.glowSize);

        const glowPicker = document.getElementById('vp-filter-glow-color');
        if (glowPicker) glowPicker.value = activeFilters.glowColor;
    }

    function openImageEditorModal() {
        const modal = document.getElementById('vp-img-editor-modal');
        if (modal) modal.classList.add('open');
    }

    function closeImageEditorModal() {
        const modal = document.getElementById('vp-img-editor-modal');
        if (modal) modal.classList.remove('open');
    }

    async function sendFilteredImageToCanvas() {
        if (!editCanvas || !window.VPaintsStorage) return;
        editCanvas.toBlob(async (blob) => {
            if (!blob) return;
            const buf = await blob.arrayBuffer();
            const bytes = new Uint8Array(buf);
            const fileName = `edited_layer_${Date.now()}.png`;
            window.VPaintsStorage.openBytesInEngine(bytes, fileName, 'image/png');
            if (window.VPaintsMedia && window.VPaintsMedia.saveAsset) {
                try { window.VPaintsMedia.saveAsset(blob, fileName); } catch (e) {}
            }
            closeImageEditorModal();
            if (window.VPaintsUI) {
                window.VPaintsUI.toast('Enhanced image added to canvas!');
            }
        }, 'image/png');
    }

    // ------------------------------------------------------------------------
    // 3. YOUTUBE THUMBNAIL & POSTER TYPOGRAPHY GENERATOR
    // ------------------------------------------------------------------------
    function generateThumbnailTextCanvas(opts) {
        opts = Object.assign({
            text: 'EPIC THUMBNAIL',
            fontFamily: 'Impact, sans-serif',
            fontSize: 88,
            textColor: '#ffeb3b',
            strokeColor: '#000000',
            strokeWidth: 8,
            badgeStyle: 'none', // 'none' | 'pill' | 'box'
            badgeColor: '#e50914',
            shadow: true,
            slant: true
        }, opts || {});

        const lines = String(opts.text || 'TEXT').toUpperCase().split('\n');
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');

        const padX = 40;
        const padY = 32;
        const lineSpacing = opts.fontSize * 1.18;

        ctx.font = `900 ${opts.fontSize}px ${opts.fontFamily}`;

        let maxLineW = 0;
        lines.forEach(l => {
            const w = ctx.measureText(l).width;
            if (w > maxLineW) maxLineW = w;
        });

        const totalW = Math.ceil(maxLineW + padX * 2 + opts.strokeWidth * 2);
        const totalH = Math.ceil(lines.length * lineSpacing + padY * 2);

        c.width = totalW;
        c.height = totalH;

        ctx.save();
        if (opts.slant) {
            ctx.transform(1, 0, -0.07, 1, 0, 0); // Dynamic thumbnail slant
        }

        // Draw Badge Background
        if (opts.badgeStyle !== 'none') {
            ctx.fillStyle = opts.badgeColor;
            if (opts.badgeStyle === 'pill') {
                const r = 18;
                ctx.beginPath();
                ctx.roundRect(10, 10, totalW - 20, totalH - 20, r);
                ctx.fill();
            } else {
                ctx.fillRect(10, 10, totalW - 20, totalH - 20);
            }
        }

        ctx.font = `900 ${opts.fontSize}px ${opts.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const centerX = totalW / 2;

        lines.forEach((lineText, idx) => {
            const centerY = padY + (idx + 0.5) * lineSpacing;

            // Deep Drop Shadow
            if (opts.shadow) {
                ctx.shadowColor = 'rgba(0,0,0,0.85)';
                ctx.shadowBlur = 14;
                ctx.shadowOffsetX = 6;
                ctx.shadowOffsetY = 6;
            }

            // Outer Stroke / Outline
            if (opts.strokeWidth > 0) {
                ctx.strokeStyle = opts.strokeColor;
                ctx.lineWidth = opts.strokeWidth * 2;
                ctx.lineJoin = 'miter';
                ctx.miterLimit = 2;
                ctx.strokeText(lineText, centerX, centerY);
            }

            // Fill Text
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = opts.textColor;
            ctx.fillText(lineText, centerX, centerY);
        });

        ctx.restore();
        return c;
    }

    function openTextMakerModal() {
        const modal = document.getElementById('vp-text-maker-modal');
        if (modal) {
            updateTextMakerPreview();
            modal.classList.add('open');
        }
    }

    function closeTextMakerModal() {
        const modal = document.getElementById('vp-text-maker-modal');
        if (modal) modal.classList.remove('open');
    }

    function updateTextMakerPreview() {
        const input = document.getElementById('vp-tm-text-input');
        const previewWrap = document.getElementById('vp-tm-preview-wrap');
        if (!previewWrap) return;

        const textVal = (input && input.value) ? input.value : 'EPIC TITLE';
        const textColor = document.getElementById('vp-tm-color')?.value || '#fff159';
        const strokeColor = document.getElementById('vp-tm-stroke-color')?.value || '#000000';
        const badgeStyle = document.getElementById('vp-tm-badge-style')?.value || 'none';
        const badgeColor = document.getElementById('vp-tm-badge-color')?.value || '#e50914';

        const canvas = generateThumbnailTextCanvas({
            text: textVal,
            textColor,
            strokeColor,
            badgeStyle,
            badgeColor,
            fontSize: 72,
            strokeWidth: 7
        });

        previewWrap.innerHTML = '';
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        previewWrap.appendChild(canvas);
    }

    async function sendThumbnailTextToCanvas() {
        const input = document.getElementById('vp-tm-text-input');
        const textVal = (input && input.value) ? input.value : 'EPIC TITLE';
        const textColor = document.getElementById('vp-tm-color')?.value || '#fff159';
        const strokeColor = document.getElementById('vp-tm-stroke-color')?.value || '#000000';
        const badgeStyle = document.getElementById('vp-tm-badge-style')?.value || 'none';
        const badgeColor = document.getElementById('vp-tm-badge-color')?.value || '#e50914';

        const canvas = generateThumbnailTextCanvas({
            text: textVal,
            textColor,
            strokeColor,
            badgeStyle,
            badgeColor,
            fontSize: 96,
            strokeWidth: 9
        });

        canvas.toBlob(async (blob) => {
            if (!blob || !window.VPaintsStorage) return;
            const buf = await blob.arrayBuffer();
            const bytes = new Uint8Array(buf);
            const fileName = `title_badge_${Date.now()}.png`;
            window.VPaintsStorage.openBytesInEngine(bytes, fileName, 'image/png');
            if (window.VPaintsMedia && window.VPaintsMedia.saveAsset) {
                try { window.VPaintsMedia.saveAsset(blob, fileName); } catch (e) {}
            }
            closeTextMakerModal();
            if (window.VPaintsUI) {
                window.VPaintsUI.toast('Thumbnail Title added to canvas!');
            }
        }, 'image/png');
    }

    // ------------------------------------------------------------------------
    // 4. PRECISION ASPECT RATIO CANVAS EXPORT (1280x720 YouTube, Posters)
    // ------------------------------------------------------------------------
    function exportFramedCanvasSnapshot(presetKey, format) {
        format = format || 'png';
        const canvas = document.getElementById('canvas');
        if (!canvas) return;

        const preset = FRAMING_PRESETS[presetKey] || FRAMING_PRESETS.yt;
        const rect = preset.ratio ? getFramingRect(preset.ratio) : null;

        const outW = preset.w || canvas.width;
        const outH = preset.h || canvas.height;

        const outCanvas = document.createElement('canvas');
        outCanvas.width = outW;
        outCanvas.height = outH;
        const outCtx = outCanvas.getContext('2d');

        if (rect && preset.ratio) {
            // Source crop corresponding to screen framing coordinates
            const scaleX = canvas.width / window.innerWidth;
            const scaleY = canvas.height / window.innerHeight;

            const srcX = rect.left * scaleX;
            const srcY = rect.top * scaleY;
            const srcW = rect.width * scaleX;
            const srcH = rect.height * scaleY;

            outCtx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
        } else {
            outCtx.drawImage(canvas, 0, 0, outW, outH);
        }

        const mime = format === 'jpeg' ? 'image/jpeg' : (format === 'webp' ? 'image/webp' : 'image/png');
        const ext = format === 'jpeg' ? 'jpg' : format;

        const dataUrl = outCanvas.toDataURL(mime, 0.95);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `vpaints-${presetKey}-export-${outW}x${outH}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        if (window.VPaintsUI) {
            window.VPaintsUI.toast(`Exported ${preset.name} (${outW}×${outH})`);
        }
    }

    // ------------------------------------------------------------------------
    // 5. INITIALIZATION & UI BINDINGS
    // ------------------------------------------------------------------------
    function initCreatorStudio() {
        // Preset Framing Selector Buttons
        const presetBtns = document.querySelectorAll('.vp-frame-pill[data-preset]');
        presetBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-preset');
                if (FRAMING_PRESETS[key]) {
                    currentPresetKey = key;
                    presetBtns.forEach(b => b.classList.toggle('active', b === btn));
                    renderFramingOverlay();
                    if (window.VPaintsUI) {
                        window.VPaintsUI.toast(`Framing: ${FRAMING_PRESETS[key].name}`);
                    }
                }
            });
        });

        // Grid Toggle
        const gridToggle = document.getElementById('vp-btn-toggle-grid');
        if (gridToggle) {
            gridToggle.addEventListener('click', () => {
                showRuleOfThirds = !showRuleOfThirds;
                gridToggle.classList.toggle('active', showRuleOfThirds);
                renderFramingOverlay();
            });
        }

        // Image Editor File Input
        const imgInput = document.getElementById('vp-edit-image-input');
        if (imgInput) {
            imgInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    loadFileIntoImageEditor(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }

        const triggerImgEditorBtn = document.getElementById('vp-btn-open-image-editor');
        if (triggerImgEditorBtn && imgInput) {
            triggerImgEditorBtn.addEventListener('click', () => {
                imgInput.click();
            });
        }

        // Image Filter Sliders
        const bindSlider = (id, propKey) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => {
                activeFilters[propKey] = Number(el.value);
                const valLabel = document.getElementById(id + '-val');
                if (valLabel) valLabel.textContent = el.value;
                applyImageFiltersToPreview();
            });
        };

        bindSlider('vp-filter-bright', 'brightness');
        bindSlider('vp-filter-contrast', 'contrast');
        bindSlider('vp-filter-sat', 'saturation');
        bindSlider('vp-filter-hue', 'hue');
        bindSlider('vp-filter-blur', 'blur');
        bindSlider('vp-filter-glow', 'glowSize');

        const glowColorInput = document.getElementById('vp-filter-glow-color');
        if (glowColorInput) {
            glowColorInput.addEventListener('input', (e) => {
                activeFilters.glowColor = e.target.value;
                applyImageFiltersToPreview();
            });
        }

        // Filter Presets (Vibrant, Pop, Dramatic)
        const filterPresets = document.querySelectorAll('.vp-mini-btn[data-filter-preset]');
        filterPresets.forEach((pBtn) => {
            pBtn.addEventListener('click', () => {
                const p = pBtn.getAttribute('data-filter-preset');
                if (p === 'pop') {
                    activeFilters.brightness = 108;
                    activeFilters.contrast = 120;
                    activeFilters.saturation = 160;
                    activeFilters.glowSize = 6;
                    activeFilters.glowColor = '#ffffff';
                } else if (p === 'cinematic') {
                    activeFilters.brightness = 95;
                    activeFilters.contrast = 130;
                    activeFilters.saturation = 110;
                    activeFilters.glowSize = 0;
                } else if (p === 'reset') {
                    activeFilters = Object.assign({}, DEFAULT_IMAGE_FILTERS);
                }
                syncImageFilterUIValues();
                applyImageFiltersToPreview();
            });
        });

        // Flip Horizontal / Vertical
        const flipHBtn = document.getElementById('vp-btn-fliph');
        if (flipHBtn) {
            flipHBtn.addEventListener('click', () => {
                activeFilters.flipH = !activeFilters.flipH;
                applyImageFiltersToPreview();
            });
        }

        const flipVBtn = document.getElementById('vp-btn-flipv');
        if (flipVBtn) {
            flipVBtn.addEventListener('click', () => {
                activeFilters.flipV = !activeFilters.flipV;
                applyImageFiltersToPreview();
            });
        }

        // Send Filtered Image
        const sendImgBtn = document.getElementById('vp-btn-img-send');
        if (sendImgBtn) {
            sendImgBtn.addEventListener('click', sendFilteredImageToCanvas);
        }

        const closeImgBtn = document.getElementById('vp-btn-img-close');
        if (closeImgBtn) {
            closeImgBtn.addEventListener('click', closeImageEditorModal);
        }

        // Text Maker Modal Triggers & Controls
        const triggerTextMakerBtn = document.getElementById('vp-btn-open-text-maker');
        if (triggerTextMakerBtn) {
            triggerTextMakerBtn.addEventListener('click', () => {
                if (window.VPaintsUI) window.VPaintsUI.toggleDrawer(false);
                openTextMakerModal();
            });
        }

        const closeTmBtn = document.getElementById('vp-btn-tm-close');
        if (closeTmBtn) {
            closeTmBtn.addEventListener('click', closeTextMakerModal);
        }

        const sendTmBtn = document.getElementById('vp-btn-tm-send');
        if (sendTmBtn) {
            sendTmBtn.addEventListener('click', sendThumbnailTextToCanvas);
        }

        ['vp-tm-text-input', 'vp-tm-color', 'vp-tm-stroke-color', 'vp-tm-badge-style', 'vp-tm-badge-color'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', updateTextMakerPreview);
                el.addEventListener('change', updateTextMakerPreview);
            }
        });

        // Export Modal & Preset Export Buttons
        const exportYtBtn = document.getElementById('vp-btn-export-yt');
        if (exportYtBtn) {
            exportYtBtn.addEventListener('click', () => {
                exportFramedCanvasSnapshot('yt', 'png');
            });
        }

        const exportPosterBtn = document.getElementById('vp-btn-export-poster');
        if (exportPosterBtn) {
            exportPosterBtn.addEventListener('click', () => {
                exportFramedCanvasSnapshot('poster', 'png');
            });
        }

        const exportShortsBtn = document.getElementById('vp-btn-export-shorts');
        if (exportShortsBtn) {
            exportShortsBtn.addEventListener('click', () => {
                exportFramedCanvasSnapshot('shorts', 'png');
            });
        }

        const exportSquareBtn = document.getElementById('vp-btn-export-square');
        if (exportSquareBtn) {
            exportSquareBtn.addEventListener('click', () => {
                exportFramedCanvasSnapshot('square', 'png');
            });
        }

        // ====================================================================
        // 5. MEDIA & UPLOADS SIDE PANEL CONTROLLER
        // ====================================================================
        const floatBtn = document.getElementById('vp-uploads-float-btn');
        if (floatBtn) {
            floatBtn.addEventListener('click', () => openUploadsPanel('uploads'));
        }

        const closeBtn = document.getElementById('vp-uploads-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeUploadsPanel);
        }

        const backdrop = document.getElementById('vp-uploads-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', closeUploadsPanel);
        }

        const drawerUploadsBtn = document.getElementById('vp-btn-drawer-uploads');
        if (drawerUploadsBtn) {
            drawerUploadsBtn.addEventListener('click', () => {
                if (window.VPaintsUI) window.VPaintsUI.toggleDrawer(false);
                openUploadsPanel('uploads');
            });
        }

        const openUploadsBtn = document.getElementById('vp-btn-open-uploads');
        if (openUploadsBtn) {
            openUploadsBtn.addEventListener('click', () => {
                if (window.VPaintsUI) window.VPaintsUI.toggleDrawer(false);
                openUploadsPanel('uploads');
            });
        }

        // Tab Switching
        document.querySelectorAll('.vp-panel-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                const tabKey = tab.getAttribute('data-tab');
                switchUploadsTab(tabKey);
            });
        });

        // Panel Upload Trigger & File Input
        const panelUploadBtn = document.getElementById('vp-btn-panel-upload');
        const panelFileInput = document.getElementById('vp-panel-file-input');
        if (panelUploadBtn && panelFileInput) {
            panelUploadBtn.addEventListener('click', () => panelFileInput.click());
            panelFileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;
                let saved = 0;
                for (const f of files) {
                    await VPaintsMediaDB.saveAsset(f, f.name);
                    saved++;
                }
                panelFileInput.value = '';
                if (window.VPaintsUI) {
                    window.VPaintsUI.toast(`Saved ${saved} image(s) to local browser storage`);
                }
            });
        }

        // Clear All Media Button
        const clearMediaBtn = document.getElementById('vp-btn-clear-media');
        if (clearMediaBtn) {
            clearMediaBtn.addEventListener('click', async () => {
                if (confirm('Clear all uploaded media from your local browser storage?')) {
                    await VPaintsMediaDB.clearAll();
                    if (window.VPaintsUI) {
                        window.VPaintsUI.toast('Local media library cleared');
                    }
                }
            });
        }

        // Initial pre-load of media & stickers
        renderMediaUploads();
        renderStickers();
    }

    // ------------------------------------------------------------------------
    // 5. LOCAL MEDIA DATABASE & ASSET STORE (IndexedDB)
    // ------------------------------------------------------------------------
    const DB_NAME = 'vpaints_media_v1';
    const DB_VERSION = 1;
    const DB_STORE = 'media_assets';

    let mediaDBPromise = null;

    function getMediaDB() {
        if (!mediaDBPromise) {
            mediaDBPromise = new Promise((resolve) => {
                if (!window.indexedDB) {
                    console.warn('[V Paints Media] IndexedDB not available in this browser');
                    return resolve(null);
                }
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(DB_STORE)) {
                        const store = db.createObjectStore(DB_STORE, { keyPath: 'id' });
                        store.createIndex('createdAt', 'createdAt', { unique: false });
                    }
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = (e) => {
                    console.warn('[V Paints Media] IndexedDB open error:', e);
                    resolve(null);
                };
            });
        }
        return mediaDBPromise;
    }

    const VPaintsMediaDB = {
        async saveAsset(fileOrBlob, fileName) {
            try {
                const db = await getMediaDB();
                if (!db) return null;

                const name = fileName || (fileOrBlob && fileOrBlob.name) || `media_${Date.now()}.png`;
                const mimeType = (fileOrBlob && fileOrBlob.type) || 'image/png';
                const size = (fileOrBlob && fileOrBlob.size) || 0;
                const arrayBuffer = await fileOrBlob.arrayBuffer();

                // Create Data URL for instant thumbnail rendering in UI
                const dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => resolve('');
                    reader.readAsDataURL(fileOrBlob);
                });

                const id = 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
                const asset = {
                    id,
                    name,
                    mimeType,
                    size,
                    dataUrl,
                    arrayBuffer,
                    createdAt: Date.now()
                };

                await new Promise((resolve, reject) => {
                    const tx = db.transaction(DB_STORE, 'readwrite');
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = (e) => reject(e);
                    tx.objectStore(DB_STORE).put(asset);
                });

                window.dispatchEvent(new CustomEvent('vpaints:media-updated'));
                renderMediaUploads();
                return asset;
            } catch (err) {
                console.error('[V Paints Media] Save asset error:', err);
                return null;
            }
        },

        async getAllAssets() {
            try {
                const db = await getMediaDB();
                if (!db) return [];
                return new Promise((resolve) => {
                    const tx = db.transaction(DB_STORE, 'readonly');
                    const store = tx.objectStore(DB_STORE);
                    const req = store.getAll();
                    req.onsuccess = () => {
                        const list = (req.result || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                        resolve(list);
                    };
                    req.onerror = () => resolve([]);
                });
            } catch (err) {
                console.warn('[V Paints Media] Get assets error:', err);
                return [];
            }
        },

        async deleteAsset(id) {
            try {
                const db = await getMediaDB();
                if (!db) return false;
                await new Promise((resolve, reject) => {
                    const tx = db.transaction(DB_STORE, 'readwrite');
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = (e) => reject(e);
                    tx.objectStore(DB_STORE).delete(id);
                });
                window.dispatchEvent(new CustomEvent('vpaints:media-updated'));
                renderMediaUploads();
                return true;
            } catch (err) {
                console.error('[V Paints Media] Delete asset error:', err);
                return false;
            }
        },

        async clearAll() {
            try {
                const db = await getMediaDB();
                if (!db) return false;
                await new Promise((resolve, reject) => {
                    const tx = db.transaction(DB_STORE, 'readwrite');
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = (e) => reject(e);
                    tx.objectStore(DB_STORE).clear();
                });
                window.dispatchEvent(new CustomEvent('vpaints:media-updated'));
                renderMediaUploads();
                return true;
            } catch (err) {
                console.error('[V Paints Media] Clear error:', err);
                return false;
            }
        }
    };

    // ------------------------------------------------------------------------
    // 6. THUMBNAIL STICKERS & CLICKBAIT ASSET GENERATOR
    // ------------------------------------------------------------------------
    const STICKERS_CATALOG = [
        {
            id: 'curved_red_arrow',
            title: 'Curved Arrow',
            badge: 'Pointer',
            w: 480,
            h: 480,
            svg: `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="f-arr" x="-20%" y="-20%" width="150%" height="150%">
                        <feDropShadow dx="3" dy="7" stdDeviation="5" flood-color="#000000" flood-opacity="0.8"/>
                    </filter>
                    <linearGradient id="g-red" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ff2a2a"/>
                        <stop offset="100%" stop-color="#cc0000"/>
                    </linearGradient>
                </defs>
                <path d="M 40 45 C 50 145 130 160 160 160 L 150 135 L 210 170 L 165 215 L 160 185 C 110 185 25 160 15 45 Z" fill="url(#g-red)" stroke="#ffffff" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" filter="url(#f-arr)"/>
            </svg>`
        },
        {
            id: 'bold_yellow_arrow',
            title: 'Yellow Arrow',
            badge: 'Target',
            w: 480,
            h: 480,
            svg: `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="f-yarr" x="-20%" y="-20%" width="150%" height="150%">
                        <feDropShadow dx="3" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.8"/>
                    </filter>
                    <linearGradient id="g-yel" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#fff500"/>
                        <stop offset="100%" stop-color="#f59e0b"/>
                    </linearGradient>
                </defs>
                <path d="M 30 100 L 130 100 L 130 50 L 215 120 L 130 190 L 130 140 L 30 140 Z" fill="url(#g-yel)" stroke="#0b0d17" stroke-width="8" stroke-linejoin="round" filter="url(#f-yarr)"/>
            </svg>`
        },
        {
            id: 'vs_battle_badge',
            title: 'VS Badge',
            badge: 'Battle',
            w: 480,
            h: 480,
            svg: `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="f-vs" x="-20%" y="-20%" width="150%" height="150%">
                        <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.9"/>
                    </filter>
                    <linearGradient id="g-vs" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#ff0844"/>
                        <stop offset="50%" stop-color="#ff4b2b"/>
                        <stop offset="100%" stop-color="#f59e0b"/>
                    </linearGradient>
                </defs>
                <circle cx="120" cy="120" r="95" fill="#111526" stroke="#ffffff" stroke-width="8" filter="url(#f-vs)"/>
                <circle cx="120" cy="120" r="80" fill="url(#g-vs)"/>
                <path d="M 120 40 L 105 120 L 135 120 Z" fill="#ffffff" opacity="0.3"/>
                <text x="120" y="145" text-anchor="middle" font-family="'Impact', 'Arial Black', sans-serif" font-weight="900" font-size="78" fill="#ffffff" stroke="#0b0d17" stroke-width="6" stroke-linejoin="round">VS</text>
            </svg>`
        },
        {
            id: 'shock_warning',
            title: 'Warning Alert',
            badge: 'Shock',
            w: 480,
            h: 480,
            svg: `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="f-warn" x="-20%" y="-20%" width="150%" height="150%">
                        <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.8"/>
                    </filter>
                </defs>
                <path d="M 120 25 L 225 200 L 15 200 Z" fill="#fbbf24" stroke="#ffffff" stroke-width="8" stroke-linejoin="round" filter="url(#f-warn)"/>
                <path d="M 120 48 L 205 188 L 35 188 Z" fill="#f59e0b"/>
                <rect x="110" y="85" width="20" height="55" rx="10" fill="#111425"/>
                <circle cx="120" cy="165" r="11" fill="#111425"/>
            </svg>`
        },
        {
            id: 'question_mark',
            title: 'Question Tag',
            badge: 'Comic',
            w: 480,
            h: 480,
            svg: `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="f-qm" x="-20%" y="-20%" width="150%" height="150%">
                        <feDropShadow dx="4" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.85"/>
                    </filter>
                    <linearGradient id="g-qm" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#ff0055"/>
                        <stop offset="100%" stop-color="#ff5500"/>
                    </linearGradient>
                </defs>
                <text x="120" y="185" text-anchor="middle" font-family="'Impact', 'Arial Black', sans-serif" font-size="190" font-weight="900" fill="url(#g-qm)" stroke="#ffffff" stroke-width="12" stroke-linejoin="round" filter="url(#f-qm)">?</text>
            </svg>`
        },
        {
            id: 'exclamation_mark',
            title: 'Exclamation Tag',
            badge: 'Urgent',
            w: 480,
            h: 480,
            svg: `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="f-ex" x="-20%" y="-20%" width="150%" height="150%">
                        <feDropShadow dx="4" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.85"/>
                    </filter>
                    <linearGradient id="g-ex" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#00f2fe"/>
                        <stop offset="100%" stop-color="#4facfe"/>
                    </linearGradient>
                </defs>
                <text x="120" y="185" text-anchor="middle" font-family="'Impact', 'Arial Black', sans-serif" font-size="190" font-weight="900" fill="url(#g-ex)" stroke="#ffffff" stroke-width="12" stroke-linejoin="round" filter="url(#f-ex)">!</text>
            </svg>`
        },
        {
            id: 'fire_flame',
            title: 'Fire Flame',
            badge: 'Hot',
            w: 480,
            h: 480,
            svg: `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="f-fire" x="-20%" y="-20%" width="150%" height="150%">
                        <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.8"/>
                    </filter>
                    <linearGradient id="g-fo" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#e11d48"/>
                        <stop offset="60%" stop-color="#f97316"/>
                        <stop offset="100%" stop-color="#facc15"/>
                    </linearGradient>
                    <linearGradient id="g-fi" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#f97316"/>
                        <stop offset="100%" stop-color="#fef08a"/>
                    </linearGradient>
                </defs>
                <path d="M 120 20 C 135 65 175 90 190 135 C 205 180 175 220 120 220 C 65 220 35 180 50 135 C 65 95 100 80 95 50 C 105 40 115 30 120 20 Z" fill="url(#g-fo)" stroke="#ffffff" stroke-width="5" stroke-linejoin="round" filter="url(#f-fire)"/>
                <path d="M 120 100 C 135 130 155 150 150 180 C 145 205 125 210 120 210 C 115 210 95 205 90 180 C 85 150 105 130 120 100 Z" fill="url(#g-fi)"/>
            </svg>`
        },
        {
            id: 'bottom_vignette_dimmer',
            title: 'Bottom Vignette',
            badge: 'Dimmer 16:9',
            w: 1280,
            h: 720,
            svg: `<svg viewBox="0 0 1280 720" width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="g-dim" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
                        <stop offset="40%" stop-color="#000000" stop-opacity="0.1"/>
                        <stop offset="75%" stop-color="#000000" stop-opacity="0.8"/>
                        <stop offset="100%" stop-color="#000000" stop-opacity="0.95"/>
                    </linearGradient>
                </defs>
                <rect width="1280" height="720" fill="url(#g-dim)"/>
            </svg>`
        }
    ];

    function svgStringToPngBytes(svgStr, width = 500, height = 500) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = width;
                c.height = height;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(url);
                c.toBlob(async (b) => {
                    if (!b) return reject(new Error('Canvas blob failed'));
                    const buf = await b.arrayBuffer();
                    resolve(new Uint8Array(buf));
                }, 'image/png');
            };
            img.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(e);
            };
            img.src = url;
        });
    }

    async function dropStickerToCanvas(sticker) {
        try {
            const bytes = await svgStringToPngBytes(sticker.svg, sticker.w || 500, sticker.h || 500);
            if (window.VPaintsStorage && window.VPaintsStorage.openBytesInEngine) {
                const fileName = `${sticker.id}_${Date.now()}.png`;
                window.VPaintsStorage.openBytesInEngine(bytes, fileName, 'image/png');
                if (window.VPaintsUI) {
                    window.VPaintsUI.toast(`Added "${sticker.title}" to canvas!`);
                }
            }
        } catch (e) {
            console.error('[V Paints Stickers] Drop error:', e);
            if (window.VPaintsUI) window.VPaintsUI.toast('Could not drop sticker');
        }
    }

    async function renderMediaUploads() {
        const grid = document.getElementById('vp-media-items-grid');
        if (!grid) return;

        const assets = await VPaintsMediaDB.getAllAssets();
        if (!assets || !assets.length) {
            grid.innerHTML = `
                <div class="vp-media-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p>No Uploaded Media Yet</p>
                    <span>Upload photos, cutouts, or logos. Stored safely in your browser offline.</span>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        assets.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'vp-media-card';
            card.title = `Click to add "${item.name}" to canvas`;

            const img = document.createElement('img');
            img.src = item.dataUrl;
            img.alt = item.name;
            img.loading = 'lazy';
            card.appendChild(img);

            const hover = document.createElement('div');
            hover.className = 'vp-media-card-hover';
            hover.innerHTML = `
                <span class="vp-media-card-name">${escapeHtml(item.name)}</span>
                <span class="vp-media-card-action">+ Add to Canvas</span>
            `;
            card.appendChild(hover);

            const delBtn = document.createElement('button');
            delBtn.className = 'vp-media-card-del';
            delBtn.title = 'Delete from local storage';
            delBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                VPaintsMediaDB.deleteAsset(item.id);
            });
            card.appendChild(delBtn);

            card.addEventListener('click', async () => {
                let bytes = null;
                if (item.arrayBuffer) {
                    bytes = new Uint8Array(item.arrayBuffer);
                } else if (item.dataUrl) {
                    const resp = await fetch(item.dataUrl);
                    const buf = await resp.arrayBuffer();
                    bytes = new Uint8Array(buf);
                }
                if (bytes && window.VPaintsStorage && window.VPaintsStorage.openBytesInEngine) {
                    window.VPaintsStorage.openBytesInEngine(bytes, item.name, item.mimeType || 'image/png');
                    if (window.VPaintsUI) {
                        window.VPaintsUI.toast(`Added "${item.name}" to canvas`);
                    }
                }
            });

            grid.appendChild(card);
        });
    }

    function renderStickers() {
        const grid = document.getElementById('vp-stickers-grid');
        if (!grid || grid.__rendered) return;
        grid.__rendered = true;
        grid.innerHTML = '';

        STICKERS_CATALOG.forEach((stk) => {
            const card = document.createElement('div');
            card.className = 'vp-sticker-card';
            card.title = `Click to drop "${stk.title}" on canvas`;

            const prev = document.createElement('div');
            prev.className = 'vp-sticker-preview';
            prev.innerHTML = stk.svg;
            card.appendChild(prev);

            const footer = document.createElement('div');
            footer.style.display = 'flex';
            footer.style.flexDirection = 'column';
            footer.style.alignItems = 'center';
            footer.style.gap = '4px';
            footer.style.width = '100%';

            const title = document.createElement('span');
            title.className = 'vp-sticker-title';
            title.textContent = stk.title;
            footer.appendChild(title);

            if (stk.badge) {
                const badge = document.createElement('span');
                badge.className = 'vp-sticker-badge';
                badge.textContent = stk.badge;
                footer.appendChild(badge);
            }

            card.appendChild(footer);

            card.addEventListener('click', () => {
                dropStickerToCanvas(stk);
            });

            grid.appendChild(card);
        });
    }

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, (m) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m]));
    }

    function openUploadsPanel(defaultTab = 'uploads') {
        const panel = document.getElementById('vp-uploads-panel');
        const backdrop = document.getElementById('vp-uploads-backdrop');
        if (panel) panel.classList.add('open');
        if (backdrop) backdrop.classList.add('open');

        if (defaultTab) {
            switchUploadsTab(defaultTab);
        }
        renderMediaUploads();
        renderStickers();
    }

    function closeUploadsPanel() {
        const panel = document.getElementById('vp-uploads-panel');
        const backdrop = document.getElementById('vp-uploads-backdrop');
        if (panel) panel.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
    }

    function switchUploadsTab(tabName) {
        document.querySelectorAll('.vp-panel-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
        });
        const uploadsPane = document.getElementById('vp-pane-uploads');
        const stickersPane = document.getElementById('vp-pane-stickers');
        if (uploadsPane) uploadsPane.classList.toggle('active', tabName === 'uploads');
        if (stickersPane) stickersPane.classList.toggle('active', tabName === 'stickers');
    }

    window.VPaintsCreator = {
        init: initCreatorStudio,
        setFraming: (key) => {
            if (FRAMING_PRESETS[key]) {
                currentPresetKey = key;
                renderFramingOverlay();
            }
        },
        openImageEditor: () => {
            const input = document.getElementById('vp-edit-image-input');
            if (input) input.click();
        },
        openTextMaker: openTextMakerModal,
        exportFramed: exportFramedCanvasSnapshot
    };

    window.VPaintsMedia = {
        db: VPaintsMediaDB,
        saveAsset: (f, n) => VPaintsMediaDB.saveAsset(f, n),
        getAllAssets: () => VPaintsMediaDB.getAllAssets(),
        deleteAsset: (id) => VPaintsMediaDB.deleteAsset(id),
        openPanel: openUploadsPanel,
        closePanel: closeUploadsPanel,
        refresh: renderMediaUploads,
        stickers: STICKERS_CATALOG
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCreatorStudio);
    } else {
        initCreatorStudio();
    }
})();

