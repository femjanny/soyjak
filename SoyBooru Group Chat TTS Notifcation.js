// ==UserScript==
// @name         Soybooru | Group Chat Notifications & Separate TTS Toggle
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Sends desktop notifications and reads aloud new chat messages with independent toggle switches. Keep the group chat tab open.
// @match        https://soybooru.com/messages*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    let isMuted = GM_getValue("soy_notif_muted", false);
    let isTtsMuted = GM_getValue("soy_tts_muted", false);
    const seenMessages = new Set();
    let currentGroupName = ""; // Tracks the active chat room title

    // Ask for permission to show desktop notifications when the page loads
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }

    // Native Browser Text-to-Speech Engine
    function speakText(text) {
        if (isTtsMuted) return; // Drop out early if user turned TTS off

        if ('speechSynthesis' in window) {
            // Cancel any current ongoing speech so it doesn't backlog heavily
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.2; // Adjust speed here (0.1 to 10)
            utterance.pitch = 1.0; // Adjust pitch here (0 to 2)
            utterance.lang = 'en-US';

            window.speechSynthesis.speak(utterance);
        }
    }

    // Remember messages already on screen so we don't alert for old messages
    function cacheExistingMessages() {
        document.querySelectorAll('div[id^="m"]').forEach(el => {
            if (el.id) seenMessages.add(el.id);
        });
    }

    // Process a new message and trigger actions
    function handleNewMessage(msgElement) {
        if (!msgElement) return;

        // Skip everything entirely if both elements are muted OR if user is actively interacting with the tab
        const systemIsVisible = document.hasFocus() && document.visibilityState === 'visible';
        if (systemIsVisible || (isMuted && isTtsMuted)) {
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

                // 4. Clean and parse text content (handling emotes and stripping blockquotes)
                const textContainer = msgElement.querySelector('.prose');
                let finalBodyText = "New message received.";
                let ttsBodyText = "Sent a message.";

                if (textContainer) {
                    const tempClone = textContainer.cloneNode(true);

                    // Remove quotes/replies from the text summary
                    tempClone.querySelectorAll('.bbcode-quote').forEach(q => q.remove());

                    // Convert site emote images into their textual codes
                    tempClone.querySelectorAll('img.bbcode-emote').forEach(emote => {
                        const emoteCode = emote.getAttribute('alt');
                        if (emoteCode) {
                            const formattedCode = emoteCode.startsWith(':') && emoteCode.endsWith(':') ?
                                `[${emoteCode}]` :
                                emoteCode;
                            emote.replaceWith(document.createTextNode(formattedCode));
                        }
                    });

                    const pureText = tempClone.textContent.trim();
                    if (pureText.length > 0) {
                        finalBodyText = pureText.length > 120 ? pureText.substring(0, 117) + "..." : pureText;

                        // Clean up text codes formatting tags so TTS doesn't say punctuation elements
                        ttsBodyText = pureText.replace(/[\[\]]/g, '').replace(/:/g, ' ');
                    } else if (imageLink) {
                        finalBodyText = "Sent an image.";
                        ttsBodyText = "Sent an image.";
                    }
                }

                // 5. Fire off the system desktop notification (Only if NOT muted)
                if (!isMuted) {
                    GM_notification({
                        title: `${finalUsername} - ${groupName} (SoyBooru)`,
                        text: `${imagePrefix}${finalBodyText}`,
                        image: avatarUrl,
                        silent: false,
                        timeout: 5000,
                        onclick: () => {
                            window.focus();
                            msgElement.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                        }
                    });
                }

                // 6. Trigger local Text-To-Speech (Only if NOT TTS muted)
                if (!isTtsMuted) {
                    speakText(`${finalUsername} says: ${ttsBodyText}`);
                }
            }
        }, 20);
    }

    // Adds both the Notification and TTS On/Off toggle switch buttons to the chat header
    function injectControlButtons() {
        const headerMenu = document.querySelector('#ui-card-header .flex.flex-wrap.gap-2.shrink-0');
        if (!headerMenu) return;

        // --- Notification Toggle Button ---
        if (!document.getElementById('soy-notif-header-toggle')) {
            const notifBtn = document.createElement('button');
            notifBtn.id = 'soy-notif-header-toggle';
            notifBtn.className = "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium rounded-none border border-input bg-card shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-accent hover:text-accent-foreground active:bg-muted h-7 px-3 text-xs";

            const updateNotifUI = () => {
                if (isMuted) {
                    notifBtn.style.color = '#ef4444';
                    notifBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell-off h-4 w-4 mr-1"><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path><path d="M18 8a6 6 0 0 0-9.33-5"></path><line x1="1" x2="23" y1="1" y2="23"></line></svg>
                        Notifs: Off
                    `;
                } else {
                    notifBtn.style.color = '#10b981';
                    notifBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell h-4 w-4 mr-1"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
                        Notifs: On
                    `;
                }
            };

            notifBtn.addEventListener('click', (e) => {
                e.preventDefault();
                isMuted = !isMuted;
                GM_setValue("soy_notif_muted", isMuted);
                updateNotifUI();
            });

            updateNotifUI();
            headerMenu.insertBefore(notifBtn, headerMenu.firstChild);
        }

        // --- TTS Toggle Button ---
        if (!document.getElementById('soy-tts-header-toggle')) {
            const ttsBtn = document.createElement('button');
            ttsBtn.id = 'soy-tts-header-toggle';
            ttsBtn.className = "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium rounded-none border border-input bg-card shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] hover:bg-accent hover:text-accent-foreground active:bg-muted h-7 px-3 text-xs";

            const updateTtsUI = () => {
                if (isTtsMuted) {
                    ttsBtn.style.color = '#ef4444';
                    ttsBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-x h-4 w-4 mr-1"><path d="M11 5 6 9H2v6h4l5 4V5z"></path><line x1="22" x2="16" y1="9" y2="15"></line><line x1="16" x2="22" y1="9" y2="15"></line></svg>
                        TTS: Off
                    `;
                } else {
                    ttsBtn.style.color = '#10b981';
                    ttsBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-2 h-4 w-4 mr-1"><path d="M11 5 6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                        TTS: On
                    `;
                }
            };

            ttsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                isTtsMuted = !isTtsMuted;
                GM_setValue("soy_tts_muted", isTtsMuted);
                updateTtsUI();

                // If user forces TTS Off while browser is actively speaking, mute it instantly
                if (isTtsMuted && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                }
            });

            updateTtsUI();
            // Inserts it right next to the other notification button inside the header bar menu
            headerMenu.insertBefore(ttsBtn, headerMenu.firstChild);
        }
    }

    // Watcher engine: Monitors the web page live for any newly added chat messages or navigation swaps
    const liveWatcher = new MutationObserver((mutations) => {
        // Detect if the user switched chat rooms entirely
        const groupTitleEl = document.getElementById('ui-card-title');
        const activeGroup = groupTitleEl ? groupTitleEl.textContent.trim() : "";

        if (activeGroup && activeGroup !== currentGroupName) {
            currentGroupName = activeGroup;
            seenMessages.clear(); // Wipe out old logs from the prior room
            cacheExistingMessages(); // Log whatever messages are currently in this newly loaded room
        }

        injectControlButtons();

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
    function init() {
        const groupTitleEl = document.getElementById('ui-card-title');
        if (groupTitleEl) currentGroupName = groupTitleEl.textContent.trim();
        cacheExistingMessages();
        injectControlButtons();
    }

    if (document.body) {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            init();
        });
    }

    liveWatcher.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
