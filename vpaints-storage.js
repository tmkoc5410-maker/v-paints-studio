/**
 * ============================================================================
 * V Paints — LocalStorage FileSystem & Canvas Studio Engine
 * Bridges Emscripten FS / IDBFS <-> window.localStorage for persistent storage,
 * canvas switching, canvas background customization, and file management.
 * ============================================================================
 */
(function () {
    'use strict';

    const LS_INDEX_KEY = 'vpaints_fs_index_v1';
    const LS_DATA_PREFIX = 'vpaints_fs_data_v1:';
    const LS_SETTINGS_KEY = 'vpaints_settings_v1';
    const ROOT_DIR = '/infinipaint';
    const APP_DIR = '/infinipaint/ErrorAtLine0/infinipaint';
    const SAVES_DIR = APP_DIR + '/saves';
    const TRASH_DIR = APP_DIR + '/trash';
    const CONFIG_PATH = APP_DIR + '/config.json';

    // 1. Preserve WebGL2 drawing buffer so PNG Snapshot works anytime
    try {
        const origGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, attrs) {
            if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') {
                attrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
            }
            return origGetContext.call(this, type, attrs);
        };
    } catch (e) {
        console.warn('[V Paints] Could not wrap getContext:', e);
    }

    // 2. Binary <-> Base64 & Hex <-> Float RGB utilities
    function uint8ToBase64(bytes) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const sub = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, sub);
        }
        return btoa(binary);
    }

    function base64ToUint8(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    function hexToRgbFloats(hex) {
        const clean = String(hex || '#12131a').replace('#', '').trim();
        if (clean.length !== 6) return [0.071, 0.075, 0.102];
        const r = parseInt(clean.substring(0, 2), 16) / 255;
        const g = parseInt(clean.substring(2, 4), 16) / 255;
        const b = parseInt(clean.substring(4, 6), 16) / 255;
        return [
            Number(r.toFixed(4)),
            Number(g.toFixed(4)),
            Number(b.toFixed(4))
        ];
    }

    // 3. Settings management in LocalStorage
    function getDefaultScale() {
        const w = Math.min(window.innerWidth || 400, window.innerHeight || 800);
        if (w <= 480) return 1.15;
        if (w <= 820) return 1.1;
        return 1.0;
    }

    function loadSettings() {
        try {
            const raw = localStorage.getItem(LS_SETTINGS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    compactUI: parsed.compactUI !== undefined
                        ? !!parsed.compactUI
                        : (parsed.mobileUI !== undefined ? !!parsed.mobileUI : true),
                    guiScale: Number(parsed.guiScale) || getDefaultScale(),
                    canvasBgHex: parsed.canvasBgHex || '#12131a',
                    autoSync: parsed.autoSync !== undefined ? !!parsed.autoSync : true
                };
            }
        } catch (e) {
            console.warn('[V Paints Storage] Error reading settings:', e);
        }
        const defaults = {
            compactUI: true,
            guiScale: getDefaultScale(),
            canvasBgHex: '#12131a',
            autoSync: true
        };
        saveSettings(defaults);
        return defaults;
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
            console.warn('[V Paints Storage] Error saving settings:', e);
        }
    }

    // 4. LocalStorage Index Helpers
    function readLSIndex() {
        try {
            const raw = localStorage.getItem(LS_INDEX_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function writeLSIndex(indexObj) {
        try {
            localStorage.setItem(LS_INDEX_KEY, JSON.stringify(indexObj));
        } catch (e) {
            console.warn('[V Paints Storage] Index write warning:', e);
        }
    }

    // 5. Main Storage & Canvas Controller
    const VPaintsStorage = {
        FS: null,
        IDBFS: null,
        Module: null,
        isReady: false,
        syncTimer: null,
        lastSyncTime: 0,
        settings: loadSettings(),

        attachFS(FS, IDBFS, Module) {
            if (!FS || this.FS === FS) return;
            this.FS = FS;
            this.IDBFS = IDBFS;
            this.Module = Module;
            window.__VPAINTS_FS__ = FS;
            window.__VPAINTS_IDBFS__ = IDBFS;

            const self = this;

            const origSyncfs = FS.syncfs ? FS.syncfs.bind(FS) : null;
            FS.syncfs = function (populate, callback) {
                if (typeof populate === 'function') {
                    callback = populate;
                    populate = false;
                }
                if (populate) {
                    if (window.VPaintsBoot) {
                        window.VPaintsBoot.setProgress(78, 'Mounting LocalStorage Workspace...');
                    }
                    let finished = false;
                    const completePopulate = function () {
                        if (finished) return;
                        finished = true;
                        try {
                            self.ensureDirectories();
                            self.restoreFromLocalStorageToFS();
                            self.applyStudioConfigToFS();
                            self.syncFSToLocalStorage(false);
                            self.isReady = true;
                            self.installFSHooks();
                        } catch (err) {
                            console.error('[V Paints Storage] Startup restore error:', err);
                        }
                        if (window.VPaintsBoot) {
                            window.VPaintsBoot.setProgress(95, 'Launching V Paints Studio...');
                        }
                        if (typeof callback === 'function') {
                            callback(null);
                        }
                        setTimeout(() => {
                            if (window.VPaintsBoot) window.VPaintsBoot.finish();
                        }, 380);
                    };

                    const safetyTimer = setTimeout(completePopulate, 1100);
                    if (origSyncfs) {
                        try {
                            origSyncfs(true, function () {
                                clearTimeout(safetyTimer);
                                completePopulate();
                            });
                        } catch (e) {
                            clearTimeout(safetyTimer);
                            completePopulate();
                        }
                    } else {
                        clearTimeout(safetyTimer);
                        completePopulate();
                    }
                } else {
                    try {
                        self.syncFSToLocalStorage(false);
                    } catch (e) {
                        console.warn('[V Paints Storage] Sync error:', e);
                    }
                    if (origSyncfs) {
                        try {
                            origSyncfs(false, function (err) {
                                if (typeof callback === 'function') callback(err);
                            });
                            return;
                        } catch (e) {}
                    }
                    if (typeof callback === 'function') callback(null);
                }
            };
        },

        ensureDirectories() {
            const FS = this.FS;
            if (!FS) return;
            const dirs = [ROOT_DIR, '/infinipaint/ErrorAtLine0', APP_DIR, SAVES_DIR, TRASH_DIR];
            for (const d of dirs) {
                try {
                    if (FS.mkdirTree) {
                        FS.mkdirTree(d);
                    } else {
                        FS.mkdir(d);
                    }
                } catch (e) {}
            }
        },

        restoreFromLocalStorageToFS() {
            const FS = this.FS;
            if (!FS) return 0;
            const index = readLSIndex();
            const paths = Object.keys(index);
            let restoredCount = 0;

            for (const fullPath of paths) {
                try {
                    const b64 = localStorage.getItem(LS_DATA_PREFIX + fullPath);
                    if (b64 === null) continue;
                    const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'));
                    if (parentDir && FS.mkdirTree) {
                        try { FS.mkdirTree(parentDir); } catch (e) {}
                    }
                    const bytes = base64ToUint8(b64);
                    FS.writeFile(fullPath, bytes);
                    restoredCount++;
                } catch (e) {
                    console.warn('[V Paints Storage] Failed to restore file:', fullPath, e);
                }
            }
            return restoredCount;
        },

        applyStudioConfigToFS() {
            const FS = this.FS;
            if (!FS) return;
            this.ensureDirectories();
            let cfg = {};
            try {
                const existing = FS.readFile(CONFIG_PATH, { encoding: 'utf8' });
                if (existing) {
                    cfg = JSON.parse(existing);
                }
            } catch (e) {
                cfg = {};
            }

            const isCompact = !!this.settings.compactUI;
            const scale = Number(this.settings.guiScale) || getDefaultScale();
            const bgRgb = hexToRgbFloats(this.settings.canvasBgHex || '#12131a');

            if (!cfg.version) {
                cfg.version = '0.6.0';
            }
            if (!cfg.settings || typeof cfg.settings !== 'object') {
                cfg.settings = {};
            }
            cfg.settings.guiScale = scale;
            cfg.settings.viewWebVersionWelcome = false;
            cfg.settings.defaultCanvasBackgroundColor = bgRgb;
            cfg.settings.debug = Object.assign({}, cfg.settings.debug || {}, {
                mobileUI: isCompact
            });

            cfg.mobileUI = isCompact;
            cfg.debug = Object.assign({}, cfg.debug || {}, {
                mobileUI: isCompact
            });
            cfg.viewWebVersionWelcome = false;
            cfg.guiScale = scale;
            cfg.defaultCanvasBackgroundColor = bgRgb;

            try {
                const jsonText = JSON.stringify(cfg, null, 2);
                const encoded = new TextEncoder().encode(jsonText);
                FS.writeFile(CONFIG_PATH, encoded);
            } catch (e) {
                console.error('[V Paints Storage] Failed to write studio config.json:', e);
            }
        },

        walkFS(dirPath, outList) {
            const FS = this.FS;
            if (!FS) return outList;
            outList = outList || [];
            let entries = [];
            try {
                entries = FS.readdir(dirPath);
            } catch (e) {
                return outList;
            }
            for (const name of entries) {
                if (name === '.' || name === '..') continue;
                const fullPath = dirPath === '/' ? '/' + name : dirPath + '/' + name;
                try {
                    const st = FS.stat(fullPath);
                    if (FS.isDir(st.mode)) {
                        this.walkFS(fullPath, outList);
                    } else if (FS.isFile(st.mode)) {
                        outList.push({
                            path: fullPath,
                            size: st.size || 0,
                            mtime: st.mtime ? new Date(st.mtime).getTime() : Date.now()
                        });
                    }
                } catch (e) {}
            }
            return outList;
        },

        syncFSToLocalStorage(showToast) {
            const FS = this.FS;
            if (!FS) return { ok: false, count: 0 };

            try {
                this.applyStudioConfigToFS();
            } catch (e) {}

            this.notifySyncVisual(true);
            const files = this.walkFS(ROOT_DIR, []);
            const oldIndex = readLSIndex();
            const newIndex = {};
            let savedCount = 0;
            let quotaWarning = false;

            for (const f of files) {
                try {
                    const bytes = FS.readFile(f.path, { encoding: 'binary' });
                    const b64 = uint8ToBase64(bytes);
                    try {
                        localStorage.setItem(LS_DATA_PREFIX + f.path, b64);
                        newIndex[f.path] = {
                            size: bytes.length,
                            mtime: f.mtime || Date.now()
                        };
                        savedCount++;
                    } catch (quotaErr) {
                        quotaWarning = true;
                        if (oldIndex[f.path]) {
                            newIndex[f.path] = oldIndex[f.path];
                        }
                    }
                } catch (e) {
                    console.warn('[V Paints Storage] Error reading FS file:', f.path, e);
                }
            }

            for (const oldPath of Object.keys(oldIndex)) {
                if (!newIndex[oldPath]) {
                    try {
                        localStorage.removeItem(LS_DATA_PREFIX + oldPath);
                    } catch (e) {}
                }
            }

            writeLSIndex(newIndex);
            this.lastSyncTime = Date.now();
            setTimeout(() => this.notifySyncVisual(false), 320);

            window.dispatchEvent(new CustomEvent('vpaints:synced', {
                detail: { count: savedCount, quotaWarning }
            }));

            if (showToast && window.VPaintsUI) {
                if (quotaWarning) {
                    window.VPaintsUI.toast('LocalStorage limit reached. Export backup from Studio Hub.');
                } else {
                    window.VPaintsUI.toast(`Saved ${savedCount} file(s) to LocalStorage`);
                }
            }
            return { ok: !quotaWarning, count: savedCount };
        },

        scheduleSync() {
            if (!this.settings.autoSync) return;
            if (this.syncTimer) clearTimeout(this.syncTimer);
            this.syncTimer = setTimeout(() => {
                this.syncFSToLocalStorage(false);
            }, 300);
        },

        installFSHooks() {
            const FS = this.FS;
            if (!FS || FS.__vpaintsHooked) return;
            FS.__vpaintsHooked = true;
            const self = this;

            if (FS.close) {
                const origClose = FS.close.bind(FS);
                FS.close = function (stream) {
                    const res = origClose(stream);
                    try {
                        if (stream && stream.path && stream.path.indexOf(ROOT_DIR) === 0) {
                            self.scheduleSync();
                        }
                    } catch (e) {}
                    return res;
                };
            }

            ['writeFile', 'rename', 'unlink', 'rmdir'].forEach((fnName) => {
                if (typeof FS[fnName] === 'function') {
                    const origFn = FS[fnName].bind(FS);
                    FS[fnName] = function (...args) {
                        const res = origFn(...args);
                        try {
                            const p = String(args[0] || '');
                            if (p.indexOf(ROOT_DIR) === 0) {
                                self.scheduleSync();
                            }
                        } catch (e) {}
                        return res;
                    };
                }
            });

            window.addEventListener('beforeunload', () => self.syncFSToLocalStorage(false));
            window.addEventListener('pagehide', () => self.syncFSToLocalStorage(false));
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    self.syncFSToLocalStorage(false);
                }
            });

            setInterval(() => {
                if (!self.isReady) return;
                const files = self.walkFS(ROOT_DIR, []);
                const idx = readLSIndex();
                if (files.length !== Object.keys(idx).length) {
                    self.syncFSToLocalStorage(false);
                    return;
                }
                for (const f of files) {
                    const rec = idx[f.path];
                    if (!rec || rec.size !== f.size) {
                        self.syncFSToLocalStorage(false);
                        break;
                    }
                }
            }, 5000);
        },

        notifySyncVisual(active) {
            const dot = document.getElementById('vpaints-sync-dot');
            if (dot) {
                dot.classList.toggle('syncing', !!active);
            }
        },

        getStorageStats() {
            let totalBytes = 0;
            let vpaintsBytes = 0;
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    const v = localStorage.getItem(k) || '';
                    const sz = (k.length + v.length) * 2;
                    totalBytes += sz;
                    if (k.indexOf('vpaints_') === 0) {
                        vpaintsBytes += sz;
                    }
                }
            } catch (e) {}

            const index = readLSIndex();
            const allPaths = Object.keys(index);
            const canvasCount = allPaths.filter(p => p.endsWith('.infpnt') && p.indexOf('/trash/') === -1).length;
            const quotaBytes = 5 * 1024 * 1024;
            const pct = Math.min(100, Math.round((totalBytes / quotaBytes) * 100));

            return {
                totalBytes,
                vpaintsBytes,
                fileCount: allPaths.length,
                canvasCount,
                pct
            };
        },

        listSavedFiles() {
            if (this.isReady) {
                this.syncFSToLocalStorage(false);
            }
            const index = readLSIndex();
            let fileSelectMeta = {};
            try {
                if (this.FS) {
                    const rawMeta = this.FS.readFile(APP_DIR + '/fileSelectInfo.json', { encoding: 'utf8' });
                    fileSelectMeta = JSON.parse(rawMeta);
                }
            } catch (e) {}

            const items = Object.keys(index).map((path) => {
                const info = index[path];
                const fileName = path.substring(path.lastIndexOf('/') + 1);
                const isSave = path.indexOf('/saves/') !== -1;
                const isTrash = path.indexOf('/trash/') !== -1;
                const isCanvas = fileName.endsWith('.infpnt');
                let displayTitle = fileName;

                if (isCanvas) {
                    const idStem = fileName.replace(/\.infpnt$/, '');
                    if (fileSelectMeta && fileSelectMeta[idStem] && fileSelectMeta[idStem].name) {
                        displayTitle = `${fileSelectMeta[idStem].name} (${fileName})`;
                    } else if (fileSelectMeta && fileSelectMeta.files && fileSelectMeta.files[idStem] && fileSelectMeta.files[idStem].name) {
                        displayTitle = `${fileSelectMeta.files[idStem].name} (${fileName})`;
                    }
                }

                return {
                    path,
                    fileName,
                    displayTitle,
                    size: info.size || 0,
                    mtime: info.mtime || 0,
                    isSave,
                    isTrash,
                    isCanvas
                };
            });

            items.sort((a, b) => {
                if (a.isCanvas !== b.isCanvas) return a.isCanvas ? -1 : 1;
                return b.mtime - a.mtime;
            });
            return items;
        },

        /**
         * Sends a file (either an .infpnt canvas or an image) directly into the running SDL3/Emscripten engine
         * using SDL3's drop handler so it opens immediately on screen.
         */
        openBytesInEngine(bytes, fileName, mimeType) {
            try {
                const fileObj = new File([bytes], fileName, { type: mimeType || 'application/octet-stream' });
                const sdl3 = (this.Module && this.Module.SDL3) || (window.Module && window.Module.SDL3);
                if (sdl3 && typeof sdl3.eventHandlerDropDrop === 'function') {
                    const fakeDropEvent = {
                        preventDefault() {},
                        dataTransfer: {
                            types: ['Files'],
                            files: {
                                length: 1,
                                item(idx) {
                                    return idx === 0 ? fileObj : null;
                                }
                            }
                        }
                    };
                    sdl3.eventHandlerDropDrop(fakeDropEvent);
                    return true;
                }
            } catch (e) {
                console.warn('[V Paints Storage] Direct engine open fallback:', e);
            }
            return false;
        },

        openSavedCanvas(fullPath) {
            try {
                let bytes = null;
                if (this.FS) {
                    try {
                        bytes = this.FS.readFile(fullPath, { encoding: 'binary' });
                    } catch (e) {}
                }
                if (!bytes) {
                    const b64 = localStorage.getItem(LS_DATA_PREFIX + fullPath);
                    if (b64) bytes = base64ToUint8(b64);
                }
                if (!bytes) {
                    if (window.VPaintsUI) window.VPaintsUI.toast('Canvas file not found');
                    return false;
                }
                const fileName = fullPath.substring(fullPath.lastIndexOf('/') + 1) || 'canvas.infpnt';
                const opened = this.openBytesInEngine(bytes, fileName, 'application/octet-stream');
                if (opened && window.VPaintsUI) {
                    window.VPaintsUI.toast(`Opened ${fileName.replace(/\.infpnt$/, '')}`);
                }
                return opened;
            } catch (e) {
                console.error('[V Paints Storage] Could not open canvas:', e);
                return false;
            }
        },

        downloadFile(fullPath) {
            try {
                let bytes = null;
                if (this.FS) {
                    try {
                        bytes = this.FS.readFile(fullPath, { encoding: 'binary' });
                    } catch (e) {}
                }
                if (!bytes) {
                    const b64 = localStorage.getItem(LS_DATA_PREFIX + fullPath);
                    if (b64) bytes = base64ToUint8(b64);
                }
                if (!bytes) {
                    if (window.VPaintsUI) window.VPaintsUI.toast('File not found in storage');
                    return;
                }
                const fileName = fullPath.substring(fullPath.lastIndexOf('/') + 1) || 'canvas.infpnt';
                const blob = new Blob([bytes], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1500);
                if (window.VPaintsUI) window.VPaintsUI.toast(`Downloaded ${fileName}`);
            } catch (e) {
                console.error('[V Paints Storage] Download failed:', e);
            }
        },

        deleteFile(fullPath) {
            try {
                if (this.FS) {
                    try { this.FS.unlink(fullPath); } catch (e) {}
                }
                localStorage.removeItem(LS_DATA_PREFIX + fullPath);
                const idx = readLSIndex();
                delete idx[fullPath];
                writeLSIndex(idx);
                if (window.VPaintsUI) window.VPaintsUI.toast('Removed file from LocalStorage');
            } catch (e) {
                console.error('[V Paints Storage] Delete error:', e);
            }
        },

        async importInfpntFiles(fileList) {
            if (!fileList || !fileList.length) return;
            this.ensureDirectories();
            let imported = 0;
            let lastBytes = null;
            let lastName = '';

            for (const file of Array.from(fileList)) {
                const buf = await file.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                if (!safeName.endsWith('.infpnt')) {
                    safeName += '.infpnt';
                }
                const targetPath = SAVES_DIR + '/' + safeName;
                if (this.FS) {
                    this.FS.writeFile(targetPath, bytes);
                }
                const b64 = uint8ToBase64(bytes);
                localStorage.setItem(LS_DATA_PREFIX + targetPath, b64);
                const idx = readLSIndex();
                idx[targetPath] = { size: bytes.length, mtime: Date.now() };
                writeLSIndex(idx);
                lastBytes = bytes;
                lastName = safeName;
                imported++;
            }

            if (this.FS && this.FS.syncfs) {
                this.FS.syncfs(false, () => {});
            }
            if (lastBytes) {
                this.openBytesInEngine(lastBytes, lastName, 'application/octet-stream');
            }
            if (window.VPaintsUI) {
                window.VPaintsUI.toast(`Imported ${imported} canvas file(s)`);
            }
            return imported;
        },

        async insertImagesToCanvas(fileList) {
            if (!fileList || !fileList.length) return;
            let count = 0;
            for (const file of Array.from(fileList)) {
                const buf = await file.arrayBuffer();
                const bytes = new Uint8Array(buf);
                this.openBytesInEngine(bytes, file.name, file.type || 'image/png');
                if (window.VPaintsMedia && window.VPaintsMedia.saveAsset) {
                    try { window.VPaintsMedia.saveAsset(file, file.name); } catch (e) {}
                }
                count++;
            }
            if (window.VPaintsUI && count > 0) {
                window.VPaintsUI.toast(`Added ${count} image(s) to canvas`);
            }
        },

        exportFullBackup() {
            this.syncFSToLocalStorage(false);
            const index = readLSIndex();
            const filesData = {};
            for (const p of Object.keys(index)) {
                filesData[p] = localStorage.getItem(LS_DATA_PREFIX + p);
            }
            const payload = {
                app: 'V Paints Studio Backup',
                version: 1,
                exportedAt: new Date().toISOString(),
                settings: this.settings,
                index,
                files: filesData
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vpaints-studio-backup-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            if (window.VPaintsUI) window.VPaintsUI.toast('Exported full LocalStorage backup');
        },

        async importFullBackup(jsonFile) {
            if (!jsonFile) return;
            try {
                const text = await jsonFile.text();
                const data = JSON.parse(text);
                if (!data || !data.index || !data.files) {
                    throw new Error('Invalid V Paints backup file');
                }
                if (data.settings) {
                    this.settings = Object.assign(this.settings, data.settings);
                    saveSettings(this.settings);
                }
                for (const p of Object.keys(data.files)) {
                    const b64 = data.files[p];
                    if (typeof b64 === 'string') {
                        localStorage.setItem(LS_DATA_PREFIX + p, b64);
                        if (this.FS) {
                            const parentDir = p.substring(0, p.lastIndexOf('/'));
                            if (parentDir && this.FS.mkdirTree) {
                                try { this.FS.mkdirTree(parentDir); } catch (e) {}
                            }
                            this.FS.writeFile(p, base64ToUint8(b64));
                        }
                    }
                }
                writeLSIndex(data.index);
                if (window.VPaintsUI) {
                    window.VPaintsUI.toast('Restored backup. Reloading studio...');
                }
                setTimeout(() => window.location.reload(), 650);
            } catch (e) {
                alert('Could not restore backup file: ' + e.message);
            }
        },

        updateSettings(partial, reloadAfter) {
            this.settings = Object.assign({}, this.settings, partial);
            saveSettings(this.settings);
            this.applyStudioConfigToFS();
            this.syncFSToLocalStorage(false);
            if (reloadAfter) {
                if (window.VPaintsUI) {
                    window.VPaintsUI.toast('Applying canvas studio settings...');
                }
                setTimeout(() => window.location.reload(), 400);
            }
        }
    };

    window.VPaintsStorage = VPaintsStorage;
})();
