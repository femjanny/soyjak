// ==UserScript==
// @name         SoyBooru | Nametwink Blocker
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Blur people you don't like. Includes toggles to disable hover, remove tooltips, and features an active on-screen username auto-suggestion engine.
// @match        https://soybooru.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const BLOCK_OPACITY = 1; // Opacity of the block overlay (0.0 to 1.0)
    const FONT_FAMILY = 'monospace'; // Font style (e.g., 'sans-serif', 'Arial', 'monospace')
    const FONT_SIZE = '22px'; // Font size for the "BLOCKED USER" text
    const HOVER_DELAY_SECONDS = 0; // How many seconds to hover before revealing content
    // =======================================================

    const ICON_BAN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4" y1="4" x2="20" y2="20"></line></svg>`;
    const ICON_PLUS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>`;
    const ICON_MINUS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path></svg>`;

    const getBlocked = () => JSON.parse(localStorage.getItem('blockedUsers') || '[]');
    const saveBlocked = (list) => localStorage.setItem('blockedUsers', JSON.stringify(list));
    const norm = (u) => (u ? u.trim().toLowerCase() : '');

    // Get and set persistent states
    const isHoverDisabled = () => localStorage.getItem('disableHoverReveal') === 'true';
    const setHoverDisabled = (state) => localStorage.setItem('disableHoverReveal', state);

    const isTipDisabled = () => localStorage.getItem('disableBlockTooltip') === 'true';
    const setTipDisabled = (state) => localStorage.setItem('disableBlockTooltip', state);

    // ==================== STYLES ====================
    const style = document.createElement('style');
    style.id = 'nametwink-blocker-styles';

    function updateStyles() {
        const hoverRule = isHoverDisabled() ? '' : `
            /* OVERRIDE: Destroys all animations when hovering so the reveal is instant */
            .censor-target:hover::after {
                opacity: 0 !important;
                visibility: hidden !important;
                transition: none !important;
                transition-delay: 0s !important;
            }
        `;

        style.textContent = `
            .censor-target {
                position: relative !important;
                overflow: hidden !important;
            }
            .censor-target::after {
                content: "BLOCKED USER" !important;
                position: absolute !important;
                inset: 0 !important;
                background-color: rgba(30, 30, 30, ${BLOCK_OPACITY}) !important;
                color: rgba(255, 255, 255, 0.7) !important;
                font-family: ${FONT_FAMILY} !important;
                font-size: ${FONT_SIZE} !important;
                font-weight: bold !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: 50 !important;
                cursor: help !important;
                border: 1px dashed rgba(255,255,255,0.3) !important;

                /* Smoothly fade back in when you mouse out */
                opacity: 1 !important;
                visibility: visible !important;
                transition: opacity 0.2s ease, visibility 0.2s ease !important;
                transition-delay: ${HOVER_DELAY_SECONDS}s !important;
            }

            ${hoverRule}

            /* Protect critical layout elements from being censored */
            #post-info-card-content,
            #post-info-container,
            #post-info-row,
            #post-description-container,
            #post-description-section,
            #description-container {
                position: relative !important;
            }
        `;
    }

    updateStyles();
    document.head.appendChild(style);

    function isBlocked(username, blocked) {
        return blocked.map(norm).includes(norm(username));
    }

    function toggleBlur(element, shouldBlock, username) {
        if (!element) return;

        const protectedIds = new Set([
            'post-info-card-content',
            'post-info-container',
            'post-info-row',
            'post-info-left',
            'post-info-card',
            'post-description-container',
            'post-description-section',
            'description-container'
        ]);

        if (protectedIds.has(element.id)) return;

        if (shouldBlock) {
            element.classList.add('censor-target');
            if (username && !isTipDisabled()) {
                element.setAttribute('title', `By ${username}`);
            } else {
                element.removeAttribute('title');
            }
        } else {
            element.classList.remove('censor-target');
            element.removeAttribute('title');
        }
    }

    // ====================== PROCESS DOM ELEMENTS ======================
    function extractUsername(str) {
        if (!str || typeof str !== 'string') return null;
        const match = str.match(/\/user\/([^\/?#]+)/);
        return match ? match[1] : null;
    }

    // Dynamic scanner to harvest all unique visible usernames currently displayed on your monitor
    function scanVisibleUsernames() {
        const names = new Set();

        // Scan links pointing to user profiles
        document.querySelectorAll('a[href*="/user/"]').forEach(a => {
            const u = extractUsername(a.href);
            if (u) names.add(u);
        });

        // Scan images (like user avatars) that embed the name in the source API paths
        document.querySelectorAll('img[src*="/api/user/"]').forEach(img => {
            const u = extractUsername(img.src);
            if (u) names.add(u);
        });

        // Pull from H1 element profile page blocks
        const headerName = document.querySelector('h1 span')?.textContent?.trim();
        if (headerName) names.add(headerName);

        return Array.from(names);
    }

    function applyBlur() {
        const blocked = getBlocked();

        // Main View
        const uploaderDate = document.getElementById('post-uploader-date');
        if (uploaderDate) {
            const uploaderLink = document.getElementById('post-uploader-link');
            const username = uploaderLink ? extractUsername(uploaderLink.href) : null;
            if (username) toggleBlur(uploaderDate, isBlocked(username, blocked), username);
        }

        const approvedBy = document.getElementById('post-approved-by');
        if (approvedBy) {
            const approvedLink = approvedBy.querySelector('a[href^="/user/"]');
            const username = approvedLink ? extractUsername(approvedLink.href) : null;
            if (username) toggleBlur(approvedBy, isBlocked(username, blocked), username);
        }

        const uploaderLink = document.getElementById('post-uploader-link');
        if (uploaderLink) {
            const username = extractUsername(uploaderLink.href);
            if (username) {
                const isB = isBlocked(username, blocked);
                document.querySelectorAll('img[src*="/api/booru/posts/"], video[src*="/api/booru/posts/"]').forEach(el => {
                    if (!el.src.includes('thumbnail')) {
                        toggleBlur(el.parentElement || el, isB, username);
                    }
                });
            }
        }

        // Forum Posts
        document.querySelectorAll('[id^="p"].bg-card').forEach(post => {
            const img = post.querySelector('img[src*="/api/user/"]');
            if (!img) return;
            const user = extractUsername(img.src);
            if (user) toggleBlur(post, isBlocked(user, blocked), user);
        });

        // Comments
        document.querySelectorAll('.comment-item').forEach(comment => {
            const link = comment.querySelector('a[href^="/user/"]');
            if (!link) return;
            const user = extractUsername(link.href);
            if (user) toggleBlur(comment, isBlocked(user, blocked), user);
        });

        // Gallery Cards
        document.querySelectorAll('a[id="post-card-link"]').forEach(card => {
            const img = card.querySelector('img[src*="/api/user/"]');
            if (!img) return;
            const user = extractUsername(img.src);
            if (user) toggleBlur(card, isBlocked(user, blocked), user);
        });

        // Precise Global Avatars
        document.querySelectorAll('img[alt="User avatar"]').forEach(avatar => {
            const user = extractUsername(avatar.src);
            if (!user) return;

            const shouldBlock = isBlocked(user, blocked);
            const preciseTargets = ['#post-uploader-date', '#post-approved-by'];

            for (const sel of preciseTargets) {
                if (avatar.closest(sel)) {
                    const target = document.querySelector(sel);
                    if (target) toggleBlur(target, shouldBlock, user);
                    break;
                }
            }
        });
    }

    // ====================== UI MANAGEMENT ======================
    function renderList() {
        const display = document.getElementById('block-list-display');
        if (!display) return;

        const list = getBlocked();
        display.innerHTML = list.map(u => `
            <div class="flex justify-between items-center py-1 border-b border-border/50">
                <a href="/user/${u}" class="text-blue-400 hover:underline">${u}</a>
                <button class="unblock-btn text-red-500 font-bold hover:underline" data-user="${u}">UNBLOCK</button>
            </div>
        `).join('');

        document.querySelectorAll('.unblock-btn').forEach(btn => {
            btn.onclick = () => {
                const user = btn.dataset.user;
                saveBlocked(getBlocked().filter(x => norm(x) !== norm(user)));
                renderList();
                applyBlur();
            };
        });
    }

    function initNavbar() {
        if (document.getElementById('nav-block-container')) return;

        const nav = document.querySelector('.lg\\:flex.items-center.gap-1.ml-auto');
        if (!nav) return;

        const container = document.createElement('div');
        container.id = 'nav-block-container';
        container.className = 'relative ml-2';

        container.innerHTML = `
            <button id="block-menu-trigger" class="p-1.5 border border-border hover:bg-accent">${ICON_BAN}</button>
            <div id="block-menu-panel" class="hidden absolute right-0 top-full mt-2 w-56 bg-card border border-border shadow-xl z-[9999] p-3 text-xs">
                <div class="font-bold mb-2 border-b flex justify-between items-center pb-1">
                    <span>Blocked Users</span>
                </div>

                <!-- Toggle Switches Container -->
                <div class="mb-3 flex flex-col gap-1.5 bg-accent/30 p-1.5 border border-border/40 select-none">
                    <div class="flex items-center justify-between">
                        <label for="disable-hover-toggle" class="cursor-pointer font-medium text-muted-foreground">Disable Hover Reveal</label>
                        <input type="checkbox" id="disable-hover-toggle" class="cursor-pointer" ${isHoverDisabled() ? 'checked' : ''}>
                    </div>
                    <div class="flex items-center justify-between">
                        <label for="disable-tip-toggle" class="cursor-pointer font-medium text-muted-foreground">Disable Tooltip</label>
                        <input type="checkbox" id="disable-tip-toggle" class="cursor-pointer" ${isTipDisabled() ? 'checked' : ''}>
                    </div>
                </div>

                <input id="new-user-input" placeholder="Username + Enter" class="w-full bg-background border p-1 mb-0.5" autocomplete="off">

                <!-- Dynamic On-Screen Suggestion Label Line -->
                <div id="pretext-hint" class="text-[10px] text-blue-400 font-medium h-4 select-none pl-1 mb-1.5" style="min-height: 14px;"></div>

                <div id="block-list-display" class="max-h-40 overflow-y-auto text-sm"></div>
            </div>
        `;

        nav.appendChild(container);

        const inputEl = document.getElementById('new-user-input');
        const hintEl = document.getElementById('pretext-hint');

        document.getElementById('block-menu-trigger').onclick = (e) => {
            e.stopPropagation();
            const panel = document.getElementById('block-menu-panel');
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) renderList();
        };

        document.getElementById('disable-hover-toggle').onchange = (e) => {
            setHoverDisabled(e.target.checked);
            updateStyles();
        };

        document.getElementById('disable-tip-toggle').onchange = (e) => {
            setTipDisabled(e.target.checked);
            applyBlur();
        };

        // --- ON-SCREEN LIVE SUGGESTION LOGIC ---
        let currentSuggestion = "";

        inputEl.oninput = (e) => {
            const searchVal = e.target.value.trim().toLowerCase();
            if (!searchVal) {
                currentSuggestion = "";
                hintEl.textContent = "";
                return;
            }

            // Gather all users active on the screen right now
            const visibleUsers = scanVisibleUsernames();

            // Find a name that contains or starts with what you typed
            const match = visibleUsers.find(user => user.toLowerCase().includes(searchVal));

            if (match && match.toLowerCase() !== searchVal) {
                currentSuggestion = match;
                hintEl.innerHTML = `Fill: <strong>${match}</strong> <span style="opacity:0.5">(Tab)</span>`;
            } else {
                currentSuggestion = "";
                hintEl.textContent = "";
            }
        };

        inputEl.onkeydown = (e) => {
            // Fill suggestion instantly if user hits Tab
            if (e.key === 'Tab' && currentSuggestion) {
                e.preventDefault();
                e.target.value = currentSuggestion;
                currentSuggestion = "";
                hintEl.textContent = "";
                return;
            }

            if (e.key !== 'Enter') return;
            const val = e.target.value.trim();
            if (!val) return;

            const list = getBlocked();
            if (!list.map(norm).includes(norm(val))) {
                list.push(val);
                saveBlocked(list);
            }
            e.target.value = '';
            currentSuggestion = "";
            hintEl.textContent = "";
            renderList();
            applyBlur();
        };
    }

    function initProfileBlockButton() {
        const username = document.querySelector('h1 span')?.textContent?.trim();
        if (!username) return;

        if (document.getElementById('profile-block-btn')) return;

        const container = document.querySelector('.flex.flex-wrap.gap-2');
        if (!container) return;

        const btn = document.createElement('button');
        btn.id = 'profile-block-btn';
        btn.className = "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium border border-input bg-card shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-accent hover:text-accent-foreground active:bg-muted px-3 rounded-none h-8 text-xs";

        const render = () => {
            const isB = isBlocked(username, getBlocked());
            btn.innerHTML = `${isB ? ICON_MINUS : ICON_PLUS} ${isB ? "Unblock" : "Block"}`;
        };

        btn.onclick = () => {
            let list = getBlocked();
            const exists = isBlocked(username, list);
            list = exists ? list.filter(u => norm(u) !== norm(username)) : [...list, username];
            saveBlocked(list);
            render();
            applyBlur();
        };

        render();
        container.appendChild(btn);
    }

    // ====================== OBSERVER INITIALIZATION ======================

    applyBlur();
    initNavbar();
    initProfileBlockButton();

    const observer = new MutationObserver(() => {
        applyBlur();
        initNavbar();
        initProfileBlockButton();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
