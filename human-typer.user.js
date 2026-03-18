// ==UserScript==
// @name         Human-Typer (Enhanced v2.0 - Formatting + DOCX) - Google Docs & Slides
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Types text human-like with draggable UI, realistic typos, advanced rhythm, Google Docs formatting, and .docx drag-and-drop support.
// @author       ∫(Ace)³dx (Enhanced by Claude)
// @match        https://docs.google.com/*
// @icon         https://i.imgur.com/z2gxKWZ.png
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @license      MIT
// ==/UserScript==
/* globals GM_addStyle, JSZip */
(function() {
    'use strict';

    // --- Configuration ---
    const DEFAULT_LOWER_BOUND = 60;
    const DEFAULT_UPPER_BOUND = 140;
    const DEFAULT_TYPO_RATE_PERCENT = 5;
    const DEFAULT_ENABLE_TYPOS = true;
    const DEFAULT_USE_ADVANCED_ALGORITHM = true;
    const DEFAULT_ENABLE_FORMATTING = true;
    // Basic Typo Config
    const MAX_TYPO_LENGTH = 3;
    const BASIC_TYPO_CHAR_DELAY_MS = 50;
    const BASIC_TYPO_PRE_BACKSPACE_DELAY_MS = 150;
    const BASIC_BACKSPACE_DELAY_MS = 90;
    // Advanced Algorithm Config
    const ADV_SPACE_MULTIPLIER_MIN = 1.8;
    const ADV_SPACE_MULTIPLIER_MAX = 2.8;
    const ADV_WORD_END_MULTIPLIER_MIN = 1.1;
    const ADV_WORD_END_MULTIPLIER_MAX = 1.5;
    const ADV_PUNCTUATION_MULTIPLIER = 1.3;
    const ADV_RANDOM_PAUSE_CHANCE = 0.02;
    const ADV_RANDOM_PAUSE_MIN_MS = 150;
    const ADV_RANDOM_PAUSE_MAX_MS = 400;
    const ADV_TYPO_RECOGNITION_MIN_MS = 250;
    const ADV_TYPO_RECOGNITION_MAX_MS = 800;
    const ADV_BACKSPACE_DELAY_MS = 100;
    const FORMAT_SHORTCUT_DELAY_MS = 80;
    // Word XML namespace
    const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    // --- State ---
    let cancelTyping = false;
    let typingInProgress = false;
    let lowerBoundValue = DEFAULT_LOWER_BOUND;
    let upperBoundValue = DEFAULT_UPPER_BOUND;
    let enableTypos = DEFAULT_ENABLE_TYPOS;
    let typoRatePercentValue = DEFAULT_TYPO_RATE_PERCENT;
    let useAdvancedAlgorithm = DEFAULT_USE_ADVANCED_ALGORITHM;
    let enableFormatting = DEFAULT_ENABLE_FORMATTING;
    let preloadedSegments = null; // segments parsed from a dropped .docx
    let overlayElement = null;
    let infoPopupElement = null;

    // --- CSS ---
    GM_addStyle(`
        .human-typer-overlay {
            position: fixed; background-color: rgba(255,255,255,0.97); padding: 0;
            border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.25); z-index: 2147483647;
            display: flex; flex-direction: column; width: 390px;
            border: 1px solid #ccc; font-family: sans-serif; font-size: 14px; color: #333;
        }
        .human-typer-header {
            background-color: #f1f1f1; padding: 8px 12px; cursor: move; border-bottom: 1px solid #ccc;
            border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex;
            justify-content: space-between; align-items: center; user-select: none;
        }
        .human-typer-header-title { font-weight: bold; }
        .human-typer-info-icon {
            cursor: pointer; font-style: normal; font-weight: bold; color: #d93025;
            border: 1px solid #d93025; border-radius: 50%; width: 18px; height: 18px;
            display: inline-flex; justify-content: center; align-items: center;
            font-size: 12px; margin-left: 10px; background-color: white; flex-shrink: 0;
        }
        .human-typer-info-icon:hover { background-color: #fce8e6; }
        .human-typer-content { padding: 15px; display: flex; flex-direction: column; gap: 10px; }
        .human-typer-drop-zone {
            border: 2px dashed #ccc; border-radius: 6px; padding: 10px 8px;
            text-align: center; color: #888; font-size: 12px; cursor: pointer;
            transition: border-color 0.2s, background-color 0.2s; line-height: 1.4;
        }
        .human-typer-drop-zone:hover, .human-typer-drop-zone.drag-over {
            border-color: #1a73e8; background-color: #e8f0fe; color: #1a73e8;
        }
        .human-typer-drop-zone.loaded {
            border-color: #34a853; background-color: #e6f4ea; color: #1e7e34; cursor: default;
        }
        .human-typer-drop-zone-clear {
            display: inline-block; margin-left: 8px; color: #d93025; cursor: pointer;
            font-weight: bold; font-size: 14px; vertical-align: middle;
        }
        .human-typer-drop-zone-clear:hover { text-decoration: underline; }
        .human-typer-overlay textarea {
            width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; resize: vertical;
            box-sizing: border-box; min-height: 80px; font-family: monospace; font-size: 12px;
        }
        .human-typer-overlay textarea:disabled {
            background: #f5f5f5; color: #aaa; cursor: not-allowed;
        }
        .human-typer-format-hint {
            font-size: 11px; color: #888; background: #f8f8f8; border: 1px solid #e0e0e0;
            border-radius: 4px; padding: 5px 8px; line-height: 1.7;
        }
        .human-typer-format-hint code {
            background: #eee; padding: 0 3px; border-radius: 2px; font-family: monospace;
        }
        .human-typer-input-group { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .human-typer-input-group input[type="number"] {
            width: 60px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;
        }
        .human-typer-options-group { display: flex; flex-direction: column; gap: 7px; padding-left: 4px; }
        .human-typer-checkbox-item { display: flex; align-items: center; gap: 7px; }
        .human-typer-checkbox-item label { flex-basis: auto; text-align: left; }
        .human-typer-checkbox-item input[type="number"] { width: 55px; padding: 5px; box-sizing: border-box; }
        .human-typer-checkbox-item .rate-label { margin-left: 8px; white-space: nowrap; font-size: 13px; color: #555; }
        .human-typer-eta { font-size: 12px; color: #777; min-height: 1.2em; text-align: center; }
        .human-typer-buttons { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
        .human-typer-button {
            padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;
            transition: background-color 0.2s; font-size: 14px;
        }
        .human-typer-confirm-button { background-color: #1a73e8; color: white; }
        .human-typer-confirm-button:hover:not(:disabled) { background-color: #1765cc; }
        .human-typer-confirm-button:disabled { opacity: 0.6; cursor: not-allowed; }
        .human-typer-cancel-button { background-color: #e0e0e0; color: #333; }
        .human-typer-cancel-button:hover { background-color: #d5d5d5; }
        .human-typer-info-popup {
            position: fixed; background-color: #fff; border: 1px solid #ccc; border-radius: 5px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2); padding: 12px; font-size: 13px;
            max-width: 360px; z-index: 2147483647; color: #333;
        }
        .human-typer-info-popup p { margin-top: 0; margin-bottom: 0.6em; line-height: 1.4; }
        .human-typer-info-popup p:last-child { margin-bottom: 0; }
        .human-typer-info-popup strong { color: #111; }
        .human-typer-info-popup code {
            background-color: #f0f0f0; padding: 1px 3px; border-radius: 3px;
            font-size: 12px; font-family: monospace;
        }
        /* Floating fallback button */
        #human-typer-float-btn {
            position: fixed; top: 10px; right: 12px; z-index: 2147483646;
            background: #fff; border: 1px solid #dadce0; border-radius: 4px;
            padding: 5px 11px; font-size: 13px; cursor: pointer; user-select: none;
            box-shadow: 0 1px 4px rgba(0,0,0,.2); font-family: sans-serif; color: #333;
        }
        #human-typer-float-btn:hover { background: #f1f3f4; }
        #human-typer-float-stop {
            position: fixed; top: 10px; right: 145px; z-index: 2147483646;
            background: #fff; border: 1px solid #dadce0; border-radius: 4px;
            padding: 5px 11px; font-size: 13px; cursor: pointer; user-select: none;
            box-shadow: 0 1px 4px rgba(0,0,0,.2); font-family: sans-serif; color: red;
            display: none;
        }
    `);

    // --- Init ---
    function initializeScript() {
        console.log('Human-Typer v2.0 initializing...');
        insertButtons();
    }

    function insertButtons() {
        if (document.getElementById('human-typer-button') || document.getElementById('human-typer-float-btn')) return;

        // Try to inject next to any known Google Docs menu selector
        const menuAnchor = document.getElementById('docs-help-menu')
            || document.getElementById('docs-extensions-menu')
            || document.querySelector('[id$="-help-menu"]')
            || document.querySelector('.docs-menubar .goog-menubar-button:last-child');

        // Helper: attach click handlers with multiple event types for maximum compatibility
        const attachClick = (el, handler) => {
            el.addEventListener('click', (e) => { e.stopPropagation(); handler(); }, true);
            el.addEventListener('mousedown', (e) => { if(e.button===0){e.stopImmediatePropagation(); e.preventDefault(); handler();} }, true);
        };

        if (menuAnchor) {
            const btn = createMenuButton('Human-Typer', 'human-typer-button');
            const stop = createMenuButton('Stop', 'stop-button', true);
            stop.style.color = 'red';
            attachClick(btn, handleHumanTyperClick);
            attachClick(stop, handleStopClick);
            menuAnchor.parentNode.insertBefore(btn, menuAnchor);
            btn.parentNode.insertBefore(stop, btn.nextSibling);
            console.log('Human-Typer: injected into menu bar.');
        } else {
            // Fallback: floating buttons
            const btn = document.createElement('div');
            btn.id = 'human-typer-float-btn';
            btn.textContent = 'Human-Typer';
            attachClick(btn, handleHumanTyperClick);
            const stop = document.createElement('div');
            stop.id = 'human-typer-float-stop';
            stop.textContent = 'Stop';
            attachClick(stop, handleStopClick);
            document.body.appendChild(btn);
            document.body.appendChild(stop);
            console.log('Human-Typer: using floating fallback buttons.');
        }

        // Keyboard shortcut: Ctrl+Shift+H to toggle overlay
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'H') {
                e.preventDefault(); e.stopPropagation();
                handleHumanTyperClick();
            }
        }, true);
    }

    function createMenuButton(text, id, hidden = false) {
        const btn = document.createElement('div');
        btn.textContent = text;
        btn.classList.add('menu-button', 'goog-control', 'goog-inline-block');
        btn.style.cssText = 'user-select:none;cursor:pointer;transition:background-color 0.2s,box-shadow 0.2s;';
        btn.id = id;
        if (hidden) btn.style.display = 'none';
        btn.addEventListener('mouseenter', () => btn.classList.add('goog-control-hover'));
        btn.addEventListener('mouseleave', () => btn.classList.remove('goog-control-hover'));
        return btn;
    }

    function getStopButton() {
        return document.getElementById('stop-button') || document.getElementById('human-typer-float-stop');
    }

    function handleHumanTyperClick() {
        console.log('Human-Typer: button clicked');
        if (typingInProgress) {
            const s = getStopButton();
            if (s) { s.style.opacity='0.5'; setTimeout(()=>s.style.opacity='1',150); setTimeout(()=>s.style.opacity='0.5',300); setTimeout(()=>s.style.opacity='1',450); }
            return;
        }
        try {
            if (!overlayElement) showOverlay();
            else overlayElement.style.display = 'flex';
            console.log('Human-Typer: overlay should be visible now');
        } catch(err) {
            console.error('Human-Typer: showOverlay error', err);
            alert('Human-Typer error: ' + err.message);
        }
    }

    function handleStopClick() {
        if (!typingInProgress) return;
        cancelTyping = true;
        const s = getStopButton();
        if (s) { s.textContent = 'Stopping...'; s.style.cursor = 'default'; }
    }

    // --- Overlay UI ---
    function showOverlay() {
        if (overlayElement) { overlayElement.style.display = 'flex'; return; }
        overlayElement = document.createElement('div');
        overlayElement.classList.add('human-typer-overlay');

        // Header
        const header = document.createElement('div'); header.classList.add('human-typer-header');
        const title = document.createElement('span'); title.classList.add('human-typer-header-title'); title.textContent = 'Human-Typer Settings';
        const infoIcon = document.createElement('i'); infoIcon.classList.add('human-typer-info-icon'); infoIcon.textContent = 'i'; infoIcon.title = 'Show Instructions';
        infoIcon.addEventListener('click', toggleInfoPopup);
        header.appendChild(title); header.appendChild(infoIcon);
        overlayElement.appendChild(header);

        // Content
        const content = document.createElement('div'); content.classList.add('human-typer-content');

        // .docx drop zone
        const dropZone = document.createElement('div'); dropZone.classList.add('human-typer-drop-zone');
        dropZone.innerHTML = '📄 Drop a <strong>.docx</strong> file here, or <u style="cursor:pointer">click to browse</u>';
        const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = '.docx'; fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f) loadDocx(f, dropZone, textField, confirmButton); });
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadDocx(fileInput.files[0], dropZone, textField, confirmButton); fileInput.value = ''; });

        // Text area
        const textField = document.createElement('textarea');
        textField.placeholder = 'Paste or type text here...\n\nFormatting syntax (when enabled):\n**bold**  *italic*  ***bold+italic***\n__underline__  ~~strikethrough~~\n# Heading 1   ## Heading 2   ### Heading 3';

        // Format hint
        const formatHint = document.createElement('div'); formatHint.classList.add('human-typer-format-hint');
        formatHint.innerHTML = '<strong>Syntax:</strong> <code>**bold**</code> <code>*italic*</code> <code>***bold+italic***</code> <code>__underline__</code> <code>~~strikethrough~~</code> <code># H1</code> <code>## H2</code> <code>### H3</code>';

        // ETA
        const etaLabel = document.createElement('div'); etaLabel.classList.add('human-typer-eta');

        // Delay inputs
        const delayGroup = document.createElement('div'); delayGroup.classList.add('human-typer-input-group');
        const mkNumInput = (val, min) => { const i = document.createElement('input'); i.type='number'; i.min=String(min); i.value=val; return i; };
        const mkLabel = (txt) => { const l = document.createElement('label'); l.textContent=txt; l.style.cssText='flex-basis:115px;text-align:right;flex-shrink:0;font-size:13px;color:#555;'; return l; };
        const lowerBoundInput = mkNumInput(lowerBoundValue, 0);
        const upperBoundInput = mkNumInput(upperBoundValue, 0);
        const lbWrap = document.createElement('div'); lbWrap.appendChild(mkLabel('Min Delay (ms):')); lbWrap.appendChild(lowerBoundInput);
        const ubWrap = document.createElement('div'); ubWrap.appendChild(mkLabel('Max Delay (ms):')); ubWrap.appendChild(upperBoundInput);
        delayGroup.appendChild(lbWrap); delayGroup.appendChild(ubWrap);

        // Options
        const optionsGroup = document.createElement('div'); optionsGroup.classList.add('human-typer-options-group');

        // Helper: make a checkbox row
        const mkCheckItem = (id, labelText, checked) => {
            const wrap = document.createElement('div'); wrap.classList.add('human-typer-checkbox-item');
            const cb = document.createElement('input'); cb.type='checkbox'; cb.id=id; cb.checked=checked;
            const lbl = document.createElement('label'); lbl.textContent=labelText; lbl.htmlFor=id;
            wrap.appendChild(cb); wrap.appendChild(lbl);
            return { wrap, cb };
        };

        const { wrap: fmtWrap, cb: formattingCheckbox } = mkCheckItem('ht-fmt', 'Parse Formatting (**bold**, *italic*, etc.)', enableFormatting);
        formattingCheckbox.addEventListener('change', () => { enableFormatting = formattingCheckbox.checked; formatHint.style.display = enableFormatting ? '' : 'none'; updateEta(); });
        optionsGroup.appendChild(fmtWrap);

        const { wrap: typoWrap, cb: typoCheckbox } = mkCheckItem('ht-typo', 'Enable Typos & Auto Correction', enableTypos);
        const typoRateLabel = document.createElement('label'); typoRateLabel.textContent = 'Rate (%):'; typoRateLabel.htmlFor = 'ht-typo-rate'; typoRateLabel.classList.add('rate-label');
        const typoRateInput = mkNumInput(typoRatePercentValue, 0); typoRateInput.max='100'; typoRateInput.step='1'; typoRateInput.id='ht-typo-rate'; typoRateInput.disabled = !enableTypos;
        typoCheckbox.addEventListener('change', () => { typoRateInput.disabled = !typoCheckbox.checked; enableTypos = typoCheckbox.checked; updateEta(); });
        typoRateInput.addEventListener('input', () => { const r=parseInt(typoRateInput.value); if(!isNaN(r)) typoRatePercentValue=r; updateEta(); });
        typoWrap.appendChild(typoRateLabel); typoWrap.appendChild(typoRateInput);
        optionsGroup.appendChild(typoWrap);

        const { wrap: advWrap, cb: advancedCheckbox } = mkCheckItem('ht-adv', 'Use Advanced Algorithm (Rhythm/Pauses)', useAdvancedAlgorithm);
        advancedCheckbox.addEventListener('change', () => { useAdvancedAlgorithm = advancedCheckbox.checked; updateEta(); });
        optionsGroup.appendChild(advWrap);

        // Buttons
        const buttonContainer = document.createElement('div'); buttonContainer.classList.add('human-typer-buttons');
        const confirmButton = document.createElement('button'); confirmButton.textContent = 'Start Typing'; confirmButton.classList.add('human-typer-button', 'human-typer-confirm-button');
        const cancelButton = document.createElement('button'); cancelButton.textContent = 'Cancel'; cancelButton.classList.add('human-typer-button', 'human-typer-cancel-button');
        buttonContainer.appendChild(cancelButton); buttonContainer.appendChild(confirmButton);

        // Assemble
        content.appendChild(dropZone);
        content.appendChild(textField);
        content.appendChild(formatHint);
        content.appendChild(etaLabel);
        content.appendChild(delayGroup);
        content.appendChild(optionsGroup);
        content.appendChild(buttonContainer);
        overlayElement.appendChild(content);
        document.body.appendChild(overlayElement);

        // Center
        overlayElement.style.left = `${Math.max(0, (window.innerWidth - overlayElement.offsetWidth) / 2)}px`;
        overlayElement.style.top  = `${Math.max(0, (window.innerHeight - overlayElement.offsetHeight) / 2)}px`;

        // ETA updater
        const updateEta = () => {
            let charCount;
            if (preloadedSegments) {
                charCount = preloadedSegments.filter(s=>s.type==='text').reduce((n,s)=>n+s.text.length, 0);
            } else {
                const raw = textField.value;
                charCount = enableFormatting ? raw.replace(/\*\*\*|\*\*|\*|~~|__|^#{1,3} /gm,'').length : raw.length;
            }
            const low = parseInt(lowerBoundInput.value)||0, high = parseInt(upperBoundInput.value)||0;
            if (charCount > 0 && low >= 0 && high >= low) {
                let baseMs = charCount * ((low+high)/2);
                if (enableTypos) {
                    const typoTime = (MAX_TYPO_LENGTH/2) * (BASIC_TYPO_CHAR_DELAY_MS + (useAdvancedAlgorithm ? ADV_BACKSPACE_DELAY_MS : BASIC_BACKSPACE_DELAY_MS))
                                   + (useAdvancedAlgorithm ? (ADV_TYPO_RECOGNITION_MIN_MS+ADV_TYPO_RECOGNITION_MAX_MS)/2 : BASIC_TYPO_PRE_BACKSPACE_DELAY_MS);
                    baseMs += charCount * (typoRatePercentValue/100) * typoTime;
                }
                if (useAdvancedAlgorithm) {
                    const src = preloadedSegments ? preloadedSegments.filter(s=>s.type==='text').map(s=>s.text).join(' ') : textField.value;
                    const spaces = (src.match(/ /g)||[]).length;
                    baseMs += spaces * ((ADV_SPACE_MULTIPLIER_MIN+ADV_SPACE_MULTIPLIER_MAX)/2 - 1) * ((low+high)/2);
                }
                etaLabel.textContent = `ETA: ~${Math.ceil(baseMs/60000)} min ${useAdvancedAlgorithm?'(Advanced)':''} ${enableTypos?'(incl. typos)':''}`;
            } else { etaLabel.textContent = ''; }
            const rateOk = !enableTypos || (!isNaN(parseInt(typoRateInput.value)) && parseInt(typoRateInput.value)>=0 && parseInt(typoRateInput.value)<=100);
            const hasContent = preloadedSegments || textField.value.trim() !== '';
            confirmButton.disabled = !hasContent || low < 0 || high < low || !rateOk;
        };

        textField.addEventListener('input', updateEta);
        lowerBoundInput.addEventListener('input', updateEta);
        upperBoundInput.addEventListener('input', updateEta);

        cancelButton.addEventListener('click', () => { overlayElement.style.display='none'; hideInfoPopup(); });
        confirmButton.addEventListener('click', () => {
            const newLower=parseInt(lowerBoundInput.value), newUpper=parseInt(upperBoundInput.value);
            const newTypoRate=parseInt(typoRateInput.value);
            if (isNaN(newLower)||isNaN(newUpper)||newLower<0||newUpper<newLower) return;
            if (enableTypos && (isNaN(newTypoRate)||newTypoRate<0||newTypoRate>100)) return;
            lowerBoundValue=newLower; upperBoundValue=newUpper;
            enableTypos=typoCheckbox.checked; typoRatePercentValue=newTypoRate;
            useAdvancedAlgorithm=advancedCheckbox.checked; enableFormatting=formattingCheckbox.checked;
            overlayElement.style.display='none'; hideInfoPopup();
            if (preloadedSegments) {
                startTypingWithSegments(preloadedSegments);
            } else {
                startTypingProcess(textField.value);
            }
        });

        makeDraggable(overlayElement, header);
        updateEta();

        // Expose updateEta so loadDocx can trigger a refresh
        overlayElement._updateEta = updateEta;
        overlayElement._confirmButton = confirmButton;
    }

    // --- .docx Loading ---
    async function loadDocx(file, dropZone, textField, confirmButton) {
        if (!file.name.endsWith('.docx')) { alert('Please drop a .docx file.'); return; }
        dropZone.innerHTML = '⏳ Parsing <strong>' + file.name + '</strong>…';
        dropZone.classList.add('loaded');
        try {
            const segments = await parseDocx(file);
            preloadedSegments = segments;
            textField.disabled = true;
            textField.value = '';
            // Count stats
            const paraCount = segments.filter(s=>s.type==='newline').length + 1;
            const charCount = segments.filter(s=>s.type==='text').reduce((n,s)=>n+s.text.length, 0);
            dropZone.innerHTML = `✅ <strong>${file.name}</strong> loaded (${paraCount} paragraphs, ${charCount} chars) <span class="human-typer-drop-zone-clear" title="Clear">✕</span>`;
            dropZone.querySelector('.human-typer-drop-zone-clear').addEventListener('click', (e) => {
                e.stopPropagation();
                preloadedSegments = null;
                textField.disabled = false;
                dropZone.classList.remove('loaded');
                dropZone.innerHTML = '📄 Drop a <strong>.docx</strong> file here, or <u style="cursor:pointer">click to browse</u>';
                if (overlayElement && overlayElement._updateEta) overlayElement._updateEta();
            });
            if (overlayElement && overlayElement._updateEta) overlayElement._updateEta();
        } catch(err) {
            preloadedSegments = null;
            dropZone.classList.remove('loaded');
            dropZone.innerHTML = '📄 Drop a <strong>.docx</strong> file here, or <u style="cursor:pointer">click to browse</u>';
            alert('Failed to parse .docx: ' + err.message);
            console.error('DOCX parse error:', err);
        }
    }

    async function parseDocx(file) {
        const buf = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buf);

        // Load styles.xml to map styleId → style name
        const styleMap = {};
        const stylesFile = zip.file('word/styles.xml');
        if (stylesFile) {
            const stylesStr = await stylesFile.async('string');
            const stylesXml = new DOMParser().parseFromString(stylesStr, 'application/xml');
            for (const s of stylesXml.getElementsByTagNameNS(WNS, 'style')) {
                const styleId = s.getAttributeNS(WNS, 'styleId');
                const nameEl = s.getElementsByTagNameNS(WNS, 'name')[0];
                if (styleId && nameEl) styleMap[styleId] = nameEl.getAttributeNS(WNS, 'val') || '';
            }
        }

        const docStr = await zip.file('word/document.xml').async('string');
        const docXml = new DOMParser().parseFromString(docStr, 'application/xml');
        const body = docXml.getElementsByTagNameNS(WNS, 'body')[0];
        if (!body) throw new Error('Could not find document body');

        const segments = [];
        const paras = Array.from(body.childNodes).filter(n => n.localName === 'p');

        for (let pi = 0; pi < paras.length; pi++) {
            const para = paras[pi];
            // Detect heading level from paragraph style
            let headingLevel = 0;
            const pPr = getChild(para, 'pPr');
            if (pPr) {
                const pStyle = getChild(pPr, 'pStyle');
                if (pStyle) {
                    const styleId = pStyle.getAttributeNS(WNS, 'val') || '';
                    const styleName = styleMap[styleId] || styleId;
                    const hm = styleName.match(/^[Hh]eading\s*([123])/);
                    if (hm) headingLevel = parseInt(hm[1]);
                    else if (/^[Hh]eading([123])$/.test(styleId)) headingLevel = parseInt(styleId.replace(/\D/g,''));
                }
            }

            if (headingLevel > 0) segments.push({ type: 'heading-start', level: headingLevel });

            // Collect text runs (also handles runs inside <w:hyperlink>)
            const runContainers = [para, ...Array.from(para.childNodes).filter(n => n.localName === 'hyperlink')];
            for (const container of runContainers) {
                for (const run of Array.from(container.childNodes).filter(n => n.localName === 'r')) {
                    const rPr = getChild(run, 'rPr');
                    // Collect all <w:t> text (some runs have multiple)
                    const textParts = Array.from(run.childNodes).filter(n => n.localName === 't').map(n => n.textContent);
                    const text = textParts.join('');
                    if (!text) continue;

                    const bold          = hasProp(rPr, 'b');
                    const italic        = hasProp(rPr, 'i');
                    const underline     = hasProp(rPr, 'u');
                    const strikethrough = hasProp(rPr, 'strike') || hasProp(rPr, 'dstrike');

                    segments.push({ type: 'text', text, bold: bold||undefined, italic: italic||undefined, underline: underline||undefined, strikethrough: strikethrough||undefined });
                }
            }

            if (headingLevel > 0) segments.push({ type: 'heading-end' });
            if (pi < paras.length - 1) segments.push({ type: 'newline' });
        }

        return segments;
    }

    // Helper: get first direct child element with given localName in WNS
    function getChild(el, localName) {
        if (!el) return null;
        for (const c of el.childNodes) { if (c.localName === localName && (c.namespaceURI === WNS || !c.namespaceURI)) return c; }
        return null;
    }

    // Helper: check if rPr has a prop that isn't explicitly disabled (val="0"/"false")
    function hasProp(rPr, propName) {
        if (!rPr) return false;
        for (const c of rPr.childNodes) {
            if (c.localName !== propName) continue;
            const val = c.getAttributeNS(WNS, 'val');
            return val !== '0' && val !== 'false';
        }
        return false;
    }

    // --- Info Popup ---
    function toggleInfoPopup(event) { if (infoPopupElement) hideInfoPopup(); else showInfoPopup(event.target); event.stopPropagation(); }
    function showInfoPopup(iconElement) {
        hideInfoPopup();
        infoPopupElement = document.createElement('div');
        infoPopupElement.classList.add('human-typer-info-popup');
        infoPopupElement.innerHTML = `
            <p><strong>Instructions:</strong></p>
            <p>- Drop a <strong>.docx file</strong> onto the drop zone, or type/paste text in the box below it.</p>
            <p>- When <strong>Parse Formatting</strong> is on, use markdown syntax in the text box:</p>
            <p style="margin-left:12px;margin-bottom:0.2em;">• <code>**bold**</code> &nbsp;<code>*italic*</code> &nbsp;<code>***bold+italic***</code></p>
            <p style="margin-left:12px;margin-bottom:0.2em;">• <code>__underline__</code> &nbsp;<code>~~strikethrough~~</code></p>
            <p style="margin-left:12px;margin-bottom:0.7em;">• <code># Heading 1</code> &nbsp;<code>## Heading 2</code> &nbsp;<code>### Heading 3</code> (at line start)</p>
            <p>- Set <strong>Min/Max Delay</strong> for typing speed. Enable <strong>Typos</strong> for auto-correcting mistakes. Enable <strong>Advanced Algorithm</strong> for natural rhythm.</p>
            <p>- Click <strong>Start Typing</strong> with your cursor inside the Google Doc.</p>
            <p>- Keep the tab active. Use <strong>Stop</strong> to cancel. Drag the header to move.</p>
        `;
        document.body.appendChild(infoPopupElement);
        const ir = iconElement.getBoundingClientRect();
        let top = ir.bottom + 5, left = ir.left - (infoPopupElement.offsetWidth/2) + (ir.width/2);
        const m = 10;
        left = Math.max(m, Math.min(left, window.innerWidth - infoPopupElement.offsetWidth - m));
        if (top + infoPopupElement.offsetHeight > window.innerHeight - m) top = ir.top - infoPopupElement.offsetHeight - 5;
        infoPopupElement.style.top = `${Math.max(m,top)}px`; infoPopupElement.style.left = `${left}px`;
        setTimeout(() => document.addEventListener('click', handleClickOutsideInfo, true), 0);
    }
    function hideInfoPopup() { if (infoPopupElement) { infoPopupElement.remove(); infoPopupElement=null; document.removeEventListener('click', handleClickOutsideInfo, true); } }
    function handleClickOutsideInfo(e) { if (infoPopupElement && !infoPopupElement.contains(e.target) && !e.target.classList.contains('human-typer-info-icon')) hideInfoPopup(); }

    // --- Draggable ---
    function makeDraggable(el, handle) {
        let dragging=false, ox, oy;
        handle.addEventListener('mousedown', e => { if(e.button!==0)return; dragging=true; const r=el.getBoundingClientRect(); ox=e.clientX-r.left; oy=e.clientY-r.top; el.style.cursor='grabbing'; document.body.style.userSelect='none'; e.preventDefault(); });
        document.addEventListener('mousemove', e => { if(!dragging)return; const nx=Math.max(5,Math.min(e.clientX-ox, window.innerWidth-el.offsetWidth-5)); const ny=Math.max(5,Math.min(e.clientY-oy, window.innerHeight-el.offsetHeight-5)); el.style.left=nx+'px'; el.style.top=ny+'px'; });
        document.addEventListener('mouseup', e => { if(dragging&&e.button===0){dragging=false;el.style.cursor='';document.body.style.userSelect='';handle.style.cursor='move';} });
        handle.style.cursor='move';
    }

    // --- Typing Engine ---
    async function startTypingProcess(text) {
        const segments = enableFormatting ? parseFormattedText(text) : [{ type:'text', text }];
        await startTypingWithSegments(segments);
    }

    async function startTypingWithSegments(segments) {
        const input = findInputElement();
        if (!input) { alert('Could not find the Google Docs input area. Make sure your cursor is inside the document.'); return; }
        typingInProgress=true; cancelTyping=false;
        const s = getStopButton();
        if (s) { s.textContent='Stop'; s.style.display='inline-block'; s.style.cursor='pointer'; }
        await typeSegments(input, segments);
        typingInProgress=false;
        if (s) s.style.display='none';
        console.log(cancelTyping ? 'Typing stopped.' : 'Typing complete.');
    }

    function findInputElement() {
        try {
            const iframe = document.querySelector('.docs-texteventtarget-iframe');
            if (iframe && iframe.contentDocument) {
                const ae = iframe.contentDocument.activeElement;
                return (ae && ae.nodeName !== 'HTML') ? ae : iframe.contentDocument.body;
            }
        } catch(e) { console.error('findInputElement error:', e); }
        return null;
    }

    async function delay(ms) {
        return new Promise(resolve => {
            if (ms<=0) { resolve(!cancelTyping); return; }
            const tid = setTimeout(()=>resolve(!cancelTyping), ms);
            const check = () => { if(cancelTyping){clearTimeout(tid);resolve(false);}else if(typingInProgress) requestAnimationFrame(check); };
            requestAnimationFrame(check);
        });
    }

    function calculateDelay(cur, prev, next) {
        let d = Math.random()*(upperBoundValue-lowerBoundValue)+lowerBoundValue;
        if (useAdvancedAlgorithm) {
            if (prev===' ') d *= Math.random()*(ADV_SPACE_MULTIPLIER_MAX-ADV_SPACE_MULTIPLIER_MIN)+ADV_SPACE_MULTIPLIER_MIN;
            else if (prev && /[.,!?;:]/.test(prev)) d *= ADV_PUNCTUATION_MULTIPLIER;
            else if (cur!==' ' && (next===' '||next===null||next==='\n')) d *= Math.random()*(ADV_WORD_END_MULTIPLIER_MAX-ADV_WORD_END_MULTIPLIER_MIN)+ADV_WORD_END_MULTIPLIER_MIN;
            if (Math.random()<ADV_RANDOM_PAUSE_CHANCE) d += Math.random()*(ADV_RANDOM_PAUSE_MAX_MS-ADV_RANDOM_PAUSE_MIN_MS)+ADV_RANDOM_PAUSE_MIN_MS;
        }
        return Math.max(10, d);
    }

    async function simulateKey(input, charOrCode, ms) {
        if (!(await delay(ms))) return false;
        let type, props;
        if (charOrCode==='\n')  { type='keydown'; props={key:'Enter',code:'Enter',keyCode:13,which:13}; }
        else if (charOrCode==='\b') { type='keydown'; props={key:'Backspace',code:'Backspace',keyCode:8,which:8}; }
        else { type='keypress'; props={key:charOrCode,charCode:charOrCode.charCodeAt(0),keyCode:charOrCode.charCodeAt(0),which:charOrCode.charCodeAt(0)}; }
        try { input.dispatchEvent(new KeyboardEvent(type,{bubbles:true,cancelable:true,...props})); }
        catch(e) { console.error('simulateKey error',e); return false; }
        return true;
    }

    async function typeChar(input, char, prev, next) {
        // Typo simulation
        if (enableTypos && /\S/.test(char) && char!=='\n' && Math.random()<(typoRatePercentValue/100)) {
            const len = Math.floor(Math.random()*MAX_TYPO_LENGTH)+1;
            let wrong=''; for(let j=0;j<len;j++) wrong+=getNearbyKey(char);
            for (let j=0;j<wrong.length;j++) if(!(await simulateKey(input,wrong[j],BASIC_TYPO_CHAR_DELAY_MS))) return false;
            const recog = useAdvancedAlgorithm ? Math.random()*(ADV_TYPO_RECOGNITION_MAX_MS-ADV_TYPO_RECOGNITION_MIN_MS)+ADV_TYPO_RECOGNITION_MIN_MS : BASIC_TYPO_PRE_BACKSPACE_DELAY_MS;
            if (!(await delay(recog))) return false;
            const bsDelay = useAdvancedAlgorithm ? ADV_BACKSPACE_DELAY_MS : BASIC_BACKSPACE_DELAY_MS;
            for (let j=0;j<wrong.length;j++) if(!(await simulateKey(input,'\b',bsDelay))) return false;
        }
        return await simulateKey(input, char, calculateDelay(char, prev, next));
    }

    // --- Formatting ---
    async function toggleFormatting(input, format) {
        const map = {
            bold:          {ctrlKey:true,  key:'b', code:'KeyB',   keyCode:66},
            italic:        {ctrlKey:true,  key:'i', code:'KeyI',   keyCode:73},
            underline:     {ctrlKey:true,  key:'u', code:'KeyU',   keyCode:85},
            strikethrough: {altKey:true, shiftKey:true, key:'5', code:'Digit5', keyCode:53},
        };
        const p = map[format]; if(!p) return;
        const base = {bubbles:true,cancelable:true,...p};
        input.dispatchEvent(new KeyboardEvent('keydown', base));
        await delay(FORMAT_SHORTCUT_DELAY_MS);
        input.dispatchEvent(new KeyboardEvent('keyup', {...base,cancelable:false}));
        await delay(20);
    }

    async function applyHeadingStyle(input, level) {
        const k = String(level), kc = 48+level;
        const p = {bubbles:true,cancelable:true,ctrlKey:true,altKey:true,key:k,code:`Digit${k}`,keyCode:kc,which:kc};
        input.dispatchEvent(new KeyboardEvent('keydown', p));
        await delay(FORMAT_SHORTCUT_DELAY_MS+30);
        input.dispatchEvent(new KeyboardEvent('keyup', {...p,cancelable:false}));
        await delay(30);
    }

    async function typeSegments(input, segments) {
        const active = {bold:false,italic:false,underline:false,strikethrough:false};
        const fmts = ['bold','italic','underline','strikethrough'];
        let inHeading = false;

        for (const seg of segments) {
            if (cancelTyping) break;
            if (seg.type==='heading-start') {
                await applyHeadingStyle(input, seg.level); inHeading=true;
            } else if (seg.type==='heading-end') {
                // no-op; reset happens after the following newline
            } else if (seg.type==='newline') {
                if (!(await simulateKey(input,'\n',calculateDelay('\n',null,null)))) break;
                if (inHeading) { await applyHeadingStyle(input,0); inHeading=false; }
            } else if (seg.type==='text') {
                const desired = {bold:!!seg.bold,italic:!!seg.italic,underline:!!seg.underline,strikethrough:!!seg.strikethrough};
                for (const f of fmts) { if(desired[f]!==active[f]){await toggleFormatting(input,f);active[f]=desired[f];if(cancelTyping)break;} }
                if (cancelTyping) break;
                const t = seg.text;
                for (let i=0;i<t.length;i++) {
                    if (cancelTyping) break;
                    if (!(await typeChar(input,t[i],i>0?t[i-1]:null,i<t.length-1?t[i+1]:null))) break;
                }
            }
        }
        // Clean up active formatting
        for (const f of fmts) { if(active[f]&&!cancelTyping) await toggleFormatting(input,f); }
    }

    // --- Formatting Parser ---
    function parseFormattedText(text) {
        const lines = text.split('\n');
        const out = [];
        for (let li=0;li<lines.length;li++) {
            const line = lines[li];
            const hm = line.match(/^(#{1,3})\s+(.*)/);
            if (hm) {
                out.push({type:'heading-start',level:hm[1].length});
                out.push(...parseInline(hm[2]));
                out.push({type:'heading-end'});
            } else {
                out.push(...parseInline(line));
            }
            if (li<lines.length-1) out.push({type:'newline'});
        }
        return out;
    }

    function parseInline(text) {
        const out = [];
        const re = /\*\*\*([\s\S]*?)\*\*\*|\*\*([\s\S]*?)\*\*|~~([\s\S]*?)~~|__([\s\S]*?)__|\*([\s\S]*?)\*/g;
        let last=0, m;
        while ((m=re.exec(text))!==null) {
            if (m.index>last) out.push({type:'text',text:text.slice(last,m.index)});
            if (m[1]!==undefined) out.push({type:'text',text:m[1],bold:true,italic:true});
            else if (m[2]!==undefined) out.push({type:'text',text:m[2],bold:true});
            else if (m[3]!==undefined) out.push({type:'text',text:m[3],strikethrough:true});
            else if (m[4]!==undefined) out.push({type:'text',text:m[4],underline:true});
            else if (m[5]!==undefined) out.push({type:'text',text:m[5],italic:true});
            last=re.lastIndex;
        }
        if (last<text.length) out.push({type:'text',text:text.slice(last)});
        return out;
    }

    // --- Typo Helper ---
    function getNearbyKey(char) {
        const kb={'q':'wa','w':'qase','e':'wsdr','r':'edft','t':'rfgy','y':'tghu','u':'yhji','i':'ujko','o':'iklp','p':'ol[','a':'qwsz','s':'awedxz','d':'erfcxs','f':'rtgvcd','g':'tyhbvf','h':'yujnbg','j':'uikmnh','k':'iolmj','l':'opk;','z':'asx','x':'zsdc','c':'xdfv','v':'cfgb','b':'vghn','n':'bhjm','m':'njk,','1':'2q`','2':'1qw3','3':'2we4','4':'3er5','5':'4rt6','6':'5ty7','7':'6yu8','8':'7ui9','9':'8io0','0':'9op-',' ':' '};
        const lc=char.toLowerCase(), adj=kb[lc];
        if(!adj||adj.length===0) return char;
        let nc, tries=0;
        do { nc=adj[Math.floor(Math.random()*adj.length)]; tries++; } while(nc===lc&&tries<5&&adj.length>1);
        return char===char.toUpperCase()&&char!==lc ? nc.toUpperCase() : nc;
    }

    // --- Boot ---
    // Only wait for the editing iframe — no longer requires docs-help-menu
    const initInterval = setInterval(() => {
        const iframe = document.querySelector('.docs-texteventtarget-iframe');
        if (!iframe) return;
        try {
            if (iframe.contentDocument) { clearInterval(initInterval); initializeScript(); }
        } catch(e) { /* cross-origin not ready yet */ }
    }, 500);

})();
