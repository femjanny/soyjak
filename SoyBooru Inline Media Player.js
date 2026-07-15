// ==UserScript==
// @name         SoyBooru | Inline Media Player
// @namespace    https://soybooru.com/
// @version      2.0
// @description  Adds a medium-sized, auto-fitting draggable player with thick side handles and active native corner resizing.
// @description  Also if you want to keep file name of a file just use 'Save as' than clicking the button.
// @match        *://*.soybooru.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Inject sharp styling for the container and overlaid toggle text
    const style = document.createElement('style');
    style.textContent = `
        .vp-container {
            position: fixed;
            z-index: 10000;
            background: #1e1e1e;
            border: 1px solid #444;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            border-radius: 0px;
            display: flex;
            flex-direction: column;
            resize: both;
            overflow: hidden; /* Required by browsers for 'resize: both' to generate handles */
            min-width: 220px;
            min-height: 150px;
            padding: 0;
            box-sizing: border-box;
        }
        .vp-bar {
            background: #2d2d2d;
            color: #ccc;
            padding: 4px 8px;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-family: sans-serif;
            font-size: 11px;
            border-bottom: 1px solid #444;
            flex-shrink: 0;
            position: relative;
            z-index: 2;
        }
        .vp-controls-right {
            display: flex;
            align-items: center;
            gap: 14px;
            user-select: none;
        }
        .vp-title {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-right: 10px;
            user-select: text;
            cursor: text;
        }
        .vp-dl-btn, .vp-close-btn {
            background: none;
            border: none;
            color: #aaa;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            width: 20px;
            height: 20px;
            transition: color 0.1s ease, transform 0.1s ease;
            position: relative;
            z-index: 3;
        }
        .vp-dl-btn { font-size: 14px; }
        .vp-close-btn { font-size: 18px; }
        .vp-dl-btn:hover { color: #007bff; transform: scale(1.15); }
        .vp-close-btn:hover { color: #fff; transform: scale(1.15); }

        .vp-content-wrapper {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
            overflow: hidden;
            cursor: default;
            position: relative;
            z-index: 1;
        }
        .vp-media {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
        }

        /* INVISIBLE HIGH-ACCURACY DRAG BORDERS (12px Thickness) */
        .vp-edge-handle {
            position: absolute;
            z-index: 10;
            background: transparent;
            cursor: move;
        }
        .vp-edge-top    { top: 0px; left: 0px; right: 0px; height: 12px; }
        .vp-edge-left   { left: 0px; top: 0px; bottom: 0px; width: 12px; }
        /* Offset bottom/right handles away from corner to prevent hijacking native browser resize zone */
        .vp-edge-bottom { bottom: 0px; left: 0px; right: 25px; height: 12px; }
        .vp-edge-right  { right: 0px; top: 0px; bottom: 25px; width: 12px; }

        /* Corner handle additions for thick grab zones */
        .vp-corner-handle {
            position: absolute;
            z-index: 11;
            width: 12px;
            height: 12px;
            background: transparent;
            cursor: move;
        }
        .vp-corner-tl { top: 0px; left: 0px; }
        .vp-corner-tr { top: 0px; right: 0px; }
        .vp-corner-bl { bottom: 0px; left: 0px; }

        /* Overlay wrapper styles */
        .vp-wrapper {
            position: relative;
            display: inline-block;
        }
        .vp-toggle-btn {
            position: absolute;
            bottom: 0px;
            right: 0px;
            z-index: 5;
            background: none;
            color: #007bff;
            text-decoration: none;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            font-family: monospace;
            padding: 4px 6px;
            border: none;
            opacity: 0;
            transition: opacity 0.1s ease;
            text-shadow: 1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000;
        }
        .vp-wrapper:hover .vp-toggle-btn { opacity: 1; }
        .vp-toggle-btn:hover { text-decoration: none; color: #fff; }

        .vp-dragging-active { user-select: none !important; }
    `;
    document.head.appendChild(style);

    function createPlayer(mediaUrl, titleText) {
        const existing = document.getElementById('video-player');
        if (existing) existing.remove();

        const player = document.createElement('div');
        player.id = 'video-player';
        player.className = 'vp-container';

        player.style.width = '440px';
        player.style.height = '360px';
        player.style.left = '150px';
        player.style.top = '150px';

        player.innerHTML = `
            <!-- Thick Border Drag Handles Inside Frame Bounds -->
            <div class="vp-edge-handle vp-edge-top"></div>
            <div class="vp-edge-handle vp-edge-bottom"></div>
            <div class="vp-edge-handle vp-edge-left"></div>
            <div class="vp-edge-handle vp-edge-right"></div>
            <div class="vp-corner-handle vp-corner-tl"></div>
            <div class="vp-corner-handle vp-corner-tr"></div>
            <div class="vp-corner-handle vp-corner-bl"></div>

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

        function adjustPlayerSize(naturalWidth, naturalHeight) {
            const barHeight = 25;
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

            if (targetWidth < 280) {
                targetHeight = (280 / targetWidth) * targetHeight;
                targetWidth = 280;
            }

            player.style.width = `${Math.round(targetWidth)}px`;
            player.style.height = `${Math.round(targetHeight + barHeight)}px`;
        }

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

        player.querySelector('#vp-close').addEventListener('click', () => player.remove());

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

                let safeName = titleText.replace(/Post\s*#/i, '').replace('#', '').trim();

                const objUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objUrl;
                a.download = `#${safeName}.${ext}`;

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

        // DRAG ENGINE
        let isDragging = false;
        let offsetX, offsetY;

        function startDrag(e) {
            if (e.target.closest('.vp-controls-right') || e.target.closest('.vp-title')) return;

            e.preventDefault();
            document.body.classList.add('vp-dragging-active');

            isDragging = true;
            offsetX = e.clientX - player.offsetLeft;
            offsetY = e.clientY - player.offsetTop;
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);
        }

        player.querySelector('.vp-bar').addEventListener('mousedown', startDrag);
        player.querySelectorAll('.vp-edge-handle, .vp-corner-handle').forEach(handle => {
            handle.addEventListener('mousedown', startDrag);
        });

        function drag(e) {
            if (!isDragging) return;
            player.style.left = `${e.clientX - offsetX}px`;
            player.style.top = `${e.clientY - offsetY}px`;
        }

        function stopDrag() {
            isDragging = false;
            document.body.classList.remove('vp-dragging-active');
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

            const wrapper = document.createElement('div');
            wrapper.className = 'vp-wrapper';

            link.parentNode.insertBefore(wrapper, link);
            wrapper.appendChild(link);

            const toggle = document.createElement('a');
            toggle.className = 'vp-toggle-btn';
            toggle.textContent = '[+]';
            toggle.href = '#';

            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                createPlayer(mediaUrl, titleText);
            });

            wrapper.appendChild(toggle);
        });
    }

    setupLinks();
    const observer = new MutationObserver(setupLinks);
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();
