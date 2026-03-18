// ==UserScript==
// @name         Human-Typer (Enhanced v1.9 - Formatting) - Google Docs & Slides
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  Types text human-like with draggable UI, info popup, realistic typos, advanced rhythm algorithm, and Google Docs formatting support.
// @author       ∫(Ace)³dx (Enhanced by Claude)
// @match        https://docs.google.com/*
// @icon         https://i.imgur.com/z2gxKWZ.png
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==
/* globals GM_addStyle */
(function() {
    'use strict';
    // --- Configuration ---
    const DEFAULT_LOWER_BOUND = 60;
    const DEFAULT_UPPER_BOUND = 140;
    const DEFAULT_TYPO_RATE_PERCENT = 5;
    const DEFAULT_ENABLE_TYPOS = true;
    const DEFAULT_USE_ADVANCED_ALGORITHM = true;
    const DEFAULT_ENABLE_FORMATTING = true;
    // --- Basic Typo Config ---
    const MAX_TYPO_LENGTH = 3;
    const BASIC_TYPO_CHAR_DELAY_MS = 50;
    const BASIC_TYPO_PRE_BACKSPACE_DELAY_MS = 150;
    const BASIC_BACKSPACE_DELAY_MS = 90;
    // --- Advanced Algorithm Config ---
    const ADV_SPACE_MULTIPLIER_MIN = 1.8;
    const ADV_SPACE_MULTIPLIER_MAX = 2.8;
    const ADV_WORD_END_MULTIPLIER_MIN = 1.1;
    const ADV_WORD_END_MULTIPLIER_MAX = 1.5;
    const ADV_PUNCTUATION_MULTIPLIER = 1.3;
    const ADV_RANDOM_PAUSE_CHANCE = 0.02;
    const ADV_RANDOM_PAUSE_MIN_MS = 150;
    const ADV_RANDOM_PAUSE_MAX_MS = 400;
    // Advanced Typo Correction Delays
    const ADV_TYPO_RECOGNITION_MIN_MS = 250;
    const ADV_TYPO_RECOGNITION_MAX_MS = 800;
    const ADV_BACKSPACE_DELAY_MS = 100;
    // --- Formatting Shortcut Delay ---
    const FORMAT_SHORTCUT_DELAY_MS = 80;
    // --- State Variables ---
    let cancelTyping = false;
    let typingInProgress = false;
    let lowerBoundValue = DEFAULT_LOWER_BOUND;
    let upperBoundValue = DEFAULT_UPPER_BOUND;
    let enableTypos = DEFAULT_ENABLE_TYPOS;
    let typoRatePercentValue = DEFAULT_TYPO_RATE_PERCENT;
    let useAdvancedAlgorithm = DEFAULT_USE_ADVANCED_ALGORITHM;
    let enableFormatting = DEFAULT_ENABLE_FORMATTING;
    let overlayElement = null;
    let infoPopupElement = null;
    // --- CSS Styles ---
    GM_addStyle(`
        .human-typer-overlay {
            position: fixed; background-color: rgba(255, 255, 255, 0.95); padding: 0;
            border-radius: 8px; box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.2); z-index: 10000;
            display: flex; flex-direction: column; width: 380px;
            border: 1px solid #ccc; font-family: sans-serif; font-size: 14px; color: #333;
        }
        .human-typer-header {
            background-color: #f1f1f1; padding: 8px 12px; cursor: move; border-bottom: 1px solid #ccc;
            border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex;
            justify-content: space-between; align-items: center; user-select: none;
        }
        .human-typer-header-title { font-weight: bold; }
        .human-typer-info-icon {
            cursor: pointer; font-style: normal; font-weight: bold; color: #d93025; border: 1px solid #d93025;
            border-radius: 50%; width: 18px; height: 18px; display: inline-flex; justify-content: center;
            align-items: center; font-size: 12px; margin-left: 10px; background-color: white;
        }
        .human-typer-info-icon:hover { background-color: #fce8e6; }
        .human-typer-content { padding: 15px; display: flex; flex-direction: column; gap: 12px; }
        .human-typer-overlay textarea {
            width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; resize: vertical;
            box-sizing: border-box; min-height: 90px; font-family: monospace; font-size: 13px;
        }
        .human-typer-label { font-size: 13px; color: #555; }
        .human-typer-format-hint {
            font-size: 11px; color: #888; background: #f8f8f8; border: 1px solid #e0e0e0;
            border-radius: 4px; padding: 6px 8px; line-height: 1.6;
        }
        .human-typer-format-hint code {
            background: #eee; padding: 0 3px; border-radius: 2px; font-family: monospace;
        }
        .human-typer-input-group { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .human-typer-input-group label {
            flex-basis: 115px; text-align: right; flex-shrink: 0;
        }
        .human-typer-input-group input[type="number"] {
            width: 60px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;
        }
        .human-typer-options-group {
             display: flex; flex-direction: column; gap: 8px; margin-top: 5px; padding-left: 10px;
        }
        .human-typer-checkbox-item {
             display: flex; align-items: center; gap: 8px;
        }
         .human-typer-checkbox-item label {
             flex-basis: auto; text-align: left;
         }
         .human-typer-checkbox-item input[type="number"] {
             width: 55px; padding: 6px; box-sizing: border-box;
         }
         .human-typer-checkbox-item .rate-label {
             margin-left: 10px; white-space: nowrap;
         }
        .human-typer-eta { font-size: 12px; color: #777; min-height: 1.2em; text-align: center; }
        .human-typer-buttons { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
        .human-typer-button {
            padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;
            transition: background-color 0.3s, color 0.3s; font-size: 14px;
        }
        .human-typer-confirm-button { background-color: #1a73e8; color: white; }
        .human-typer-confirm-button:hover:not(:disabled) { background-color: #1765cc; }
        .human-typer-confirm-button:disabled { opacity: 0.6; cursor: not-allowed; }
        .human-typer-cancel-button { background-color: #e0e0e0; color: #333; }
        .human-typer-cancel-button:hover { background-color: #d5d5d5; }
        .human-typer-info-popup {
            position: absolute; background-color: #fff; border: 1px solid #ccc; border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2); padding: 12px; font-size: 13px;
            max-width: 360px; z-index: 10001; color: #333;
        }
        .human-typer-info-popup p { margin-top: 0; margin-bottom: 0.7em; line-height: 1.4; }
        .human-typer-info-popup p:last-child { margin-bottom: 0; }
        .human-typer-info-popup strong { color: #111; }
        .human-typer-info-popup code { background-color: #f0f0f0; padding: 1px 3px; border-radius: 3px; font-size: 12px; font-family: monospace; }
    `);
    // --- Main Logic ---
    function initializeScript() { console.log("Human-Typer initializing..."); insertButtons(); }
    function insertButtons() {
        const helpMenu = document.getElementById("docs-help-menu");
        if (!helpMenu || document.getElementById("human-typer-button")) return;
        const humanTyperButton = createButton("Human-Typer", "human-typer-button");
        humanTyperButton.addEventListener("click", handleHumanTyperClick);
        const stopButton = createButton("Stop", "stop-button", true);
        stopButton.style.color = "red";
        stopButton.addEventListener("click", handleStopClick);
        helpMenu.parentNode.insertBefore(humanTyperButton, helpMenu);
        humanTyperButton.parentNode.insertBefore(stopButton, humanTyperButton.nextSibling);
        console.log("Human-Typer buttons inserted.");
    }
    function createButton(text, id, hidden = false) {
        const button = document.createElement("div");
        button.textContent = text;
        button.classList.add("menu-button", "goog-control", "goog-inline-block");
        button.style.userSelect = "none"; button.style.cursor = "pointer"; button.style.transition = "background-color 0.2s, box-shadow 0.2s";
        button.id = id; if (hidden) button.style.display = "none";
        button.addEventListener("mouseenter", () => button.classList.add("goog-control-hover"));
        button.addEventListener("mouseleave", () => button.classList.remove("goog-control-hover"));
        return button;
    }
    function handleHumanTyperClick() {
        if (typingInProgress) {
            console.log("Typing already in progress.");
            const stopButton = document.getElementById("stop-button");
            if (stopButton) {
                 stopButton.style.opacity = '0.5'; setTimeout(() => { stopButton.style.opacity = '1'; }, 150);
                 setTimeout(() => { stopButton.style.opacity = '0.5'; }, 300); setTimeout(() => { stopButton.style.opacity = '1'; }, 450);
            } return;
        }
        if (!overlayElement) showOverlay(); else overlayElement.style.display = 'flex';
    }
    function handleStopClick() {
        if (typingInProgress) {
            console.log("Stop requested."); cancelTyping = true;
            const stopButton = document.getElementById("stop-button");
            if (stopButton) { stopButton.textContent = "Stopping..."; stopButton.style.cursor = "default"; stopButton.classList.remove("goog-control-hover"); }
        }
    }
    function showOverlay() {
        if (overlayElement) { overlayElement.style.display = 'flex'; return; }
        overlayElement = document.createElement("div");
        overlayElement.classList.add("human-typer-overlay");
        // --- Header ---
        const header = document.createElement("div"); header.classList.add("human-typer-header");
        const title = document.createElement("span"); title.classList.add("human-typer-header-title"); title.textContent = "Human-Typer Settings";
        const infoIcon = document.createElement("i"); infoIcon.classList.add("human-typer-info-icon"); infoIcon.textContent = "i"; infoIcon.title = "Show Instructions";
        infoIcon.addEventListener("click", toggleInfoPopup);
        header.appendChild(title); header.appendChild(infoIcon); overlayElement.appendChild(header);
        // --- Content Area ---
        const content = document.createElement("div"); content.classList.add("human-typer-content");
        const textField = document.createElement("textarea");
        textField.placeholder = "Paste or type your text here...\n\nFormatting (when enabled):\n**bold**  *italic*  ***bold+italic***\n__underline__  ~~strikethrough~~\n# Heading 1  ## Heading 2  ### Heading 3";
        const etaLabel = document.createElement("div"); etaLabel.classList.add("human-typer-eta");
        // --- Formatting hint ---
        const formatHint = document.createElement("div"); formatHint.classList.add("human-typer-format-hint");
        formatHint.innerHTML = `<strong>Formatting syntax:</strong> <code>**bold**</code> &nbsp;<code>*italic*</code> &nbsp;<code>***bold+italic***</code> &nbsp;<code>__underline__</code> &nbsp;<code>~~strikethrough~~</code> &nbsp;<code># H1</code> <code>## H2</code> <code>### H3</code>`;
        // --- Delay Settings ---
        const delayGroup = document.createElement("div");
        delayGroup.classList.add("human-typer-input-group");
        const lowerBoundContainer = document.createElement("div");
        const lowerBoundLabel = document.createElement("label");
        lowerBoundLabel.textContent = "Min Delay (ms):";
        const lowerBoundInput = document.createElement("input");
        lowerBoundInput.type = "number"; lowerBoundInput.min = "0"; lowerBoundInput.value = lowerBoundValue;
        lowerBoundContainer.appendChild(lowerBoundLabel); lowerBoundContainer.appendChild(lowerBoundInput);
        const upperBoundContainer = document.createElement("div");
        const upperBoundLabel = document.createElement("label");
        upperBoundLabel.textContent = "Max Delay (ms):";
        const upperBoundInput = document.createElement("input");
        upperBoundInput.type = "number"; upperBoundInput.min = "0"; upperBoundInput.value = upperBoundValue;
        upperBoundContainer.appendChild(upperBoundLabel); upperBoundContainer.appendChild(upperBoundInput);
        delayGroup.appendChild(lowerBoundContainer); delayGroup.appendChild(upperBoundContainer);
        // --- Options Group ---
        const optionsGroup = document.createElement("div"); optionsGroup.classList.add("human-typer-options-group");
        // --- Formatting Setting ---
        const formattingItem = document.createElement("div"); formattingItem.classList.add("human-typer-checkbox-item");
        const formattingCheckbox = document.createElement("input"); formattingCheckbox.type = "checkbox"; formattingCheckbox.id = "human-typer-formatting-enable"; formattingCheckbox.checked = enableFormatting;
        const formattingLabel = document.createElement("label"); formattingLabel.textContent = "Parse Formatting (**bold**, *italic*, etc.)"; formattingLabel.htmlFor = "human-typer-formatting-enable";
        formattingCheckbox.addEventListener('change', () => {
            enableFormatting = formattingCheckbox.checked;
            formatHint.style.display = enableFormatting ? '' : 'none';
            updateEta();
        });
        formattingItem.appendChild(formattingCheckbox); formattingItem.appendChild(formattingLabel);
        optionsGroup.appendChild(formattingItem);
        // --- Typo Settings ---
        const typoItem = document.createElement("div"); typoItem.classList.add("human-typer-checkbox-item");
        const typoCheckbox = document.createElement("input"); typoCheckbox.type = "checkbox"; typoCheckbox.id = "human-typer-typo-enable"; typoCheckbox.checked = enableTypos;
        const typoLabel = document.createElement("label"); typoLabel.textContent = "Enable Typos & Auto Correction"; typoLabel.htmlFor = "human-typer-typo-enable";
        const typoRateLabel = document.createElement("label"); typoRateLabel.textContent = "Typo Rate (%):"; typoRateLabel.htmlFor = "human-typer-typo-rate"; typoRateLabel.classList.add("rate-label");
        const typoRateInput = document.createElement("input"); typoRateInput.type = "number"; typoRateInput.id = "human-typer-typo-rate"; typoRateInput.min = "0"; typoRateInput.max = "100"; typoRateInput.step = "1"; typoRateInput.value = typoRatePercentValue; typoRateInput.disabled = !enableTypos;
        typoCheckbox.addEventListener('change', () => { typoRateInput.disabled = !typoCheckbox.checked; enableTypos = typoCheckbox.checked; updateEta(); });
        typoItem.appendChild(typoCheckbox); typoItem.appendChild(typoLabel); typoItem.appendChild(typoRateLabel); typoItem.appendChild(typoRateInput);
        optionsGroup.appendChild(typoItem);
        // --- Advanced Algorithm Setting ---
        const advancedItem = document.createElement("div"); advancedItem.classList.add("human-typer-checkbox-item");
        const advancedCheckbox = document.createElement("input"); advancedCheckbox.type = "checkbox"; advancedCheckbox.id = "human-typer-advanced-algo"; advancedCheckbox.checked = useAdvancedAlgorithm;
        const advancedLabel = document.createElement("label"); advancedLabel.textContent = "Use Advanced Algorithm (Rhythm/Pauses)"; advancedLabel.htmlFor = "human-typer-advanced-algo";
        advancedCheckbox.addEventListener('change', () => { useAdvancedAlgorithm = advancedCheckbox.checked; updateEta(); });
        advancedItem.appendChild(advancedCheckbox); advancedItem.appendChild(advancedLabel);
        optionsGroup.appendChild(advancedItem);
        // --- Buttons ---
        const buttonContainer = document.createElement("div"); buttonContainer.classList.add("human-typer-buttons");
        const confirmButton = document.createElement("button"); confirmButton.textContent = "Start Typing"; confirmButton.classList.add("human-typer-button", "human-typer-confirm-button");
        const cancelButton = document.createElement("button"); cancelButton.textContent = "Cancel"; cancelButton.classList.add("human-typer-button", "human-typer-cancel-button");
        // --- Assemble Content ---
        content.appendChild(textField);
        content.appendChild(formatHint);
        content.appendChild(etaLabel);
        content.appendChild(delayGroup);
        content.appendChild(optionsGroup);
        content.appendChild(buttonContainer);
        buttonContainer.appendChild(cancelButton); buttonContainer.appendChild(confirmButton);
        overlayElement.appendChild(content);
        document.body.appendChild(overlayElement);
        // --- Center Overlay ---
        overlayElement.style.left = `${Math.max(0, (window.innerWidth - overlayElement.offsetWidth) / 2)}px`;
        overlayElement.style.top = `${Math.max(0, (window.innerHeight - overlayElement.offsetHeight) / 2)}px`;
        // --- Event Listeners & ETA ---
        const updateEta = () => {
            const rawText = textField.value;
            // Count typeable chars (strip formatting markers for estimate)
            const strippedText = enableFormatting
                ? rawText.replace(/\*\*\*|\*\*|\*|~~|__|^#{1,3} /gm, '')
                : rawText;
            const charCount = strippedText.length;
            const low = parseInt(lowerBoundInput.value) || 0;
            const high = parseInt(upperBoundInput.value) || 0;
            if (charCount > 0 && low >= 0 && high >= low) {
                let baseMs = charCount * ((low + high) / 2);
                if (enableTypos) {
                    const avgTypoLen = MAX_TYPO_LENGTH / 2;
                    const typoTimePerOccur = avgTypoLen * (BASIC_TYPO_CHAR_DELAY_MS + (useAdvancedAlgorithm ? ADV_BACKSPACE_DELAY_MS : BASIC_BACKSPACE_DELAY_MS))
                                           + (useAdvancedAlgorithm ? (ADV_TYPO_RECOGNITION_MIN_MS + ADV_TYPO_RECOGNITION_MAX_MS)/2 : BASIC_TYPO_PRE_BACKSPACE_DELAY_MS);
                    baseMs += charCount * (typoRatePercentValue / 100) * typoTimePerOccur;
                }
                if (useAdvancedAlgorithm) {
                    const spaceCount = (strippedText.match(/ /g) || []).length;
                    const avgSpacePauseIncrease = ((ADV_SPACE_MULTIPLIER_MIN + ADV_SPACE_MULTIPLIER_MAX) / 2 - 1) * ((low + high) / 2);
                    baseMs += spaceCount * avgSpacePauseIncrease;
                }
                const etaMinutes = Math.ceil(baseMs / 60000);
                etaLabel.textContent = `ETA: ~${etaMinutes} minutes ${useAdvancedAlgorithm ? '(Advanced)' : ''} ${enableTypos ? '(incl. typos)' : ''}`;
            } else {
                etaLabel.textContent = "";
            }
            const currentTypoRate = parseInt(typoRateInput.value);
            const typoRateValid = !enableTypos || (!isNaN(currentTypoRate) && currentTypoRate >= 0 && currentTypoRate <= 100);
            confirmButton.disabled = rawText.trim() === "" || low < 0 || high < low || !typoRateValid;
        };
        textField.addEventListener("input", updateEta);
        lowerBoundInput.addEventListener("input", updateEta);
        upperBoundInput.addEventListener("input", updateEta);
        typoCheckbox.addEventListener("change", updateEta);
        advancedCheckbox.addEventListener("change", updateEta);
        formattingCheckbox.addEventListener("change", updateEta);
        typoRateInput.addEventListener("input", () => {
            const rate = parseInt(typoRateInput.value); if (!isNaN(rate)) typoRatePercentValue = rate;
            updateEta();
        });
        cancelButton.addEventListener("click", () => { overlayElement.style.display = 'none'; hideInfoPopup(); });
        confirmButton.addEventListener("click", () => {
            const userInput = textField.value;
            const newLower = parseInt(lowerBoundInput.value); const newUpper = parseInt(upperBoundInput.value);
            const newTypoRatePercent = parseInt(typoRateInput.value);
            const newEnableTypos = typoCheckbox.checked;
            const newUseAdvanced = advancedCheckbox.checked;
            const newEnableFormatting = formattingCheckbox.checked;
            if (userInput.trim() === "" || isNaN(newLower) || isNaN(newUpper) || newLower < 0 || newUpper < newLower || (newEnableTypos && (isNaN(newTypoRatePercent) || newTypoRatePercent < 0 || newTypoRatePercent > 100))) {
                 console.warn("Invalid input or settings."); return;
             }
            lowerBoundValue = newLower; upperBoundValue = newUpper;
            enableTypos = newEnableTypos; typoRatePercentValue = newTypoRatePercent;
            useAdvancedAlgorithm = newUseAdvanced;
            enableFormatting = newEnableFormatting;
            overlayElement.style.display = 'none'; hideInfoPopup();
            startTypingProcess(userInput);
        });
        makeDraggable(overlayElement, header);
        updateEta();
    }
    function toggleInfoPopup(event) { if (infoPopupElement) hideInfoPopup(); else showInfoPopup(event.target); event.stopPropagation(); }
    function showInfoPopup(iconElement) {
        hideInfoPopup();
        infoPopupElement = document.createElement('div');
        infoPopupElement.classList.add('human-typer-info-popup');
        infoPopupElement.innerHTML = `
            <p><strong>Instructions:</strong></p>
            <p>- Paste text into the area. When <strong>Parse Formatting</strong> is enabled, use markdown-style syntax:</p>
            <p style="margin-left:15px; margin-bottom:0.3em;">• <code>**bold**</code> → <strong>bold</strong></p>
            <p style="margin-left:15px; margin-bottom:0.3em;">• <code>*italic*</code> → <em>italic</em></p>
            <p style="margin-left:15px; margin-bottom:0.3em;">• <code>***bold+italic***</code> → <strong><em>bold italic</em></strong></p>
            <p style="margin-left:15px; margin-bottom:0.3em;">• <code>__underline__</code> → <u>underline</u></p>
            <p style="margin-left:15px; margin-bottom:0.3em;">• <code>~~strikethrough~~</code> → strikethrough</p>
            <p style="margin-left:15px; margin-bottom:0.7em;">• <code># H1</code> &nbsp;<code>## H2</code> &nbsp;<code>### H3</code> at line start → headings</p>
            <p>- Set <strong>Min/Max Delay</strong> (ms) for base character typing speed.</p>
            <p>- Enable <strong>Typos</strong> &amp; set <strong>% Rate</strong>. Typos involve typing adjacent keys, pausing, then auto-correcting with Backspace.</p>
            <p>- Enable <strong>Advanced Algorithm</strong> for more human-like rhythm (longer pauses after spaces, random pauses, etc.).</p>
            <p>- Click <strong>'Start Typing'</strong> (ensure cursor is in Doc/Slide).</p>
            <p>- Keep tab active. Use <strong>'Stop'</strong> button to cancel.</p>
            <p>- Drag window header to move.</p>
        `;
        document.body.appendChild(infoPopupElement);
        const iconRect = iconElement.getBoundingClientRect(); const popupRect = infoPopupElement.getBoundingClientRect();
        let top = iconRect.bottom + window.scrollY + 5; let left = iconRect.left + window.scrollX - (popupRect.width / 2) + (iconRect.width / 2);
        const margin = 10; if (left < margin) left = margin; if (left + popupRect.width > window.innerWidth - margin) left = window.innerWidth - popupRect.width - margin;
        if (top + popupRect.height > window.innerHeight - margin) top = iconRect.top + window.scrollY - popupRect.height - 5; if (top < margin) top = margin;
        infoPopupElement.style.top = `${top}px`; infoPopupElement.style.left = `${left}px`;
        setTimeout(() => { document.addEventListener('click', handleClickOutsideInfoPopup, true); }, 0);
    }
    function hideInfoPopup() { if (infoPopupElement) { infoPopupElement.remove(); infoPopupElement = null; document.removeEventListener('click', handleClickOutsideInfoPopup, true); } }
    function handleClickOutsideInfoPopup(event) { if (infoPopupElement && !infoPopupElement.contains(event.target) && !event.target.classList.contains('human-typer-info-icon')) hideInfoPopup(); }
    function makeDraggable(element, handle) {
        let isDragging = false; let offsetX, offsetY;
        const onMouseDown = (e) => { if (e.button !== 0) return; if (!handle || handle.contains(e.target)) { isDragging = true; const rect = element.getBoundingClientRect(); offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top; element.style.cursor = 'grabbing'; document.body.style.userSelect = 'none'; e.preventDefault(); } };
        const onMouseMove = (e) => { if (!isDragging) return; let newX = e.clientX - offsetX; let newY = e.clientY - offsetY; const vw = window.innerWidth; const vh = window.innerHeight; const elemWidth = element.offsetWidth; const elemHeight = element.offsetHeight; const margin = 5; newX = Math.max(margin, Math.min(newX, vw - elemWidth - margin)); newY = Math.max(margin, Math.min(newY, vh - elemHeight - margin)); element.style.left = `${newX}px`; element.style.top = `${newY}px`; };
        const onMouseUp = (e) => { if (isDragging && e.button === 0) { isDragging = false; element.style.cursor = ''; document.body.style.userSelect = ''; if (handle) handle.style.cursor = 'move'; } };
        const target = handle || element; target.addEventListener('mousedown', onMouseDown); document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); if (handle) handle.style.cursor = 'move';
    }
    // --- Formatting Parsing ---
    /**
     * Parses text with markdown-style formatting into an array of typed segments.
     * Supported syntax:
     *   ***bold+italic***   **bold**   *italic*   __underline__   ~~strikethrough~~
     *   # Heading 1   ## Heading 2   ### Heading 3  (at line start)
     *
     * Returns array of segments:
     *   { type: 'text', text: string, bold?, italic?, underline?, strikethrough? }
     *   { type: 'newline' }
     *   { type: 'heading-start', level: 1|2|3 }
     *   { type: 'heading-end' }
     */
    function parseFormattedText(rawText) {
        const lines = rawText.split('\n');
        const segments = [];
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const content = headingMatch[2];
                segments.push({ type: 'heading-start', level });
                segments.push(...parseInlineFormatting(content));
                segments.push({ type: 'heading-end' });
            } else {
                segments.push(...parseInlineFormatting(line));
            }
            if (lineIdx < lines.length - 1) {
                segments.push({ type: 'newline' });
            }
        }
        return segments;
    }
    function parseInlineFormatting(text) {
        const segments = [];
        // Order matters: *** before ** before * to avoid premature matching
        const pattern = /\*\*\*([\s\S]*?)\*\*\*|\*\*([\s\S]*?)\*\*|~~([\s\S]*?)~~|__([\s\S]*?)__|\*([\s\S]*?)\*/g;
        let lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            if (match.index > lastIndex) {
                segments.push({ type: 'text', text: text.slice(lastIndex, match.index) });
            }
            if (match[1] !== undefined) {
                segments.push({ type: 'text', text: match[1], bold: true, italic: true });
            } else if (match[2] !== undefined) {
                segments.push({ type: 'text', text: match[2], bold: true });
            } else if (match[3] !== undefined) {
                segments.push({ type: 'text', text: match[3], strikethrough: true });
            } else if (match[4] !== undefined) {
                segments.push({ type: 'text', text: match[4], underline: true });
            } else if (match[5] !== undefined) {
                segments.push({ type: 'text', text: match[5], italic: true });
            }
            lastIndex = pattern.lastIndex;
        }
        if (lastIndex < text.length) {
            segments.push({ type: 'text', text: text.slice(lastIndex) });
        }
        return segments;
    }
    // --- Formatting Keyboard Shortcuts ---
    /**
     * Toggles a formatting style in Google Docs via keyboard shortcut.
     * bold: Ctrl+B, italic: Ctrl+I, underline: Ctrl+U, strikethrough: Alt+Shift+5
     */
    async function toggleFormatting(inputElement, format) {
        const shortcuts = {
            bold:          { ctrlKey: true,  key: 'b', code: 'KeyB',   keyCode: 66 },
            italic:        { ctrlKey: true,  key: 'i', code: 'KeyI',   keyCode: 73 },
            underline:     { ctrlKey: true,  key: 'u', code: 'KeyU',   keyCode: 85 },
            strikethrough: { altKey: true, shiftKey: true, key: '5', code: 'Digit5', keyCode: 53 },
        };
        const props = shortcuts[format];
        if (!props) return;
        const baseProps = { bubbles: true, cancelable: true, ...props };
        inputElement.dispatchEvent(new KeyboardEvent('keydown', baseProps));
        await delay(FORMAT_SHORTCUT_DELAY_MS);
        inputElement.dispatchEvent(new KeyboardEvent('keyup', { ...baseProps, cancelable: false }));
        await delay(20);
        console.log(`Format toggle: ${format}`);
    }
    /**
     * Applies a paragraph/heading style via Ctrl+Alt+N.
     * level 0 = Normal text, level 1-3 = Heading 1-3
     */
    async function applyHeadingStyle(inputElement, level) {
        const keyNum = String(level);
        const keyCode = 48 + level; // '0'=48, '1'=49, ...
        const props = {
            bubbles: true, cancelable: true,
            ctrlKey: true, altKey: true,
            key: keyNum, code: `Digit${keyNum}`,
            keyCode, which: keyCode,
        };
        inputElement.dispatchEvent(new KeyboardEvent('keydown', props));
        await delay(FORMAT_SHORTCUT_DELAY_MS + 30);
        inputElement.dispatchEvent(new KeyboardEvent('keyup', { ...props, cancelable: false }));
        await delay(30);
        console.log(`Heading style applied: level ${level}`);
    }
    // --- Typing Simulation ---
    async function startTypingProcess(textToType) {
        const inputElement = findInputElement();
        if (!inputElement) { alert("Could not find the Google Docs/Slides input area. Ensure cursor is active."); return; }
        typingInProgress = true; cancelTyping = false;
        const stopButton = document.getElementById("stop-button");
        if (stopButton) { stopButton.textContent = "Stop"; stopButton.style.display = "inline-block"; stopButton.style.cursor = "pointer"; }
        await typeStringWithLogic(inputElement, textToType);
        typingInProgress = false; if (stopButton) stopButton.style.display = "none";
        console.log(cancelTyping ? "Typing stopped by user." : "Typing finished.");
    }
    function findInputElement() {
         try { const iframe = document.querySelector(".docs-texteventtarget-iframe"); if (iframe && iframe.contentDocument) { return iframe.contentDocument.activeElement && iframe.contentDocument.activeElement.nodeName !== 'HTML' ? iframe.contentDocument.activeElement : iframe.contentDocument.body; } } catch (e) { console.error("Error accessing iframe content:", e); } console.error("Could not find target input element."); return null;
    }
    async function delay(ms) {
        return new Promise(resolve => { if (ms <= 0) { resolve(!cancelTyping); return; } const timeoutId = setTimeout(() => resolve(!cancelTyping), ms); const checkCancel = () => { if (cancelTyping) { clearTimeout(timeoutId); resolve(false); } else if (typingInProgress) { requestAnimationFrame(checkCancel); } }; requestAnimationFrame(checkCancel); });
    }
    function calculateDelay(currentChar, prevChar, nextChar) {
        let baseDelay = Math.random() * (upperBoundValue - lowerBoundValue) + lowerBoundValue;
        let finalDelay = baseDelay;
        if (useAdvancedAlgorithm) {
            const isSpace = (char) => char === ' ';
            const isPunctuation = (char) => /[.,!?;:]/.test(char);
            const isEndOfWord = (current, next) => !isSpace(current) && (isSpace(next) || next === null || next === '\n');
            if (prevChar && isSpace(prevChar)) {
                finalDelay *= Math.random() * (ADV_SPACE_MULTIPLIER_MAX - ADV_SPACE_MULTIPLIER_MIN) + ADV_SPACE_MULTIPLIER_MIN;
            } else if (prevChar && isPunctuation(prevChar)) {
                 finalDelay *= ADV_PUNCTUATION_MULTIPLIER;
            } else if (isEndOfWord(currentChar, nextChar)) {
                finalDelay *= Math.random() * (ADV_WORD_END_MULTIPLIER_MAX - ADV_WORD_END_MULTIPLIER_MIN) + ADV_WORD_END_MULTIPLIER_MIN;
            }
            if (Math.random() < ADV_RANDOM_PAUSE_CHANCE) {
                const pause = Math.random() * (ADV_RANDOM_PAUSE_MAX_MS - ADV_RANDOM_PAUSE_MIN_MS) + ADV_RANDOM_PAUSE_MIN_MS;
                console.log(`-- Random pause: ${pause.toFixed(0)}ms --`);
                finalDelay += pause;
            }
        }
        return Math.max(10, finalDelay);
    }
    async function simulateKey(inputElement, charOrCode, keyDelay) {
        const proceed = await delay(keyDelay);
        if (!proceed) return false;
        const eventProps = { bubbles: true, cancelable: true };
        let eventType; let keyEventProps; let logChar = charOrCode;
        if (charOrCode === '\n') {
            eventType = 'keydown'; keyEventProps = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }; logChar = '\\n';
        } else if (charOrCode === '\b') {
            eventType = 'keydown'; keyEventProps = { key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8 }; logChar = 'Backspace';
        } else {
            eventType = 'keypress'; keyEventProps = { key: charOrCode, charCode: charOrCode.charCodeAt(0), keyCode: charOrCode.charCodeAt(0), which: charOrCode.charCodeAt(0) };
        }
        Object.assign(eventProps, keyEventProps);
        const eventObj = new KeyboardEvent(eventType, eventProps);
        try {
            inputElement.dispatchEvent(eventObj);
            console.log(`Key: ${logChar}, Delay: ${keyDelay.toFixed(0)}ms`);
        } catch (e) {
            console.error(`Error dispatching event for key "${logChar}":`, e);
            return false;
        }
        return true;
    }
    /**
     * Types a single character with optional typo simulation.
     * Returns false if typing was cancelled, true otherwise.
     */
    async function typeChar(inputElement, char, prevChar, nextChar) {
        // --- Typo Simulation ---
        if (enableTypos && char.match(/\S/) && char !== '\n' && Math.random() < (typoRatePercentValue / 100)) {
            const typoLength = Math.floor(Math.random() * MAX_TYPO_LENGTH) + 1;
            let wrongSequence = "";
            for (let j = 0; j < typoLength; j++) {
                wrongSequence += getNearbyKey(char);
            }
            console.log(`-> Simulating ${typoLength}-char typo for '${char}', typing '${wrongSequence}'`);
            for (let j = 0; j < wrongSequence.length; j++) {
                if (!(await simulateKey(inputElement, wrongSequence[j], BASIC_TYPO_CHAR_DELAY_MS))) return false;
            }
            const recognitionDelay = useAdvancedAlgorithm
                ? Math.random() * (ADV_TYPO_RECOGNITION_MAX_MS - ADV_TYPO_RECOGNITION_MIN_MS) + ADV_TYPO_RECOGNITION_MIN_MS
                : BASIC_TYPO_PRE_BACKSPACE_DELAY_MS;
            console.log(`-- Typo recognition pause: ${recognitionDelay.toFixed(0)}ms --`);
            if (!(await delay(recognitionDelay))) return false;
            const backspaceDelay = useAdvancedAlgorithm ? ADV_BACKSPACE_DELAY_MS : BASIC_BACKSPACE_DELAY_MS;
            for (let j = 0; j < wrongSequence.length; j++) {
                if (!(await simulateKey(inputElement, '\b', backspaceDelay))) return false;
            }
            console.log(`<- Typo for '${char}' corrected.`);
        }
        const typingDelay = calculateDelay(char, prevChar, nextChar);
        return await simulateKey(inputElement, char, typingDelay);
    }
    // Main typing loop — handles both plain text and formatted segments
    async function typeStringWithLogic(inputElement, string) {
        if (enableFormatting) {
            await typeFormattedSegments(inputElement, parseFormattedText(string));
        } else {
            // Plain text path (original behaviour)
            for (let i = 0; i < string.length; i++) {
                if (cancelTyping) break;
                const char = string[i];
                const prevChar = i > 0 ? string[i - 1] : null;
                const nextChar = i < string.length - 1 ? string[i + 1] : null;
                if (!(await typeChar(inputElement, char, prevChar, nextChar))) break;
            }
        }
    }
    async function typeFormattedSegments(inputElement, segments) {
        // Track which formats are currently active in the editor
        const active = { bold: false, italic: false, underline: false, strikethrough: false };
        const fmtKeys = ['bold', 'italic', 'underline', 'strikethrough'];
        let inHeadingParagraph = false;
        for (const segment of segments) {
            if (cancelTyping) break;
            if (segment.type === 'heading-start') {
                await applyHeadingStyle(inputElement, segment.level);
                inHeadingParagraph = true;
            } else if (segment.type === 'heading-end') {
                // heading-end is a no-op; cleanup happens after the following newline
            } else if (segment.type === 'newline') {
                const typingDelay = calculateDelay('\n', null, null);
                if (!(await simulateKey(inputElement, '\n', typingDelay))) break;
                // After newline, reset paragraph style back to Normal if we were in a heading
                if (inHeadingParagraph) {
                    await applyHeadingStyle(inputElement, 0);
                    inHeadingParagraph = false;
                }
            } else if (segment.type === 'text') {
                // Determine desired formatting for this segment
                const desired = {
                    bold:          !!segment.bold,
                    italic:        !!segment.italic,
                    underline:     !!segment.underline,
                    strikethrough: !!segment.strikethrough,
                };
                // Toggle any formats that need to change
                for (const fmt of fmtKeys) {
                    if (desired[fmt] !== active[fmt]) {
                        await toggleFormatting(inputElement, fmt);
                        active[fmt] = desired[fmt];
                        if (cancelTyping) break;
                    }
                }
                if (cancelTyping) break;
                // Type each character in the segment
                const text = segment.text;
                for (let i = 0; i < text.length; i++) {
                    if (cancelTyping) break;
                    const char = text[i];
                    const prevChar = i > 0 ? text[i - 1] : null;
                    const nextChar = i < text.length - 1 ? text[i + 1] : null;
                    if (!(await typeChar(inputElement, char, prevChar, nextChar))) break;
                }
            }
        }
        // Clean up: turn off any still-active formatting
        for (const fmt of fmtKeys) {
            if (active[fmt] && !cancelTyping) {
                await toggleFormatting(inputElement, fmt);
            }
        }
    }
    // --- Typo Helper ---
    function getNearbyKey(char) {
        const keyboardLayout={'q':'wa','w':'qase','e':'wsdr','r':'edft','t':'rfgy','y':'tghu','u':'yhji','i':'ujko','o':'iklp','p':'ol[','a':'qwsz','s':'awedxz','d':'erfcxs','f':'rtgvcd','g':'tyhbvf','h':'yujnbg','j':'uikmnh','k':'iolmj','l':'opk;','z':'asx','x':'zsdc','c':'xdfv','v':'cfgb','b':'vghn','n':'bhjm','m':'njk,','1':'2q`','2':'1qw3','3':'2we4','4':'3er5','5':'4rt6','6':'5ty7','7':'6yu8','8':'7ui9','9':'8io0','0':'9op-','-':'0p[=','=':'-[]','[':'=p]o',']':'[\\;p','\\':']=',';':'lkp\'[]',"'":';l/',',':'mkj.','m':'.', '/':'\'l;.,', '`':'1', ' ':' '};
        const lowerChar = char.toLowerCase(); const adjacent = keyboardLayout[lowerChar];
        if (!adjacent || adjacent.length === 0) return char;
        let attempts = 0; let nearbyChar;
        do { const randomIndex = Math.floor(Math.random() * adjacent.length); nearbyChar = adjacent[randomIndex]; attempts++; } while (nearbyChar === lowerChar && attempts < 5 && adjacent.length > 1)
        return char === char.toUpperCase() && char !== lowerChar ? nearbyChar.toUpperCase() : nearbyChar;
    }
    // --- Initialization ---
    const initInterval = setInterval(() => {
        if (document.getElementById("docs-help-menu") && document.querySelector(".docs-texteventtarget-iframe")) {
            try { if (document.querySelector(".docs-texteventtarget-iframe").contentDocument) { clearInterval(initInterval); initializeScript(); } else { console.log("Human-Typer: Waiting for iframe content access..."); } } catch (e) { console.log("Human-Typer: Waiting for iframe content access (error)..."); }
        } }, 500);
})();
