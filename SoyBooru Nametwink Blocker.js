// ==UserScript==
// @name         SoyBooru | Nametwink Blocker
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Blur people you don't like. Fixed to protect description and post info layout with configurable hover delays.
// @match        https://soybooru.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ==================== CONFIGURATION ====================
    const BLOCK_OPACITY = 0.95;       // Opacity of the block overlay (0.0 to 1.0)
    const FONT_FAMILY = 'monospace';  // Font style (e.g., 'sans-serif', 'Arial', 'monospace')
    const FONT_SIZE = '10px';         // Font size for the "BLOCKED USER" text
    const HOVER_DELAY_SECONDS = 0.5;  // How many seconds to hover before revealing content
    // =======================================================

    const ICON_BAN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4" y1="4" x2="20" y2="20"></line></svg>`;
    const ICON_PLUS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>`;
    const ICON_MINUS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path></svg>`;

    const getBlocked = () => JSON.parse(localStorage.getItem('blockedUsers') || '[]');
    const saveBlocked = (list) => localStorage.setItem('blockedUsers', JSON.stringify(list));
    const norm = (u) => (u ? u.trim().toLowerCase() : '');

    // ==================== STYLES ====================
    const style = document.createElement('style');
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
            
            /* Setup smooth hover transition */
            opacity: 1 !important;
            visibility: visible !important;
            transition: opacity 0.2s ease, visibility 0.2s ease !important;
            transition-delay: ${HOVER_DELAY_SECONDS}s !important;
        }
        .censor-target:hover::after {
            opacity: 0 !important;
            visibility: hidden !important;
        }

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
    document.head.appendChild(style);

    function isBlocked(username, blocked) {
        return blocked.map(norm).includes(norm(username));
    }

    function toggleBlur(element, shouldBlock) {
        if (!element) return;

        // HARD BLACKLIST - never censor these containers
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
        } else {
            element.classList.remove('censor-target');
        }
    }

    function extractUsername(str) {
        if (!str || typeof str !== 'string') return null;
        const match = str.match(/\/user\/([^\/?#]+)/);
        return match ? match[1] : null;
    }

    // ====================== MAIN POST PAGE ======================
    function processMainPostView(blocked) {
        // Uploader section
        const uploaderDate = document.getElementById('post-uploader-date');
        if (uploaderDate) {
            const uploaderLink = document.getElementById('post-uploader-link');
            const username = uploaderLink ? extractUsername(uploaderLink.href) : null;
            if (username) {
                toggleBlur(uploaderDate, isBlocked(username, blocked));
            }
        }

        // Approved by section
        const approvedBy = document.getElementById('post-approved-by');
        if (approvedBy) {
            const approvedLink = approvedBy.querySelector('a[href^="/user/"]');
            const username = approvedLink ? extractUsername(approvedLink.href) : null;
            if (username) {
                toggleBlur(approvedBy, isBlocked(username, blocked));
            }
        }

        // Main media (image/video)
        const uploaderLink = document.getElementById('post-uploader-link');
        if (uploaderLink) {
            const username = extractUsername(uploaderLink.href);
            if (username) {
                const isB = isBlocked(username, blocked);
                document.querySelectorAll('img[src*="/api/booru/posts/"], video[src*="/api/booru/posts/"]').forEach(el => {
                    if (!el.src.includes('thumbnail')) {
                        toggleBlur(el.parentElement || el, isB);
                    }
                });
            }
        }
    }

    // ====================== OTHER SECTIONS ======================
    function processForumPosts(blocked) {
        document.querySelectorAll('[id^="p"].bg-card').forEach(post => {
            const img = post.querySelector('img[src*="/api/user/"]');
            if (!img) return;
            const user = extractUsername(img.src);
            if (user) toggleBlur(post, isBlocked(user, blocked));
        });
    }

    function processComments(blocked) {
        document.querySelectorAll('.comment-item').forEach(comment => {
            const link = comment.querySelector('a[href^="/user/"]');
            if (!link) return;
            const user = extractUsername(link.href);
            if (user) toggleBlur(comment, isBlocked(user, blocked));
        });
    }

    function processGalleryCards(blocked) {
        document.querySelectorAll('a[id="post-card-link"]').forEach(card => {
            const img = card.querySelector('img[src*="/api/user/"]');
            if (!img) return;
            const user = extractUsername(img.src);
            if (user) toggleBlur(card, isBlocked(user, blocked));
        });
    }

    function processGlobalAvatars(blocked) {
        document.querySelectorAll('img[alt="User avatar"]').forEach(avatar => {
            const user = extractUsername(avatar.src);
            if (!user) return;

            const shouldBlock = isBlocked(user, blocked);

            // Precise targeting only
            const preciseTargets = [
                '#post-uploader-date',
                '#post-approved-by'
            ];

            let target = null;
            for (const sel of preciseTargets) {
                if (avatar.closest(sel)) {
                    target = document.querySelector(sel);
                    break;
                }
            }

            if (target) {
                toggleBlur(target, shouldBlock);
            }
        });
    }

    // Master run
    function applyBlur() {
        const blocked = getBlocked();
        processMainPostView(blocked);
        processForumPosts(blocked);
        processComments(blocked);
        processGalleryCards(blocked);
        processGlobalAvatars(blocked);
    }

    // ====================== UI ======================
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
                <div class="font-bold mb-2 border-b">Blocked Users</div>
                <input id="new-user-input" placeholder="Username + Enter" class="w-full bg-background border p-1 mb-2">
                <div id="block-list-display" class="max-h-40 overflow-y-auto text-sm"></div>
            </div>
        `;

        nav.appendChild(container);

        document.getElementById('block-menu-trigger').onclick = (e) => {
            e.stopPropagation();
            const panel = document.getElementById('block-menu-panel');
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) renderList();
        };

        document.getElementById('new-user-input').onkeydown = (e) => {
            if (e.key !== 'Enter') return;
            const val = e.target.value.trim();
            if (!val) return;

            const list = getBlocked();
            if (!list.map(norm).includes(norm(val))) {
                list.push(val);
                saveBlocked(list);
            }
            e.target.value = '';
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

    // ====================== RUN ======================
    setTimeout(() => {
        const loop = () => {
            applyBlur();
            requestAnimationFrame(loop);
        };
        loop();

        setInterval(() => {
            initNavbar();
            initProfileBlockButton();
        }, 800);
    }, 800);

})();
