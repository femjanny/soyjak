// ==UserScript==
// @name         SoyBooru | #PostID Downloader
// @namespace    https://soybooru.com/
// @version      1.5
// @description  Adds another download button that downloads posts as #POSTID for any files.
// @match        https://soybooru.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function getPostId() {
        return location.pathname.match(/\/post\/view\/(\d+)/)?.[1];
    }

    function inject() {
        const toolbar = document.querySelector(
            '#media-container .absolute.top-4.right-4.flex.items-center.gap-2'
        );

        if (!toolbar || document.getElementById('sb-download-btn')) return;

        const btn = document.createElement('button');

        btn.id = 'sb-download-btn';
        btn.className =
            'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ' +
            'rounded-none border border-input shadow-[2px_2px_0_0_rgba(0,0,0,0.25)] ' +
            'hover:bg-accent hover:text-accent-foreground active:bg-muted ' +
            'h-8 w-8 bg-background/80 backdrop-blur';

        btn.textContent = '⬇';
        btn.title = 'Download as #PostID';

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const postId = getPostId();
            if (!postId) return;

            const url = `https://soybooru.com/api/booru/posts/${postId}/file`;

            try {
                const res = await fetch(url);
                const blob = await res.blob();

                let ext = 'bin';
                const type = (res.headers.get('content-type') || blob.type || '').toLowerCase();

                if (type.includes('mp4')) ext = 'mp4';
                else if (type.includes('webm')) ext = 'webm';
                else if (type.includes('gif')) ext = 'gif';
                else if (type.includes('jpeg') || type.includes('jpg')) ext = 'jpg';
                else if (type.includes('png')) ext = 'png';
                else if (type.includes('webp')) ext = 'webp';
                else if (type.includes('flash') || type.includes('swf')) ext = 'swf';

                const objUrl = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = objUrl;
                a.download = `#${postId}.${ext}`;

                document.body.appendChild(a);
                a.click();
                a.remove();

                setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
            } catch (err) {
                console.error('Download failed:', err);
            }
        });

        toolbar.appendChild(btn);
    }

    function start() {
        inject();

        new MutationObserver(() => {
            inject();
        }).observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        let lastUrl = location.href;

        setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;

                document.getElementById('sb-download-btn')?.remove();

                setTimeout(inject, 100);
                setTimeout(inject, 500);
                setTimeout(inject, 1000);
            }
        }, 250);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
