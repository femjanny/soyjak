// ==UserScript==
// @name         Soyjak | Up-Drop Draggable Formatting Helper
// @namespace    https://soyjak.st/
// @version      5.5.1
// @description  Up-drop style formatting tab. Renders content above the tab with an attached reset button when dragged.
// @match        https://soyjak.st/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    //////////////////////////////////////////////////////
    // CUSTOMIZATION & STYLES (Black Normal Text + Glow)
    //////////////////////////////////////////////////////

    const STYLES = {
        glow: "color: #000000 !important; font-weight: normal !important; text-shadow: 0 0 4px #00fe20, 0 0 10px #00fe20;",
        sneed: "color: #000000 !important; font-weight: normal !important; text-shadow: 0 0 4px #fffb00, 0 0 10px #fffb00;",
        blueglow: "color: #000000 !important; font-weight: normal !important; text-shadow: 0 0 4px #36d7f7, 0 0 10px #36d7f7;",

        red: "color:#af0a0f; font-weight:bold;",
        blue: "color:#2424ad; font-weight:bold;",
        purple: "color:#720b98; font-weight:bold;",

        orange: "color:#f6750b;",
        green: "color:#789922;",
        lightblue: "color:#6577E6;",

        oy: "background:#faf8f8; color:#3060a8; padding: 0 2px;",

        doll: "color:#FD3D98; font-weight:bold;",

        code: "font-family:monospace; background:rgba(0,0,0,0.1); padding:1px 3px; border: 1px solid rgba(0,0,0,0.2);",
        big: "font-size:1.2em; font-weight:bold;",

        bold: "font-weight:bold;",
        italic: "font-style:italic;",
        strike: "text-decoration:line-through;",
        underline: "text-decoration:underline;"
    };

    const BUTTONS = [
        ["%%Glow%%", "%%", "%%", "glow"],
        ["::Sneed::", "::", "::", "sneed"],
        [";;BlueGlow;;", ";;", ";;", "blueglow"],
        ["==Red==", "==", "==", "red"],
        ["--Blue--", "--", "--", "blue"],
        ["-=Purple=-", "-=", "-=", "purple"],
        ["<", "<", "", "orange"],
        [">", ">", "", "green"],
        ["^", "^", "", "lightblue"],
        ["(((Oy)))", "(((", ")))", "oy"],
        ["'''Bold'''", "'''", "'''", "bold"],
        ["''Italic''", "''", "''", "italic"],
        ["~~Strike~~", "~~", "~~", "strike"],
        ["__Underline__", "__", "__", "underline"],
        ["**Spoiler**", "**", "**", "spoiler"],
        ["```Code```", "```", "```", "code"],
        ["+=Big=+", "+=", "=+", "big"],
        ["-~-Doll-~-", "-~-", "-~-", "doll"]
    ];

    function renderMarkup(text) {
        text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        text = text.replace(/%%(.*?)%%/gs, `<span style="${STYLES.glow}">$1</span>`);
        text = text.replace(/::(.*?)::/gs, `<span style="${STYLES.sneed}">$1</span>`);
        text = text.replace(/;;(.*?);;/gs, `<span style="${STYLES.blueglow}">$1</span>`);
        text = text.replace(/==(.*?)==/gs, `<span style="${STYLES.red}">$1</span>`);
        text = text.replace(/--(.*?)--/gs, `<span style="${STYLES.blue}">$1</span>`);
        text = text.replace(/-=(.*?)-=/gs, `<span style="${STYLES.purple}">$1</span>`);
        text = text.replace(/^&lt;(.*?)$/gm, `<span style="${STYLES.orange}">&lt;$1</span>`);
        text = text.replace(/^&gt;(.*?)$/gm, `<span style="${STYLES.green}">&gt;$1</span>`);
        text = text.replace(/^\^(.*?)$/gm, `<span style="${STYLES.lightblue}">^$1</span>`);
        text = text.replace(/\(\(\((.*?)\)\)\)/gs, `<span style="${STYLES.oy}">((($1)))</span>`);
        text = text.replace(/-~-(.*?)-~-/gs, `<span style="${STYLES.doll}">$1</span>`);
        text = text.replace(/\+=(.*?)=\+/gs, `<span style="${STYLES.big}">$1</span>`);
        text = text.replace(/'''(.*?)'''/gs, `<span style="${STYLES.bold}">$1</span>`);
        text = text.replace(/''(.*?)''/gs, `<span style="${STYLES.italic}">$1</span>`);
        text = text.replace(/~~(.*?)~~/gs, `<span style="${STYLES.strike}">$1</span>`);
        text = text.replace(/__(.*?)__/gs, `<span style="${STYLES.underline}">$1</span>`);
        text = text.replace(/\*\*(.*?)\*\*/gs, `<span class="soy-spoiler">$1</span>`);
        text = text.replace(/```(.*?)```/gs, `<span style="${STYLES.code}">$1</span>`);
        return text.replace(/\n/g, "<br>");
    }

    let activeTextarea = null;
    document.addEventListener('focusin', (e) => {
        if (e.target && (e.target.name === 'body' || e.target.id === 'body')) {
            activeTextarea = e.target;
            if (window.updatePreview) window.updatePreview();
        }
    });

    function wrap(left, right) {
        if (!activeTextarea) activeTextarea = document.querySelector("textarea[name='body'], textarea#body");
        if (!activeTextarea) return;
        const start = activeTextarea.selectionStart;
        const end = activeTextarea.selectionEnd;
        const selected = activeTextarea.value.substring(start, end);
        activeTextarea.setRangeText(left + selected + right, start, end, "end");
        activeTextarea.dispatchEvent(new Event('input'));
        activeTextarea.focus();
    }

    function createUpdropSystem() {
        if (document.getElementById('soy-tab-wrapper')) return;

        let previewEnabled = localStorage.getItem('soy-preview-enabled') !== 'false';
        let panelIsOpen = localStorage.getItem('soy-panel-open') === 'true';
        let isDragged = localStorage.getItem('soy-tab-dragged') === 'true';

        let defaultBorder = "#343434";
        let purpleThemeHeader = "#9988EE";
        const cellSample = document.querySelector("th, td");
        const textareaSample = document.querySelector("textarea");

        if (cellSample) {
            const computedStyle = window.getComputedStyle(cellSample);
            purpleThemeHeader = computedStyle.backgroundColor || purpleThemeHeader;
            defaultBorder = computedStyle.borderColor || computedStyle.borderTopColor || defaultBorder;
        }

        // Main UI window element wrapper setup to stack content direction vertically upwards
        const uiWrapper = document.createElement("div");
        uiWrapper.id = "soy-tab-wrapper";
        uiWrapper.style.cssText = `
            position: fixed; z-index: 9999; display: flex; flex-direction: column-reverse; align-items: flex-end; width: 250px;
        `;

        // Interactive control strip containing the toggle and attached reset button
        const tabRow = document.createElement("div");
        tabRow.style.cssText = `
            display: flex; align-items: stretch; border: 1px solid ${defaultBorder}; 
            background: ${purpleThemeHeader}; color: ${cellSample ? window.getComputedStyle(cellSample).color : '#000000'};
            font-size: 10px; font-weight: bold; border-radius: 0px; user-select: none; flex-grow: 0; margin-top: 2px;
        `;

        const resetBtn = document.createElement("div");
        resetBtn.textContent = "Reset";
        resetBtn.style.cssText = `
            padding: 4px 6px; cursor: pointer; border-right: 1px solid ${defaultBorder};
            background: rgba(0,0,0,0.1); display: ${isDragged ? 'block' : 'none'};
        `;

        const collapsedTab = document.createElement("div");
        collapsedTab.id = "soy-sidebar-collapsed-tab";
        collapsedTab.style.cssText = `padding: 4px 6px; cursor: move; flex-grow: 1; text-align: center;`;
        
        tabRow.appendChild(resetBtn);
        tabRow.appendChild(collapsedTab);
        uiWrapper.appendChild(tabRow);

        // Core content engine area expanding ABOVE the formatting tab wrapper
        const contentContainer = document.createElement("div");
        contentContainer.style.cssText = `
            width: 100%; box-sizing: border-box;
            background: ${window.getComputedStyle(document.body).backgroundColor || 'inherit'};
            border: 1px solid ${defaultBorder};
            display: ${panelIsOpen ? 'flex' : 'none'}; flex-direction: column;
            border-radius: 0px; box-shadow: 1px 1px 4px rgba(0,0,0,0.15);
        `;

        const mainContentWrapper = document.createElement("div");
        mainContentWrapper.style.cssText = `padding: 4px; display: flex; flex-direction: column; gap: 4px; box-sizing: border-box;`;

        const toolbar = document.createElement("div");
        toolbar.style.cssText = `display: flex; flex-wrap: wrap; gap: 2px; box-sizing: border-box;`;

        BUTTONS.forEach(btn => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "soy-helper-btn";
            b.style.cssText = `
                background: ${textareaSample ? window.getComputedStyle(textareaSample).backgroundColor : 'transparent'};
                color: ${textareaSample ? window.getComputedStyle(textareaSample).color : 'inherit'};
                border: 1px solid ${defaultBorder}; padding: 2px 5px; cursor: pointer; font-family: inherit; font-size: 10px;
                display: inline-flex; align-items: center; justify-content: center; border-radius: 0px; user-select: none; margin: 0;
            `;
            const effectSpan = document.createElement("span");
            effectSpan.textContent = btn[0];
            if (btn[3] === "spoiler") {
                effectSpan.className = "soy-spoiler";
            } else if (STYLES[btn[3]]) {
                effectSpan.style.cssText = STYLES[btn[3]];
            }
            b.appendChild(effectSpan);
            b.onclick = (e) => { e.preventDefault(); wrap(btn[1], btn[2]); };
            toolbar.appendChild(b);
        });
        mainContentWrapper.appendChild(toolbar);

        const preview = document.createElement("div");
        preview.style.cssText = `
            padding: 4px; min-height: 50px; max-height: 140px; white-space: normal; box-sizing: border-box; overflow-y: auto;
            font-family: inherit; font-size: 11px; border-radius: 0px; color: ${textareaSample ? window.getComputedStyle(textareaSample).color : 'inherit'};
            display: ${previewEnabled ? 'block' : 'none'};
        `;
        mainContentWrapper.appendChild(preview);

        const controlsRow = document.createElement("div");
        controlsRow.style.cssText = `display: flex; justify-content: flex-end; align-items: center; box-sizing: border-box; margin-top: 2px;`;

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "soy-helper-btn";
        toggleBtn.style.cssText = `
            background: ${textareaSample ? window.getComputedStyle(textareaSample).backgroundColor : 'transparent'};
            color: ${textareaSample ? window.getComputedStyle(textareaSample).color : 'inherit'};
            border: 1px solid ${defaultBorder}; padding: 1px 4px; cursor: pointer; font-family: inherit; font-size: 9px; font-weight: bold; border-radius: 0px;
        `;
        function updateToggleBtnUI() {
            toggleBtn.textContent = previewEnabled ? "[ Pvw: ON ]" : "[ Pvw: OFF ]";
            toggleBtn.style.opacity = previewEnabled ? "1" : "0.5";
        }
        updateToggleBtnUI();

        toggleBtn.onclick = (e) => {
            e.preventDefault();
            previewEnabled = !previewEnabled;
            localStorage.setItem('soy-preview-enabled', previewEnabled);
            preview.style.display = previewEnabled ? 'block' : 'none';
            updateToggleBtnUI();
            window.updatePreview();
        };

        controlsRow.appendChild(toggleBtn);
        mainContentWrapper.appendChild(controlsRow);
        contentContainer.appendChild(mainContentWrapper);
        uiWrapper.appendChild(contentContainer);
        document.body.appendChild(uiWrapper);

        function updateTabLabel() {
            collapsedTab.textContent = panelIsOpen ? "▼ Formatting" : "▲ Formatting";
        }
        updateTabLabel();

        // Location Recovery Engine
        const savedX = localStorage.getItem('soy-dropdown-x');
        const savedY = localStorage.getItem('soy-dropdown-y');
        if (savedX !== null && savedY !== null) {
            uiWrapper.style.left = savedX;
            uiWrapper.style.top = savedY;
            uiWrapper.style.right = 'auto';
        } else {
            resetToHomeLocation();
        }

        window.updatePreview = function() {
            if (!previewEnabled) return;
            const targetBox = activeTextarea || document.querySelector("textarea[name='body'], textarea#body");
            if (targetBox) preview.innerHTML = renderMarkup(targetBox.value);
        };

        function resetToHomeLocation() {
            localStorage.removeItem('soy-dropdown-x');
            localStorage.removeItem('soy-dropdown-y');
            localStorage.removeItem('soy-tab-dragged');
            isDragged = false;
            resetBtn.style.display = "none";
            uiWrapper.style.left = 'auto';
            uiWrapper.style.right = '0px';
            uiWrapper.style.top = '120px';
        }

        resetBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            resetToHomeLocation();
        };

        //////////////////////////////////////////////////////
        // INTEGRATED MOUSE TRACKING ENGINE
        //////////////////////////////////////////////////////

        let posX = 0, posY = 0, mouseX = 0, mouseY = 0;
        let executionMoved = false;

        collapsedTab.onmousedown = function(e) {
            e = e || window.event;
            e.preventDefault();
            executionMoved = false;
            mouseX = e.clientX;
            mouseY = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        };

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            executionMoved = true;
            posX = mouseX - e.clientX;
            posY = mouseY - e.clientY;
            mouseX = e.clientX;
            mouseY = e.clientY;

            uiWrapper.style.top = (uiWrapper.offsetTop - posY) + "px";
            uiWrapper.style.left = (uiWrapper.offsetLeft - posX) + "px";
            uiWrapper.style.right = "auto";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;

            if (executionMoved) {
                isDragged = true;
                localStorage.setItem('soy-tab-dragged', 'true');
                localStorage.setItem('soy-dropdown-x', uiWrapper.style.left);
                localStorage.setItem('soy-dropdown-y', uiWrapper.style.top);
                resetBtn.style.display = "block";
            } else {
                panelIsOpen = !panelIsOpen;
                localStorage.setItem('soy-panel-open', panelIsOpen ? 'true' : 'false');
                contentContainer.style.display = panelIsOpen ? 'flex' : 'none';
                updateTabLabel();
                window.updatePreview();
            }
        }

        document.addEventListener('input', (e) => {
            if (e.target && (e.target.name === 'body' || e.target.id === 'body')) {
                activeTextarea = e.target;
                window.updatePreview();
            }
        });

        window.updatePreview();
    }

    function injectCSS() {
        if (document.getElementById('soy-helper-css')) return;
        const style = document.createElement("style");
        style.id = 'soy-helper-css';
        style.textContent = `
            .soy-spoiler { background: #000000; color: #000000; transition: .12s; padding: 1px 2px; border-radius: 0px; }
            .soy-spoiler:hover { color: #ffffff; }
            .soy-helper-btn { font-family: inherit; }
            .soy-helper-btn:hover { filter: brightness(0.93); }
            @media (prefers-color-scheme: dark) { .soy-helper-btn:hover { filter: brightness(1.15); } }
        `;
        document.head.appendChild(style);
    }

    function startSafely() {
        if (!document.body || !document.head) {
            setTimeout(startSafely, 100);
            return;
        }
        injectCSS();
        createUpdropSystem();

        new MutationObserver(createUpdropSystem).observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    startSafely();

})();
