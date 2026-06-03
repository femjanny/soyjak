// ==UserScript==
// @name         Soyjak | Formatting Helper
// @namespace    https://soyjak.st/
// @version      2.3
// @description  Theme-native square formatting buttons + black-core normal weight glow live preview
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
        // Explicitly set to normal weight so nothing inherits bolding rules
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

    //////////////////////////////////////////////////////
    // BUTTON DEFINITIONS
    //////////////////////////////////////////////////////

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

        ["[[Oy]]", "[[", "]]", "oy"],

        ["'''Bold'''", "'''", "'''", "bold"],
        ["''Italic''", "''", "''", "italic"],
        ["~~Strike~~", "~~", "~~", "strike"],
        ["__Underline__", "__", "__", "underline"],

        ["**Spoiler**", "**", "**", "spoiler"],
        ["```Code```", "```", "```", "code"],
        ["+=Big=+", "+=", "=+", "big"],

        ["-~-Doll-~-", "-~-", "-~-", "doll"]
    ];

    //////////////////////////////////////////////////////
    // MARKUP PARSER
    //////////////////////////////////////////////////////

    function renderMarkup(text) {
        text = text.replace(/&/g, "&amp;");
        text = text.replace(/</g, "&lt;");
        text = text.replace(/>/g, "&gt;");

        // Removed strong/bold tags from the replacements entirely
        text = text.replace(/%%(.*?)%%/gs, `<span style="${STYLES.glow}">$1</span>`);
        text = text.replace(/::(.*?)::/gs, `<span style="${STYLES.sneed}">$1</span>`);
        text = text.replace(/;;(.*?);;/gs, `<span style="${STYLES.blueglow}">$1</span>`);

        text = text.replace(/==(.*?)==/gs, `<span style="${STYLES.red}">$1</span>`);
        text = text.replace(/--(.*?)--/gs, `<span style="${STYLES.blue}">$1</span>`);
        text = text.replace(/-=(.*?)-=/gs, `<span style="${STYLES.purple}">$1</span>`);

        text = text.replace(/^&lt;(.*?)$/gm, `<span style="${STYLES.orange}">&lt;$1</span>`);
        text = text.replace(/^&gt;(.*?)$/gm, `<span style="${STYLES.green}">&gt;$1</span>`);
        text = text.replace(/^\^(.*?)$/gm, `<span style="${STYLES.lightblue}">^$1</span>`);

        text = text.replace(/\[\[(.*?)\]\]/gs, `<span style="${STYLES.oy}">[[$1]]</span>`);
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

    //////////////////////////////////////////////////////
    // INSERT HELPER
    //////////////////////////////////////////////////////

    function wrap(textarea, left, right) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.substring(start, end);

        textarea.setRangeText(left + selected + right, start, end, "end");
        textarea.dispatchEvent(new Event('input'));
        textarea.focus();
    }

    //////////////////////////////////////////////////////
    // UI SETUP & LIVE NATIVE CSS MATCHING
    //////////////////////////////////////////////////////

    function setup(textarea) {
        if (textarea.dataset.soyHelper) return;
        textarea.dataset.soyHelper = "1";

        textarea.style.boxSizing = "border-box";

        const taStyle = window.getComputedStyle(textarea);
        const currentBg = taStyle.backgroundColor || "inherit";
        const currentFg = taStyle.color || "inherit";
        const currentBd = taStyle.borderTopColor || "rgba(0,0,0,0.2)";

        const preview = document.createElement("div");
        preview.style.cssText = `
            border: 1px solid ${currentBd};
            background: ${currentBg};
            color: ${currentFg};
            padding: 6px;
            margin-bottom: 6px;
            min-height: 60px;
            white-space: normal;
            box-sizing: border-box;
            overflow-y: auto;
            font-family: inherit;
            border-radius: 0px;
        `;

        const toolbar = document.createElement("div");
        toolbar.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin-bottom: 5px;
            box-sizing: border-box;
        `;

        BUTTONS.forEach(btn => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "soy-helper-btn";

            b.style.cssText = `
                background: ${currentBg};
                color: ${currentFg};
                border: 1px solid ${currentBd};
                padding: 3px 7px;
                cursor: pointer;
                font-family: inherit;
                font-size: 11px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 0px;
                user-select: none;
                box-shadow: 0 1px 1px rgba(0,0,0,0.1);
                transition: background-color 0.1s, border-color 0.1s;
            `;

            const effectSpan = document.createElement("span");
            effectSpan.textContent = btn[0];

            if (btn[3] === "spoiler") {
                effectSpan.className = "soy-spoiler";
            } else if (STYLES[btn[3]]) {
                effectSpan.style.cssText = STYLES[btn[3]];
            }

            b.appendChild(effectSpan);
            b.onclick = (e) => {
                e.preventDefault();
                wrap(textarea, btn[1], btn[2]);
            };
            toolbar.appendChild(b);
        });

        textarea.parentNode.insertBefore(toolbar, textarea);
        textarea.parentNode.insertBefore(preview, textarea);

        const resizeObserver = new ResizeObserver(() => {
            const computedWidth = window.getComputedStyle(textarea).width;
            preview.style.width = computedWidth;
            toolbar.style.width = computedWidth;
        });
        resizeObserver.observe(textarea);

        function update() {
            preview.innerHTML = renderMarkup(textarea.value);
        }

        textarea.addEventListener("input", update);
        update();
    }

    //////////////////////////////////////////////////////
    // INITIALIZATION & SAFETY LOOP
    //////////////////////////////////////////////////////

    function injectCSS() {
        if (document.getElementById('soy-helper-css')) return;
        const style = document.createElement("style");
        style.id = 'soy-helper-css';
        style.textContent = `
            .soy-spoiler {
                background: #000000;
                color: #000000;
                transition: .12s;
                padding: 1px 2px;
                border-radius: 0px;
            }
            .soy-spoiler:hover {
                color: #ffffff;
            }
            .soy-helper-btn:hover {
                filter: brightness(1.08) contrast(1.05);
                border-color: rgba(0,0,0,0.35) !important;
            }
            @media (prefers-color-scheme: dark) {
                .soy-helper-btn:hover {
                    filter: brightness(1.2);
                    border-color: rgba(255,255,255,0.25) !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function scan() {
        document.querySelectorAll("textarea[name='body'], textarea#body").forEach(setup);
    }

    function startSafely() {
        if (!document.body || !document.head) {
            setTimeout(startSafely, 100);
            return;
        }

        injectCSS();
        scan();

        new MutationObserver(scan).observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    startSafely();

})();
