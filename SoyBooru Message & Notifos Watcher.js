// ==UserScript==
// @name         SoyBooru | Message & Notifos Watcher
// @namespace    https://soybooru.com/
// @version      4.4
// @description  Optimized watcher with cached favicon and robust notification handling. Pushes 2 Desktop Notifcations
// @match        https://soybooru.com/*
// @grant        GM_notification
// ==/UserScript==

(function () {
    'use strict';

    const DEBUG = true;
    let lastMessages = null;
    let lastNotifications = null;
    let cachedIcon = null;

    function log(msg) {
        if (DEBUG) console.log(`[SoyBooru Watcher] ${msg}`);
    }

    // Cache the icon once to prevent DOM lookups and race conditions
    function cacheIcon() {
        const link = document.querySelector("link[rel*='icon']");
        if (link) cachedIcon = link.href;
    }

    function check() {
        const msgNode = document.querySelector('.lg\\:flex a[href="/messages"] span.bg-primary');
        const notifNode = document.querySelector('.lg\\:flex #ui-dropdown-trigger span.bg-primary');

        const currentMessages = msgNode ? (+msgNode.textContent || 0) : 0;
        const currentNotifications = notifNode ? (+notifNode.textContent || 0) : 0;

        // Baseline Setup
        if (lastMessages === null) {
            lastMessages = currentMessages;
            lastNotifications = currentNotifications;
            cacheIcon(); // Grab the icon during initialization

            log(`Baseline set -> Msg: ${currentMessages} | Notif: ${currentNotifications}`);

            if (currentMessages > 0 || currentNotifications > 0) {
                let parts = [];
                if (currentMessages > 0) parts.push(`${currentMessages} chat message${currentMessages === 1 ? '' : 's'}`);
                if (currentNotifications > 0) parts.push(`${currentNotifications} new notification${currentNotifications === 1 ? '' : 's'}`);

                GM_notification({
                    title: 'SoyBooru Status',
                    text: `You currently have ${parts.join(' | ')}`,
                    image: cachedIcon,
                    timeout: 4000
                });
            }

            setInterval(check, 3000);
            return;
        }

        log(`Checking... Prev Msg: ${lastMessages} (${currentMessages}) | Prev Notif: ${lastNotifications} (${currentNotifications})`);

        // Evaluate & Notify
        if (currentMessages > lastMessages) {
            log(`New message detected! ${lastMessages} -> ${currentMessages}`);
            GM_notification({
                title: 'SoyBooru',
                text: 'You have a new message.',
                image: cachedIcon,
                timeout: 5000
            });
        }

        if (currentNotifications > lastNotifications) {
            log(`New notification detected! ${lastNotifications} -> ${currentNotifications}`);
            GM_notification({
                title: 'SoyBooru',
                text: 'You have a new notification.',
                image: cachedIcon,
                timeout: 5000
            });
        }

        lastMessages = currentMessages;
        lastNotifications = currentNotifications;
    }

    // Delay 3 seconds for initial load, then run
    setTimeout(check, 3000);
})();
