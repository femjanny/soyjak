// ==UserScript==
// @name         SoyBooru | Nametwink Blocker
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  blur people you don't like.
// @match        https://soybooru.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const ICON_BAN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4" y1="4" x2="20" y2="20"></line></svg>`;
    const ICON_PLUS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"></path></svg>`;
    const ICON_MINUS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path></svg>`;

    const getBlocked = () => JSON.parse(localStorage.getItem('blockedUsers') || '[]');
    const saveBlocked = (list) => localStorage.setItem('blockedUsers', JSON.stringify(list));
    const norm = (u) => (u ? u.trim().toLowerCase() : '');

    // ---------------- STYLES (OVERLAY COVER-UP TO PREVENT BLEEDING) ----------------
    const style = document.createElement('style');
    style.textContent = `
        .censor-target {
            position: relative !important;
        }
        .censor-target::after {
            content: "BLOCKED USER" !important;
            position: absolute !important;
            inset: 0 !important;
            background-color: rgba(30, 30, 30, 0.95) !important;
            color: rgba(255, 255, 255, 0.6) !important;
            font-family: monospace !important;
            font-size: 11px !important;
            font-weight: bold !important;
            letter-spacing: 1px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 50 !important;
            cursor: help !important;
            border: 1px dashed rgba(255, 255, 255, 0.2) !important;
        }
        .censor-target:hover::after {
            display: none !important;
        }
    `;
    document.head.appendChild(style);

    function isBlocked(username, blocked) {
        return blocked.map(norm).includes(norm(username));
    }

    function toggleBlur(element, condition) {
        if (!element) return;
        
        // HARD BLACKLIST: Completely protects the main layout elements from ever being touched
        const blacklist = [
            'post-comments-card', 
            'post-comments-content', 
            'post-comments-section', 
            'post-comments-list'
        ];
        if (blacklist.includes(element.id)) return;
        
        if (condition) {
            element.classList.add('censor-target');
        } else {
            element.classList.remove('censor-target');
        }
    }

    // Extraction helper using splitting to bypass linter syntax issues
    function extractUsername(url) {
        if (!url || typeof url !== 'string') return null;
        if (url.indexOf('/user/') !== -1) {
            const rightHalf = url.split('/user/')[1];
            if (rightHalf) {
                return rightHalf.split(/[\/?#]/)[0];
            }
        }
        return null;
    }

    // ---------------- DEDICATED SECTIONS ----------------

    // 1. FORUM POSTS
    function processForumPosts(blocked) {
        const forumPosts = document.querySelectorAll('[id^="p"].bg-card');
        forumPosts.forEach(post => {
            const avatarImg = post.querySelector('img[src*="/api/user/"]');
            if (!avatarImg) return;

            const username = extractUsername(avatarImg.getAttribute('src'));
            if (username && isBlocked(username, blocked)) {
                toggleBlur(post, true);
            } else {
                toggleBlur(post, false);
            }
        });
    }

    // 2. STANDARD COMMENTS
    function processStandardComments(blocked) {
        const comments = document.querySelectorAll('.comment-item');
        comments.forEach(comment => {
            const authorLink = comment.querySelector('a[href^="/user/"]');
            if (!authorLink) return;

            const username = extractUsername(authorLink.getAttribute('href'));

            if (username && isBlocked(username, blocked)) {
                toggleBlur(comment, true);
            } else {
                toggleBlur(comment, false);
            }
        });
    }

    // 3. GALLERY / FEED CARDS
    function processGalleryCards(blocked) {
        const cards = document.querySelectorAll('a[id="post-card-link"]');
        cards.forEach(card => {
            const avatarImg = card.querySelector('img[src*="/api/user/"]');
            if (!avatarImg) return;

            const username = extractUsername(avatarImg.getAttribute('src'));
            if (username && isBlocked(username, blocked)) {
                toggleBlur(card, true);
            } else {
                toggleBlur(card, false);
            }
        });
    }

    // 4. MAIN POST MEDIA
    function processMainPostView(blocked) {
        const uploaderLink = document.querySelector('#post-info-left #post-uploader-link');
        if (!uploaderLink) return;

        let username = extractUsername(uploaderLink.getAttribute('href'));
        if (!username && uploaderLink.textContent) {
            username = uploaderLink.textContent.trim();
        }

        if (username) {
            const isB = isBlocked(username, blocked);
            const mainMedia = document.querySelectorAll('img[src*="/api/booru/posts/"], video[src*="/api/booru/posts/"]');
            mainMedia.forEach(media => {
                if (!media.src.includes('thumbnail')) {
                    toggleBlur(media, isB);
                }
            });
        }
    }

    // 5. GLOBAL AVATARS
    function processGlobalAvatars(blocked) {
        document.querySelectorAll('img[alt="User avatar"]').forEach(avatar => {
            const username = extractUsername(avatar.getAttribute('src'));
            if (username) {
                const targetBlocked = isBlocked(username, blocked);
                
                // Target the exact targeted element parent blocks
                const commentContainer = avatar.closest('.comment-item') || avatar.closest('[id^="p"].bg-card') || avatar.closest('a[id="post-card-link"]');
                
                if (commentContainer) {
                    toggleBlur(commentContainer, targetBlocked);
                } else {
                    // Safety check on backup wrapper fallback
                    const parent = avatar.parentElement;
                    if (parent && !['post-comments-card', 'post-comments-content', 'post-comments-section'].includes(parent.id)) {
                        toggleBlur(parent, targetBlocked);
                    }
                }
            }
        });
    }

    // Master execution block
    function applyBlur() {
        const blocked = getBlocked();
        processForumPosts(blocked);
        processStandardComments(blocked);
        processGalleryCards(blocked);
        processMainPostView(blocked);
        processGlobalAvatars(blocked);
    }

    // ---------------- UI & INITIALIZATION ----------------
    function renderList() {
        const display = document.getElementById('block-list-display');
        if (!display) return;

        const list = getBlocked();
        display.innerHTML = list.map(u => {
            const safe = u;
            return `
            <div class="flex justify-between items-center py-1 border-b border-border/50">
                <a href="/user/${safe}" class="text-blue-400 hover:underline">${safe}</a>
                <button class="unblock-btn text-red-500 font-bold hover:underline" data-user="${safe}">UNBLOCK</button>
            </div>`;
        }).join('');

        document.querySelectorAll('.unblock-btn').forEach(btn => {
            btn.onclick = () => {
                const user = btn.dataset.user;
                saveBlocked(getBlocked().filter(x => norm(x) !== norm(user)));
                renderList();
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
                <input id="new-user-input" placeholder="Type username & press Enter" class="w-full bg-background border p-1 mb-2">
                <div id="block-list-display" class="max-h-40 overflow-y-auto"></div>
            </div>
        `;

        nav.appendChild(container);

        document.getElementById('block-menu-trigger').onclick = (e) => {
            e.stopPropagation();
            const panel = document.getElementById('block-menu-panel');
            if (panel.classList.contains('hidden')) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
            renderList();
        };

        document.getElementById('new-user-input').onkeydown = (e) => {
            if (e.key !== 'Enter') return;
            const val = e.target.value.trim();
            if (!val) return;

            const list = getBlocked();
            if (!list.map(norm).includes(norm(val))) list.push(val);

            saveBlocked(list);
            e.target.value = '';
            renderList();
        };
    }

    function getProfileUsername() {
        const h1 = document.querySelector('h1 span');
        if (h1 && h1.textContent) {
            return h1.textContent.trim();
        }
        return null;
    }

    function initProfileBlockButton() {
        const username = getProfileUsername();
        if (!username) return;

        const container = document.querySelector('.flex.flex-wrap.gap-2');
        if (!container) return;
        if (document.getElementById('profile-block-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'profile-block-btn';
        btn.className = "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium border border-input bg-card shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-accent hover:text-accent-foreground active:bg-muted px-3 rounded-none h-8 text-xs";

        function render() {
            const blocked = getBlocked();
            const isB = isBlocked(username, blocked);
            btn.innerHTML = `${isB ? ICON_MINUS : ICON_PLUS} ${isB ? "Unblock" : "Block"}`;
        }

        btn.onclick = () => {
            const blocked = getBlocked();
            const exists = isBlocked(username, blocked);
            let updated = exists ? blocked.filter(u => norm(u) !== norm(username)) : [...blocked, username];

            saveBlocked(updated);
            render();
            applyBlur();
        };

        render();
        container.appendChild(btn);
    }

    // ---------------- EXECUTION LOOP ----------------
    setTimeout(() => {
        function loop() {
            applyBlur();
            requestAnimationFrame(loop);
        }
        loop();

        setInterval(() => {
            initNavbar();
            initProfileBlockButton();
        }, 1000);
    }, 1000);

})();
