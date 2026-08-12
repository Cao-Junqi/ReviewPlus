(function (root) {
    'use strict';

    const defaultConfig = {
        contentSelector: 'div.el-tooltip.translate-text',
        resultSelector: '#extract-content-float-window .extract-result',
        itemSelector: '.content-item'
    };
    let config = { ...defaultConfig };
    let monitor = null;

    function configure(options = {}) {
        config = { ...config, ...options };
    }

    function getDocument(documentRef) {
        return documentRef || root.document;
    }

    function readContents(documentRef = root.document) {
        const doc = getDocument(documentRef);
        return Array.from(doc.querySelectorAll(config.contentSelector))
            .map(element => (element.textContent || '').trim());
    }

    function renderContents(contents, documentRef = root.document) {
        const doc = getDocument(documentRef);
        const resultElement = doc.querySelector(config.resultSelector);
        if (!resultElement) return false;

        resultElement.replaceChildren();
        if (contents.length === 0) {
            const empty = doc.createElement('div');
            empty.className = 'no-content';
            empty.textContent = '未找到匹配的内容';
            resultElement.append(empty);
            return true;
        }

        const list = doc.createElement('div');
        list.className = 'content-list';
        contents.forEach((content, index) => {
            const item = doc.createElement('div');
            item.className = 'content-item';
            const number = doc.createElement('div');
            number.className = 'content-index';
            number.textContent = String(index + 1);
            const text = doc.createElement('div');
            text.className = 'content-text';
            text.dataset.contentId = String(index);
            text.textContent = content;
            item.append(number, text);
            list.append(item);
        });
        resultElement.append(list);
        return true;
    }

    function updateTitle(count, documentRef = root.document) {
        const header = getDocument(documentRef)
            .querySelector('#extract-content-float-window .float-window-header');
        const title = header?.querySelector('.header-title');
        if (title) title.textContent = `机审内容提取 (${count}条)`;
    }

    function extractContent(options = {}) {
        const doc = getDocument(options.documentRef);
        const resultElement = doc.querySelector(config.resultSelector);
        if (!resultElement) return { count: 0, contents: [], rendered: false };

        const contents = readContents(doc);
        renderContents(contents, doc);
        updateTitle(contents.length, doc);
        options.onExtract?.(contents);
        return { count: contents.length, contents, rendered: true };
    }

    function shouldRefresh(mutations, documentRef) {
        const doc = getDocument(documentRef);
        return mutations.some(mutation => {
            if (mutation.type === 'characterData') {
                const parent = mutation.target.parentElement;
                return Boolean(parent?.matches?.(config.contentSelector));
            }
            if (mutation.type !== 'childList') return false;
            const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
            return nodes.some(node => node.nodeType === 1 && (
                node.matches?.(config.contentSelector) ||
                node.querySelector?.(config.contentSelector)
            ));
        }) || doc.querySelectorAll(config.contentSelector).length !== monitor?.lastCount;
    }

    function setupAutoMonitor(options = {}) {
        stopAutoMonitor();
        const doc = getDocument(options.documentRef);
        const body = doc.body;
        if (!body || typeof root.MutationObserver !== 'function') return null;

        monitor = { lastCount: doc.querySelectorAll(config.contentSelector).length };
        const refresh = () => {
            const result = extractContent(options);
            if (result.count === monitor.lastCount && !options.forceRefresh) return;
            monitor.lastCount = result.count;
            options.onChange?.(result.count, result);
        };
        const observer = new root.MutationObserver(mutations => {
            if (!shouldRefresh(mutations, doc)) return;
            root.setTimeout(refresh, options.mutationDelay ?? 100);
        });
        observer.observe(body, { childList: true, subtree: true, characterData: true });
        const interval = root.setInterval(refresh, options.interval ?? 2000);
        monitor.observer = observer;
        monitor.interval = interval;
        return { observer, interval, stop: stopAutoMonitor };
    }

    function stopAutoMonitor() {
        if (!monitor) return;
        monitor.observer?.disconnect();
        if (monitor.interval) root.clearInterval(monitor.interval);
        monitor = null;
    }

    function modeLabel(mode) {
        return mode === 'all' ? '全部' : mode === 'top15' ? '前15条' : '平均分布';
    }

    function selectContents(items, mode) {
        const values = Array.from(items).map(item => (item.textContent || '').trim());
        if (mode === 'all') return values;
        if (mode === 'distributed') {
            const step = Math.max(1, Math.ceil(values.length / 15));
            return values.filter((_, index) => index % step === 0);
        }
        return values.slice(0, 15);
    }

    async function copyContents(mode = 'top15', options = {}) {
        const doc = getDocument(options.documentRef);
        const items = doc.querySelectorAll(config.itemSelector);
        if (!items.length) {
            options.notify?.('没有可复制的内容', 'warning');
            return { copied: false, count: 0 };
        }
        const values = selectContents(items, mode);
        const text = values.join('\n');
        try {
            if (root.navigator?.clipboard?.writeText) {
                await root.navigator.clipboard.writeText(text);
            } else {
                const textArea = doc.createElement('textarea');
                textArea.value = text;
                doc.body.append(textArea);
                textArea.select();
                doc.execCommand('copy');
                textArea.remove();
            }
            options.notify?.(`已复制 ${modeLabel(mode)}内容`, 'success');
            return { copied: true, count: values.length, text };
        } catch (error) {
            options.notify?.('复制失败，请手动复制', 'error');
            return { copied: false, count: values.length, text, error };
        }
    }

    function setupCopySelect(options = {}) {
        const doc = getDocument(options.documentRef);
        const select = doc.querySelector(options.selector || '.copy-select');
        if (!select || select.dataset.contentExtractorBound === '1') return false;
        select.removeAttribute('size');
        select.dataset.contentExtractorBound = '1';
        select.addEventListener('change', event => {
            copyContents(event.target.value, options);
        });
        return true;
    }

    root.ReviewPlusModules = root.ReviewPlusModules || {};
    root.ReviewPlusModules.contentExtractor = {
        configure,
        readContents,
        renderContents,
        extractContent,
        setupAutoMonitor,
        stopAutoMonitor,
        copyContents,
        setupCopySelect,
        selectContents
    };
})(globalThis);
