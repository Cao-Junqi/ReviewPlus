(function (root) {
    'use strict';

    const PREVIEW_WIDTH_KEY = 'topicAuditPreviewWidth';
    let onLayoutChange = () => {};

    function configure(options = {}) {
        onLayoutChange = typeof options.onLayoutChange === 'function' ? options.onLayoutChange : () => {};
    }

    function topicPreviewUrl(row) {
        if (Number(row?.modelType) === 4) return '';
        const route = Number(row?.modelType) === 5 ? 'imglive_view' : 'live_view';
        return `${location.origin}/#/${route}?tpid=${encodeURIComponent(row.id)}&zbid=${encodeURIComponent(row.zbId)}`;
    }

    function setPreviewWidth(drawer, width) {
        const max = Math.max(560, innerWidth - 320);
        const value = Math.max(560, Math.min(Number(width) || 900, max));
        drawer.style.width = `${value}px`;
        document.documentElement.style.setProperty('--topic-audit-preview-width', `${value}px`);
        return value;
    }

    function stopPreview(drawer) {
        drawer.querySelector('iframe')?.remove();
    }

    function playPreviewOnce(frame, attempts = 0) {
        if (!frame.isConnected || attempts >= 40) return;
        const video = frame.contentDocument?.querySelector('video');
        if (!video) {
            setTimeout(() => playPreviewOnce(frame, attempts + 1), 250);
            return;
        }
        const play = () => video.play().catch(() => {});
        if (video.readyState >= 2) play();
        else video.addEventListener('canplay', play, { once: true });
    }

    function loadPreview(drawer) {
        const url = drawer.dataset.previewUrl;
        if (!url) return;
        stopPreview(drawer);
        const frame = document.createElement('iframe');
        frame.title = '话题直播预览';
        frame.allow = 'autoplay';
        frame.dataset.loadedUrl = url;
        frame.addEventListener('load', () => playPreviewOnce(frame), { once: true });
        frame.src = url;
        drawer.append(frame);
    }

    function setPreviewOpen(drawer, open, restorable = true) {
        drawer.classList.toggle('is-open', open);
        document.documentElement.classList.toggle('topic-audit-preview-open', open);
        const bookmark = document.querySelector('.topic-audit-preview-bookmark');
        if (open) {
            bookmark?.classList.remove('is-visible');
            if (drawer.querySelector('iframe')?.dataset.loadedUrl !== drawer.dataset.previewUrl) loadPreview(drawer);
        } else {
            stopPreview(drawer);
            bookmark?.classList.toggle('is-visible', restorable && Boolean(drawer.dataset.previewUrl));
            if (!restorable) {
                delete drawer.dataset.previewUrl;
                delete drawer.dataset.topicId;
                drawer.querySelector('strong').textContent = '';
            }
        }
        onLayoutChange();
    }

    function openTopicPreview(row) {
        const url = topicPreviewUrl(row);
        if (!url) return false;

        let drawer = document.querySelector('.topic-audit-preview-drawer');
        if (!drawer) {
            drawer = document.createElement('aside');
            drawer.className = 'topic-audit-preview-drawer';
            drawer.setAttribute('aria-label', '话题预览');
            drawer.innerHTML = `
                <div class="topic-audit-preview-resizer" role="separator" aria-label="调整预览宽度" aria-orientation="vertical"></div>
                <header>
                    <strong></strong>
                    <div>
                        <button type="button" data-preview-action="new" title="新标签页打开" aria-label="新标签页打开"><i class="el-icon-top-right"></i></button>
                        <button type="button" data-preview-action="hide" title="隐藏到书签" aria-label="隐藏到书签"><i class="el-icon-minus"></i></button>
                        <button type="button" data-preview-action="close" title="关闭预览" aria-label="关闭预览"><i class="el-icon-close"></i></button>
                    </div>
                </header>`;
            drawer.querySelector('[data-preview-action="hide"]').addEventListener('click', () => setPreviewOpen(drawer, false));
            drawer.querySelector('[data-preview-action="close"]').addEventListener('click', () => setPreviewOpen(drawer, false, false));
            drawer.querySelector('[data-preview-action="new"]').addEventListener('click', () => {
                window.open(drawer.dataset.previewUrl, '_blank', 'noopener');
            });
            document.body.append(drawer);

            const bookmark = document.createElement('button');
            bookmark.type = 'button';
            bookmark.className = 'topic-audit-preview-bookmark';
            bookmark.title = '恢复话题预览';
            bookmark.setAttribute('aria-label', '恢复话题预览');
            bookmark.innerHTML = '<i class="el-icon-collection-tag" aria-hidden="true"></i>';
            bookmark.addEventListener('click', () => setPreviewOpen(drawer, true));
            document.body.append(bookmark);

            const resizer = drawer.querySelector('.topic-audit-preview-resizer');
            let resizing = false;
            const finishResize = () => {
                if (!resizing) return;
                resizing = false;
                document.body.classList.remove('topic-audit-preview-resizing');
                localStorage.setItem(PREVIEW_WIDTH_KEY, String(Math.round(drawer.getBoundingClientRect().width)));
            };
            resizer.addEventListener('pointerdown', event => {
                if (event.button !== 0) return;
                event.preventDefault();
                resizing = true;
                resizer.setPointerCapture(event.pointerId);
                document.body.classList.add('topic-audit-preview-resizing');
            });
            resizer.addEventListener('pointermove', event => {
                if (!resizing) return;
                event.preventDefault();
                setPreviewWidth(drawer, innerWidth - event.clientX);
            });
            resizer.addEventListener('pointerup', event => {
                finishResize();
                if (resizer.hasPointerCapture(event.pointerId)) resizer.releasePointerCapture(event.pointerId);
            });
            resizer.addEventListener('pointercancel', finishResize);
            resizer.addEventListener('lostpointercapture', finishResize);
            setPreviewWidth(drawer, localStorage.getItem(PREVIEW_WIDTH_KEY));
        }

        drawer.dataset.previewUrl = url;
        drawer.dataset.topicId = String(row.id);
        drawer.querySelector('strong').textContent = row.title || `话题 ${row.id}`;
        setPreviewOpen(drawer, true);
        return true;
    }

    root.ReviewPlusTopicAudit = root.ReviewPlusTopicAudit || {};
    root.ReviewPlusTopicAudit.preview = { configure, topicPreviewUrl, setPreviewOpen, openTopicPreview };
})(globalThis);
