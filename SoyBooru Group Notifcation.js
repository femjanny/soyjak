// ==UserScript==
// @name         Soybooru New Message Notifications
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Sends desktop notifications for new chat messages with group names and image post IDs. (Leave Tab Open)
// @author       You
// @match        *://*.soybooru.com/messages/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    let isMuted = GM_getValue("soy_notif_muted", false);
    const seenMessages = new Set();

    // Ask for permission to show desktop notifications when the page loads
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }

    // Remember messages already on screen so we don't alert for old messages
    function cacheExistingMessages() {
        document.querySelectorAll('div[id^="m"]').forEach(el => {
            if (el.id) seenMessages.add(el.id);
        });
    }

    // Process a new message and trigger the notification
    function handleNewMessage(msgElement) {
        // DONT notify if muted, missing elements, or if you are already looking at the active chat tab
        if (isMuted || !msgElement || (document.hasFocus() && document.visibilityState === 'visible')) {
            return;
        }

        let loops = 0;
        const maxLoops = 25;

        // Wait up to 500ms for the chat to finish rendering the user text in the DOM
        const checkInterval = setInterval(() => {
            loops++;

            // Cancel if the user clicks back into the chat window while waiting
            if (document.hasFocus() && document.visibilityState === 'visible') {
                clearInterval(checkInterval);
                return;
            }

            const userSpan = msgElement.querySelector('a[href^="/user/"] span');
            const username = userSpan ? userSpan.textContent.trim() : "";

            if (username.length > 0 || loops >= maxLoops) {
                clearInterval(checkInterval);

                const finalUsername = username.length > 0 ? username : "Unknown User";

                // 1. Get the Chat Group Name
                const groupTitleEl = document.getElementById('ui-card-title');
                const groupName = groupTitleEl ? groupTitleEl.textContent.trim() : "Messages";

                // 2. Look for user avatar image
                const avatarImg = msgElement.querySelector('img[alt="User avatar"]');
                let avatarUrl = "";
                if (avatarImg && avatarImg.getAttribute('src')) {
                    const src = avatarImg.getAttribute('src');
                    avatarUrl = src.startsWith('http') ? src : window.location.origin + src;
                }

                // 3. Look for a posted image link and grab its Post ID number
                let imagePrefix = "";
                const imageLink = msgElement.querySelector('a.bbcode-thumb[href^="/post/view/"]');
                if (imageLink) {
                    const hrefParts = imageLink.getAttribute('href').split('/');
                    const postId = hrefParts[hrefParts.length - 1];
                    if (postId && !isNaN(postId)) {
                        imagePrefix = `[#${postId}] `;
                    }
                }

                // 4. Clean and parse text content (remove blockquotes/replies from the summary)
                const textContainer = msgElement.querySelector('.prose');
                let finalBodyText = "New message received.";

                if (textContainer) {
                    const tempClone = textContainer.cloneNode(true);
                    tempClone.querySelectorAll('.bbcode-quote').forEach(q => q.remove());
                    
                    const pureText = tempClone.textContent.trim();
                    if (pureText.length > 0) {
                        finalBodyText = pureText.length > 120 ? pureText.substring(0, 117) + "..." : pureText;
                    } else if (imageLink) {
                        finalBodyText = "Sent an image.";
                    }
                }

                // 5. Fire off the system desktop notification
                GM_notification({
                    title: `${finalUsername} - ${groupName} (SoyBooru)`,
                    text: `${imagePrefix}${finalBodyText}`,
                    image: avatarUrl,
                    silent: false,
                    timeout: 5000,
                    onclick: () => {
                        window.focus();
                        msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            }
        }, 20);
    }

    // Adds the On/Off toggle switch button to the chat header
    function injectMuteButton() {
        if (document.getElementById('soy-notif-header-toggle')) return;

        const headerMenu = document.querySelector('#ui-card-header .flex.flex-wrap.gap-2.shrink-0');
        if (!headerMenu) return;

        const btn = document.createElement('button');
        btn.id = 'soy-notif-header-toggle';
        btn.className = "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium rounded-none border border-input bg-card shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-accent hover:text-accent-foreground active:bg-muted h-7 px-3 text-xs";

        const updateUI = () => {
            if (isMuted) {
                btn.style.color = '#ef4444';
                btn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-x h-4 w-4 mr-1"><path d="M11 5 6 9H2v6h4l5 4V5z"></path><line x1="22" x2="16" y1="9" y2="15"></line><line x1="16" x2="22" y1="9" y2="15"></line></svg>
                    Notifications: Off
                `;
            } else {
                btn.style.color = '#10b981';
                btn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-2 h-4 w-4 mr-1"><path d="M11 5 6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                    Notifications: On
                `;
            }
        };

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            isMuted = !isMuted;
            GM_setValue("soy_notif_muted", isMuted);
            updateUI();
        });

        updateUI();
        headerMenu.insertBefore(btn, headerMenu.firstChild);
    }

    // Watcher engine: Monitors the web page live for any newly added chat messages
    const liveWatcher = new MutationObserver((mutations) => {
        injectMuteButton();

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;

                // Check if the added node itself is a message element
                if (node.id && node.id.startsWith('m') && !seenMessages.has(node.id)) {
                    seenMessages.add(node.id);
                    handleNewMessage(node);
                }

                // Check if any message elements are packed deep inside the added node
                node.querySelectorAll('div[id^="m"]').forEach(target => {
                    if (!seenMessages.has(target.id)) {
                        seenMessages.add(target.id);
                        handleNewMessage(target);
                    }
                });
            }
        }
    });

    // Fire initialization settings when the page handles loading states
    if (document.body) {
        cacheExistingMessages();
        injectMuteButton();
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            cacheExistingMessages();
            injectMuteButton();
        });
    }

    liveWatcher.observe(document.body, { childList: true, subtree: true });
})();
