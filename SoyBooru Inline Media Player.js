// ==UserScript==
// @name         SoyBooru | Inline Media Player
// @namespace    https://soybooru.com/
// @version      1.1
// @description  Adds a medium-sized, auto-fitting draggable player with a clean #PostID filename downloader.
// @description  Also if you want to keep file name of a file just use 'Save as' than clicking the button.
// @match        *://*.soybooru.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Inject sharp styling for the container
    const style = document.createElement('style');
    style.textContent = `
        .vp-container {
            position: fixed;
            z-index: 10000;
            background: #1e1e1e;
            border: 1px solid #444;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            border-radius: 0px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            resize: both;
            min-width: 200px;
            min-height: 150px;
        }
        .vp-bar {
            background: #2d2d2d;
            color: #ccc;
            padding: 4px 8px;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            font-family: sans-serif;
            font-size: 11px;
            border-bottom: 1px solid #444;
            flex-shrink: 0;
        }
        .vp-controls-right {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .vp-title {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-right: 10px;
        }
        .vp-dl-btn {
            background: none;
            border: none;
            color: #aaa;
            font-size: 14px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            width: 20px;
            height: 20px;
            transition: color 0.1s ease, transform 0.1s ease;
        }
        .vp-dl-btn:hover { 
            color: #007bff; 
            transform: scale(1.15);
        }
        .vp-close-btn {
            background: none;
            border: none;
            color: #aaa;
            font-size: 18px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            width: 20px;
            height: 20px;
            transition: color 0.1s ease, transform 0.1s ease;
        }
        .vp-close-btn:hover { 
            color: #fff; 
            transform: scale(1.15);
        }
        .vp-content-wrapper {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
            overflow: hidden;
        }
        .vp-media {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
        }
        .vp-toggle-btn {
            display: inline-block;
            margin-left: 4px;
            color: #007bff;
            text-decoration: none;
            font-size: 11px;
            font-weight: normal;
            cursor: pointer;
            font-family: monospace;
            vertical-align: middle;
        }
        .vp-toggle-btn:hover { text-decoration: underline; }
    `;
    document.head.appendChild(style);

    function createPlayer(mediaUrl, titleText) {
        const existing = document.getElementById('video-player');
        if (existing) existing.remove();

        const player = document.createElement('div');
        player.id = 'video-player';
        player.className = 'vp-container';

        // Balanced medium default footprint
        player.style.width = '440px';
        player.style.height = '360px';
        player.style.left = '150px';
        player.style.top = '150px';

        player.innerHTML = `
            <div class="vp-bar">
                <span class="vp-title" id="vp-title">${titleText}</span>
                <div class="vp-controls-right">
                    <button id="vp-download" class="vp-dl-btn" title="Download File">⬇</button>
                    <button id="vp-close" class="vp-close-btn" title="Close">×</button>
                </div>
            </div>
            <div class="vp-content-wrapper" id="vp-content">
                <span style="color: #888; font-family: sans-serif; font-size: 12px;">Loading...</span>
            </div>
        `;

        document.body.appendChild(player);
        const contentWrapper = player.querySelector('#vp-content');

        // Handles auto-fitting with strict medium sizing limit constraints
        function adjustPlayerSize(naturalWidth, naturalHeight) {
            const barHeight = 25;

            // Strictly cap max automated dimensions to a clear medium frame
            const maxWidth = 550;
            const maxHeight = 450;

            let targetWidth = naturalWidth;
            let targetHeight = naturalHeight;

            if (targetWidth > maxWidth) {
                targetHeight = (maxWidth / targetWidth) * targetHeight;
                targetWidth = maxWidth;
            }
            if (targetHeight > maxHeight) {
                targetWidth = (maxHeight / targetHeight) * targetWidth;
                targetHeight = maxHeight;
            }

            // Fallback rules if native sizes read too tiny
            if (targetWidth < 280) {
                targetHeight = (280 / targetWidth) * targetHeight;
                targetWidth = 280;
            }

            player.style.width = `${Math.round(targetWidth)}px`;
            player.style.height = `${Math.round(targetHeight + barHeight)}px`;
        }

        // Try Loading as Video
        const testVideo = document.createElement('video');
        testVideo.src = mediaUrl;
        testVideo.preload = 'auto';

        testVideo.onloadedmetadata = function() {
            contentWrapper.innerHTML = '';
            testVideo.className = 'vp-media';
            testVideo.controls = true;
            testVideo.autoplay = true;
            contentWrapper.appendChild(testVideo);
            adjustPlayerSize(testVideo.videoWidth, testVideo.videoHeight);
        };

        // Fallback to Image if video framework reports structural errors
        testVideo.onerror = function() {
            const img = document.createElement('img');
            img.className = 'vp-media';
            img.src = mediaUrl;
            img.onload = function() {
                contentWrapper.innerHTML = '';
                contentWrapper.appendChild(img);
                adjustPlayerSize(img.naturalWidth, img.naturalHeight);
            };
            img.onerror = function() {
                contentWrapper.innerHTML = `<span style="color: #ff4444; font-family: sans-serif; font-size: 12px; padding: 10px;">Error loading file</span>`;
            };
        };

        // Close Feature
        player.querySelector('#vp-close').addEventListener('click', () => player.remove());

        // Header Blob Downloader Implementation
        player.querySelector('#vp-download').addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const dlBtn = e.target;
            const originalText = dlBtn.textContent;
            dlBtn.textContent = '⏳';

            try {
                const res = await fetch(mediaUrl);
                const blob = await res.blob();

                let ext = 'bin';
                const type = (res.headers.get('content-type') || blob.type || '').toLowerCase();

                if (type.includes('mp4')) ext = 'mp4';
                else if (type.includes('webm')) ext = 'webm';
                else if (type.includes('gif')) ext = 'gif';
                else if (type.includes('jpeg') || type.includes('jpg')) ext = 'jpg';
                else if (type.includes('png')) ext = 'png';
                else if (type.includes('webp')) ext = 'webp';

                // Cleans title string completely down to just the raw numbers if it contains "Post #"
                let safeName = titleText.replace(/Post\s*#/i, '').replace('#', '').trim();

                const objUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objUrl;
                a.download = `#${safeName}.${ext}`; // Outputs cleanly as #(id).(ext)

                document.body.appendChild(a);
                a.click();
                a.remove();

                setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
            } catch (err) {
                console.error('Popout downloader failed:', err);
            } finally {
                dlBtn.textContent = originalText;
            }
        });

        // Draggable Mechanics
        const bar = player.querySelector('.vp-bar');
        let isDragging = false;
        let offsetX, offsetY;

        bar.addEventListener('mousedown', (e) => {
            if (e.target.closest('.vp-controls-right')) return;
            isDragging = true;
            offsetX = e.clientX - player.offsetLeft;
            offsetY = e.clientY - player.offsetTop;
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);
        });

        function drag(e) {
            if (!isDragging) return;
            player.style.left = `${e.clientX - offsetX}px`;
            player.style.top = `${e.clientY - offsetY}px`;
        }

        function stopDrag() {
            isDragging = false;
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', stopDrag);
        }
    }

    function setupLinks() {
        const links = document.querySelectorAll('a.bbcode-attachment:not(.vp-processed), a.bbcode-thumb:not(.vp-processed)');

        links.forEach(link => {
            link.classList.add('vp-processed');

            let mediaUrl = '';
            let titleText = 'File';

            if (link.classList.contains('bbcode-thumb')) {
                const hrefAttr = link.getAttribute('href') || '';
                const match = hrefAttr.match(/\/post\/view\/(\d+)/);
                if (match && match[1]) {
                    mediaUrl = `${window.location.origin}/api/booru/posts/${match[1]}/file`;
                    titleText = `Post #${match[1]}`;
                } else {
                    const img = link.querySelector('img');
                    const imgSrc = img ? img.getAttribute('src') : '';
                    const imgMatch = imgSrc.match(/\/posts\/(\d+)\//);
                    if (imgMatch && imgMatch[1]) {
                        mediaUrl = `${window.location.origin}/api/booru/posts/${imgMatch[1]}/file`;
                        titleText = `Post #${imgMatch[1]}`;
                    }
                }
            } else {
                mediaUrl = link.getAttribute('href') || '';
                if (mediaUrl.startsWith('/')) {
                    mediaUrl = window.location.origin + mediaUrl;
                }
                const imgNode = link.querySelector('img');
                titleText = imgNode ? (imgNode.getAttribute('data-attachment-id') || 'Attachment') : 'Attachment';
            }

            if (!mediaUrl) return;

            const toggle = document.createElement('a');
            toggle.className = 'vp-toggle-btn';
            toggle.textContent = '[+]';
            toggle.href = '#';

            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                createPlayer(mediaUrl, titleText);
            });

            link.parentNode.insertBefore(toggle, link.nextSibling);
        });
    }

    setupLinks();
    const observer = new MutationObserver(setupLinks);
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
