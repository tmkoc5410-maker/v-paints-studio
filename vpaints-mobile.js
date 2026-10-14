/**
 * ============================================================================
 * V Paints — Boot Animation, Canvas Switcher, Input Bridge & Studio UI
 * Zero-emoji SVG interface, smooth interpolation, and LocalStorage Hub.
 * ============================================================================
 */
(function () {
    'use strict';

    // ------------------------------------------------------------------------
    // 1. V PAINTS SMOOTH BOOTING ANIMATION CONTROLLER
    // ------------------------------------------------------------------------
    const VPaintsBoot = {
        currentPct: 8,
        targetPct: 14,
        finished: false,
        rafId: null,

        init() {
            const tick = () => {
                if (this.finished) return;
                if (this.currentPct < this.targetPct) {
                    this.currentPct += Math.max(0.28, (this.targetPct - this.currentPct) * 0.12);
                    if (this.targetPct - this.currentPct < 0.35) {
                        this.currentPct = this.targetPct;
                    }
                    this.renderPct(Math.round(this.currentPct));
                }
                this.rafId = requestAnimationFrame(tick);
            };
            this.rafId = requestAnimationFrame(tick);

            setTimeout(() => {
                if (!this.finished) this.finish();
            }, 12000);
        },

        renderPct(pct) {
            const bar = document.getElementById('vpaints-boot-bar');
            const pctEl = document.getElementById('vpaints-boot-pct');
            if (bar) bar.style.width = Math.min(100, Math.max(5, pct)) + '%';
            if (pctEl) pctEl.textContent = Math.min(100, Math.max(1, pct)) + '%';
        },

        setProgress(pct, statusText) {
            if (this.finished) return;
            if (pct > this.targetPct) {
                this.targetPct = Math.min(100, pct);
            }
            if (statusText) {
                const stEl = document.getElementById('vpaints-boot-status');
                if (stEl) stEl.textContent = statusText;
            }
        },

        finish() {
            if (this.finished) return;
            this.finished = true;
            this.targetPct = 100;
            this.renderPct(100);
            const stEl = document.getElementById('vpaints-boot-status');
            if (stEl) stEl.textContent = 'V Paints Studio Ready';
            setTimeout(() => {
                const screen = document.getElementById('vpaints-boot-screen');
                if (screen) {
                    screen.classList.add('vp-boot-hidden');
                }
            }, 340);
        }
    };

    window.VPaintsBoot = VPaintsBoot;

    // ------------------------------------------------------------------------
    // 2. SYNTHETIC KEYBOARD & POINTER DISPATCHERS FOR SDL3 / EMSCRIPTEN
    // ------------------------------------------------------------------------
    function getCanvas() {
        return document.getElementById('canvas');
    }

    function sendKeyCombo(key, code, keyCode, opts) {
        const canvas = getCanvas();
        if (!canvas) return;
        opts = opts || {};
        const eventInit = {
            key: key,
            code: code,
            keyCode: keyCode,
            which: keyCode,
            ctrlKey: !!opts.ctrlKey,
            shiftKey: !!opts.shiftKey,
            altKey: !!opts.altKey,
            metaKey: !!opts.metaKey,
            bubbles: true,
            cancelable: true
        };
        canvas.focus();
        canvas.dispatchEvent(new KeyboardEvent('keydown', eventInit));
        setTimeout(() => {
            canvas.dispatchEvent(new KeyboardEvent('keyup', eventInit));
        }, 32);
    }

    function charToKeyInfo(ch) {
        const upper = ch.toUpperCase();
        const codeNum = upper.charCodeAt(0);
        if (ch >= 'a' && ch <= 'z') {
            return { key: ch, code: 'Key' + upper, keyCode: codeNum, shiftKey: false };
        }
        if (ch >= 'A' && ch <= 'Z') {
            return { key: ch, code: 'Key' + upper, keyCode: codeNum, shiftKey: true };
        }
        if (ch >= '0' && ch <= '9') {
            return { key: ch, code: 'Digit' + ch, keyCode: codeNum, shiftKey: false };
        }
        if (ch === ' ') return { key: ' ', code: 'Space', keyCode: 32, shiftKey: false };
        if (ch === '-') return { key: '-', code: 'Minus', keyCode: 189, shiftKey: false };
        if (ch === '_') return { key: '_', code: 'Minus', keyCode: 189, shiftKey: true };
        if (ch === '.') return { key: '.', code: 'Period', keyCode: 190, shiftKey: false };
        return { key: ch, code: '', keyCode: ch.charCodeAt(0), shiftKey: false };
    }

    async function sendTextToCanvas(text) {
        if (!text) return;
        const canvas = getCanvas();
        if (!canvas) return;
        canvas.focus();

        for (let i = 0; i < text.length; i++) {
            const info = charToKeyInfo(text[i]);
            sendKeyCombo(info.key, info.code, info.keyCode, { shiftKey: info.shiftKey });
            await new Promise(r => setTimeout(r, 16));
        }
    }

    // ------------------------------------------------------------------------
    // 3. RADIAL MENU / SECONDARY CLICK EMULATION & VIEWPORT SYNC
    // ------------------------------------------------------------------------
    let rightClickArmed = false;

    function installViewportAndPointerHooks() {
        document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
        document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });

        const canvas = getCanvas();
        if (!canvas) return;

        canvas.addEventListener('touchstart', function (e) {
            if (!rightClickArmed || e.touches.length !== 1) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            const t = e.touches[0];
            canvas.dispatchEvent(new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX: t.clientX,
                clientY: t.clientY,
                button: 2,
                buttons: 2
            }));
        }, { capture: true, passive: false });

        canvas.addEventListener('touchmove', function (e) {
            if (!rightClickArmed || e.touches.length !== 1) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            const t = e.touches[0];
            canvas.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: t.clientX,
                clientY: t.clientY,
                button: 2,
                buttons: 2
            }));
        }, { capture: true, passive: false });

        canvas.addEventListener('touchend', function (e) {
            if (!rightClickArmed) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            const t = (e.changedTouches && e.changedTouches[0]) || { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 };
            canvas.dispatchEvent(new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true,
                clientX: t.clientX,
                clientY: t.clientY,
                button: 2,
                buttons: 0
            }));
            rightClickArmed = false;
            const rcBtn = document.getElementById('vp-btn-rightclick');
            if (rcBtn) rcBtn.classList.remove('vp-btn-toggled');
            VPaintsUI.toast('Radial tool action completed');
        }, { capture: true, passive: false });

        const syncViewportSize = () => {
            window.dispatchEvent(new Event('resize'));
        };
        window.addEventListener('orientationchange', () => {
            setTimeout(syncViewportSize, 140);
            setTimeout(syncViewportSize, 380);
        });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', syncViewportSize);
        }
    }

    // ------------------------------------------------------------------------
    // 4. V PAINTS STUDIO UI, CANVAS SWITCHER & STORAGE MANAGER
    // ------------------------------------------------------------------------
    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    const VPaintsUI = {
        toastTimer: null,
        lastAutoKbdState: 0,

        init() {
            this.bindElements();
            installViewportAndPointerHooks();
            this.startTextInputWatcher();
            this.updateFooterStats();
            this.refreshCanvasSelector();
            window.addEventListener('vpaints:synced', () => {
                this.updateFooterStats();
                this.refreshCanvasSelector();
            });
        },

        toast(msg) {
            const el = document.getElementById('vpaints-toast');
            if (!el) return;
            el.textContent = msg;
            el.classList.add('show');
            if (this.toastTimer) clearTimeout(this.toastTimer);
            this.toastTimer = setTimeout(() => {
                el.classList.remove('show');
            }, 2300);
        },

        bindElements() {
            const fab = document.getElementById('vpaints-fab');
            const closeDrawerBtn = document.getElementById('vp-drawer-close');

            if (fab) {
                let dragging = false;
                let startY = 0;
                let startTop = 0;

                fab.addEventListener('pointerdown', (e) => {
                    dragging = false;
                    startY = e.clientY;
                    const rect = fab.getBoundingClientRect();
                    startTop = rect.top + rect.height / 2;
                    fab.setPointerCapture(e.pointerId);
                });

                fab.addEventListener('pointermove', (e) => {
                    if (!fab.hasPointerCapture(e.pointerId)) return;
                    if (Math.abs(e.clientY - startY) > 8) {
                        dragging = true;
                        const clampedY = Math.min(window.innerHeight - 40, Math.max(40, startTop + (e.clientY - startY)));
                        fab.style.top = clampedY + 'px';
                    }
                });

                fab.addEventListener('pointerup', (e) => {
                    if (fab.hasPointerCapture(e.pointerId)) {
                        fab.releasePointerCapture(e.pointerId);
                    }
                    if (!dragging) {
                        this.toggleDrawer();
                    }
                    dragging = false;
                });
            }

            if (closeDrawerBtn) {
                closeDrawerBtn.addEventListener('click', () => this.toggleDrawer(false));
            }

            const onBtn = (id, fn) => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('click', fn);
            };

            onBtn('vp-btn-save', () => {
                if (window.VPaintsStorage) {
                    window.VPaintsStorage.syncFSToLocalStorage(true);
                }
            });

            onBtn('vp-btn-storage', () => {
                this.toggleDrawer(false);
                this.openStorageModal();
            });

            onBtn('vp-btn-snapshot', () => {
                this.toggleDrawer(false);
                this.captureCanvasPNG();
            });

            onBtn('vp-btn-undo', () => {
                sendKeyCombo('z', 'KeyZ', 90, { ctrlKey: true });
                this.toast('Undo (Ctrl+Z)');
            });

            onBtn('vp-btn-redo', () => {
                sendKeyCombo('y', 'KeyY', 89, { ctrlKey: true });
                this.toast('Redo (Ctrl+Y)');
            });

            onBtn('vp-btn-keyboard', () => {
                this.toggleDrawer(false);
                this.toggleKeyboardBar(true);
            });

            onBtn('vp-btn-rightclick', () => {
                rightClickArmed = !rightClickArmed;
                const btn = document.getElementById('vp-btn-rightclick');
                if (btn) btn.classList.toggle('vp-btn-toggled', rightClickArmed);
                this.toggleDrawer(false);
                if (rightClickArmed) {
                    this.toast('Tap or drag on canvas for Radial Menu');
                } else {
                    this.toast('Radial Menu mode off');
                }
            });

            onBtn('vp-btn-hideui', () => {
                sendKeyCombo('Tab', 'Tab', 9, {});
                this.toggleDrawer(false);
                this.toast('Toggled Workspace Toolbars');
            });

            onBtn('vp-btn-fullscreen', () => {
                this.toggleFullscreen();
            });

            // Canvas Switcher & New Canvas Controls
            onBtn('vp-btn-new-canvas', () => {
                this.toggleDrawer(false);
                sendKeyCombo('n', 'KeyN', 78, { ctrlKey: true });
                this.toast('New Canvas triggered');
            });

            onBtn('vp-btn-open-canvas', () => {
                const sel = document.getElementById('vp-canvas-select');
                if (!sel || !sel.value) {
                    this.openStorageModal();
                    return;
                }
                if (window.VPaintsStorage) {
                    const ok = window.VPaintsStorage.openSavedCanvas(sel.value);
                    this.toggleDrawer(false);
                    if (!ok) {
                        this.openStorageModal();
                    }
                }
            });

            const addImgInput = document.getElementById('vp-insert-image-input');
            onBtn('vp-btn-add-image', () => {
                if (addImgInput) addImgInput.click();
            });
            if (addImgInput) {
                addImgInput.addEventListener('change', async (e) => {
                    if (e.target.files && e.target.files.length && window.VPaintsStorage) {
                        await window.VPaintsStorage.insertImagesToCanvas(e.target.files);
                        e.target.value = '';
                        this.toggleDrawer(false);
                    }
                });
            }

            // Canvas Background Color Swatches & Custom Picker
            const swatches = document.querySelectorAll('.vp-swatch[data-bg]');
            swatches.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const hex = btn.getAttribute('data-bg');
                    if (hex) {
                        this.applyCanvasBackground(hex);
                    }
                });
            });

            const customColorInput = document.getElementById('vp-custom-bg-color');
            if (customColorInput) {
                customColorInput.addEventListener('change', (e) => {
                    if (e.target.value) {
                        this.applyCanvasBackground(e.target.value);
                    }
                });
            }

            // UI Scale & Workspace Layout Mode Controls
            onBtn('vp-scale-minus', () => this.adjustScale(-0.1));
            onBtn('vp-scale-plus', () => this.adjustScale(0.1));
            onBtn('vp-toggle-uimode', () => {
                if (!window.VPaintsStorage) return;
                const nextMode = !window.VPaintsStorage.settings.compactUI;
                window.VPaintsStorage.updateSettings({ compactUI: nextMode }, true);
            });

            // Text Input Bridge Bar Controls
            const kbdInput = document.getElementById('vpaints-ime-input');
            onBtn('vp-kbd-send', async () => {
                if (kbdInput && kbdInput.value) {
                    await sendTextToCanvas(kbdInput.value);
                    kbdInput.value = '';
                }
                this.toggleKeyboardBar(false);
            });

            onBtn('vp-kbd-bksp', () => {
                sendKeyCombo('Backspace', 'Backspace', 8, {});
            });

            onBtn('vp-kbd-enter', () => {
                sendKeyCombo('Enter', 'Enter', 13, {});
            });

            onBtn('vp-kbd-close', () => {
                this.toggleKeyboardBar(false);
            });

            if (kbdInput) {
                kbdInput.addEventListener('keydown', async (e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (kbdInput.value) {
                            await sendTextToCanvas(kbdInput.value);
                            kbdInput.value = '';
                        }
                        sendKeyCombo('Enter', 'Enter', 13, {});
                    }
                });
            }

            // Storage Modal Controls
            onBtn('vp-modal-close', () => this.closeStorageModal());
            onBtn('vp-modal-sync', () => {
                if (window.VPaintsStorage) {
                    window.VPaintsStorage.syncFSToLocalStorage(true);
                    this.renderStorageModalList();
                }
            });
            onBtn('vp-modal-backup', () => {
                if (window.VPaintsStorage) window.VPaintsStorage.exportFullBackup();
            });

            const importInfpntInput = document.getElementById('vp-import-infpnt-input');
            onBtn('vp-modal-import-infpnt', () => {
                if (importInfpntInput) importInfpntInput.click();
            });
            if (importInfpntInput) {
                importInfpntInput.addEventListener('change', async (e) => {
                    if (e.target.files && e.target.files.length && window.VPaintsStorage) {
                        await window.VPaintsStorage.importInfpntFiles(e.target.files);
                        e.target.value = '';
                        this.renderStorageModalList();
                        this.refreshCanvasSelector();
                    }
                });
            }

            const restoreBackupInput = document.getElementById('vp-restore-backup-input');
            onBtn('vp-modal-restore', () => {
                if (restoreBackupInput) restoreBackupInput.click();
            });
            if (restoreBackupInput) {
                restoreBackupInput.addEventListener('change', async (e) => {
                    if (e.target.files && e.target.files[0] && window.VPaintsStorage) {
                        await window.VPaintsStorage.importFullBackup(e.target.files[0]);
                        e.target.value = '';
                    }
                });
            }

            this.refreshSettingsLabels();
        },

        applyCanvasBackground(hex) {
            if (!window.VPaintsStorage) return;
            window.VPaintsStorage.updateSettings({ canvasBgHex: hex }, true);
        },

        refreshCanvasSelector() {
            const sel = document.getElementById('vp-canvas-select');
            if (!sel || !window.VPaintsStorage) return;
            const allFiles = window.VPaintsStorage.listSavedFiles();
            const canvases = allFiles.filter(f => f.isCanvas && !f.isTrash);
            const prevVal = sel.value;
            sel.innerHTML = '';

            if (!canvases.length) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No saved canvases yet';
                sel.appendChild(opt);
                return;
            }

            canvases.forEach((c, idx) => {
                const opt = document.createElement('option');
                opt.value = c.path;
                opt.textContent = c.displayTitle || `Canvas ${idx + 1}`;
                sel.appendChild(opt);
            });

            if (prevVal && canvases.some(c => c.path === prevVal)) {
                sel.value = prevVal;
            }
        },

        toggleDrawer(forceState) {
            const drawer = document.getElementById('vpaints-drawer');
            const fab = document.getElementById('vpaints-fab');
            if (!drawer) return;
            const isOpen = forceState !== undefined ? forceState : !drawer.classList.contains('open');
            drawer.classList.toggle('open', isOpen);
            if (fab) fab.classList.toggle('vp-fab-active', isOpen);
            if (isOpen) {
                this.refreshSettingsLabels();
                this.updateFooterStats();
                this.refreshCanvasSelector();
            }
        },

        toggleKeyboardBar(show) {
            const bar = document.getElementById('vpaints-kbd-bar');
            const input = document.getElementById('vpaints-ime-input');
            if (!bar) return;
            const visible = show !== undefined ? show : !bar.classList.contains('visible');
            bar.classList.toggle('visible', visible);
            if (visible && input) {
                setTimeout(() => input.focus(), 50);
            } else if (!visible && input) {
                input.blur();
                const canvas = getCanvas();
                if (canvas) canvas.focus();
            }
        },

        startTextInputWatcher() {
            setInterval(() => {
                try {
                    if (typeof Module !== 'undefined' && typeof Module.ccall === 'function' && window.VPaintsStorage && window.VPaintsStorage.isReady) {
                        const active = Module.ccall('is_text_input_happening', 'number', [], []);
                        if (active === 1 && this.lastAutoKbdState === 0) {
                            this.toggleKeyboardBar(true);
                        }
                        this.lastAutoKbdState = active;
                    }
                } catch (e) {}
            }, 420);
        },

        refreshSettingsLabels() {
            if (!window.VPaintsStorage) return;
            const s = window.VPaintsStorage.settings;
            const scaleVal = document.getElementById('vp-scale-val');
            if (scaleVal) scaleVal.textContent = Number(s.guiScale).toFixed(2) + 'x';
            const modeBtn = document.getElementById('vp-toggle-uimode');
            if (modeBtn) {
                modeBtn.textContent = s.compactUI ? 'Compact Studio' : 'Multi-Tab Studio';
            }

            const activeHex = (s.canvasBgHex || '#12131a').toLowerCase();
            document.querySelectorAll('.vp-swatch[data-bg]').forEach((sw) => {
                const bg = (sw.getAttribute('data-bg') || '').toLowerCase();
                sw.classList.toggle('active', bg === activeHex);
            });
            const picker = document.getElementById('vp-custom-bg-color');
            if (picker && /^#[0-9a-f]{6}$/i.test(activeHex)) {
                picker.value = activeHex;
            }
        },

        adjustScale(delta) {
            if (!window.VPaintsStorage) return;
            const cur = Number(window.VPaintsStorage.settings.guiScale) || 1.15;
            const next = Math.min(1.75, Math.max(0.75, Math.round((cur + delta) * 20) / 20));
            window.VPaintsStorage.updateSettings({ guiScale: next }, true);
        },

        updateFooterStats() {
            if (!window.VPaintsStorage) return;
            const stats = window.VPaintsStorage.getStorageStats();
            const el = document.getElementById('vp-drawer-storage-stat');
            if (el) {
                el.textContent = `LocalStorage: ${stats.canvasCount} Canvas(es) • ${formatBytes(stats.vpaintsBytes)}`;
            }
        },

        captureCanvasPNG() {
            const canvas = getCanvas();
            if (!canvas) return;
            try {
                const dataUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = `vpaints-artwork-${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                this.toast('Saved PNG Snapshot');
            } catch (e) {
                console.error('[V Paints] Snapshot error:', e);
                this.toast('Could not capture PNG snapshot');
            }
        },

        toggleFullscreen() {
            if (!document.fullscreenElement) {
                const root = document.documentElement;
                if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
                this.toast('Entered Fullscreen Mode');
            } else {
                if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                this.toast('Exited Fullscreen Mode');
            }
        },

        openStorageModal() {
            const modal = document.getElementById('vpaints-modal-backdrop');
            if (!modal) return;
            this.renderStorageModalList();
            modal.classList.add('open');
        },

        closeStorageModal() {
            const modal = document.getElementById('vpaints-modal-backdrop');
            if (modal) modal.classList.remove('open');
        },

        renderStorageModalList() {
            if (!window.VPaintsStorage) return;
            const stats = window.VPaintsStorage.getStorageStats();
            const usageText = document.getElementById('vp-modal-usage-text');
            const usageBar = document.getElementById('vp-modal-usage-bar');
            const listEl = document.getElementById('vp-modal-file-list');

            if (usageText) {
                usageText.textContent = `${formatBytes(stats.vpaintsBytes)} used in LocalStorage (${stats.fileCount} files, ${stats.canvasCount} saved canvases)`;
            }
            if (usageBar) {
                usageBar.style.width = Math.max(4, stats.pct) + '%';
            }
            if (!listEl) return;

            const files = window.VPaintsStorage.listSavedFiles();
            listEl.innerHTML = '';

            if (!files.length) {
                listEl.innerHTML = '<div style="text-align:center;color:#949ec2;padding:20px 10px;font-size:12px;">No files saved yet. Any canvas you create is automatically stored in LocalStorage.</div>';
                return;
            }

            files.forEach((f) => {
                const row = document.createElement('div');
                row.className = 'vp-file-item';

                const tagText = f.isCanvas ? 'CANVAS' : (f.fileName.endsWith('.json') ? 'CONFIG' : 'PREVIEW');
                const dateStr = f.mtime ? new Date(f.mtime).toLocaleString() : '';

                const info = document.createElement('div');
                info.className = 'vp-file-info';

                const nameLine = document.createElement('div');
                nameLine.className = 'vp-file-name';

                const tagSpan = document.createElement('span');
                tagSpan.className = 'vp-file-tag';
                tagSpan.textContent = tagText;

                const titleSpan = document.createElement('span');
                titleSpan.textContent = f.displayTitle;
                titleSpan.style.overflow = 'hidden';
                titleSpan.style.textOverflow = 'ellipsis';

                nameLine.appendChild(tagSpan);
                nameLine.appendChild(titleSpan);

                const subLine = document.createElement('div');
                subLine.className = 'vp-file-sub';
                subLine.textContent = `${formatBytes(f.size)} • ${f.isTrash ? 'Trash' : 'LocalStorage'}${dateStr ? ' • ' + dateStr : ''}`;

                info.appendChild(nameLine);
                info.appendChild(subLine);

                const actions = document.createElement('div');
                actions.className = 'vp-file-actions';

                if (f.isCanvas && !f.isTrash) {
                    const openBtn = document.createElement('button');
                    openBtn.className = 'vp-mini-btn accent';
                    openBtn.textContent = 'Open';
                    openBtn.addEventListener('click', () => {
                        window.VPaintsStorage.openSavedCanvas(f.path);
                        this.closeStorageModal();
                    });
                    actions.appendChild(openBtn);
                }

                const dlBtn = document.createElement('button');
                dlBtn.className = 'vp-mini-btn';
                dlBtn.textContent = 'Export';
                dlBtn.addEventListener('click', () => {
                    window.VPaintsStorage.downloadFile(f.path);
                });
                actions.appendChild(dlBtn);

                if (f.isCanvas || f.isTrash) {
                    const delBtn = document.createElement('button');
                    delBtn.className = 'vp-mini-btn';
                    delBtn.style.background = 'rgba(255, 42, 133, 0.18)';
                    delBtn.style.borderColor = 'rgba(255, 42, 133, 0.42)';
                    delBtn.textContent = 'Delete';
                    delBtn.addEventListener('click', () => {
                        if (confirm(`Delete ${f.displayTitle} from LocalStorage?`)) {
                            window.VPaintsStorage.deleteFile(f.path);
                            this.renderStorageModalList();
                            this.refreshCanvasSelector();
                        }
                    });
                    actions.appendChild(delBtn);
                }

                row.appendChild(info);
                row.appendChild(actions);
                listEl.appendChild(row);
            });
        }
    };

    window.VPaintsUI = VPaintsUI;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            VPaintsBoot.init();
            VPaintsUI.init();
        });
    } else {
        VPaintsBoot.init();
        VPaintsUI.init();
    }
})();
