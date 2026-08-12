(function (root) {
    'use strict';

    let state;
    let onChange = () => {};
    let compactKey = 'topicAuditCompactView';
    let advancedKey = 'topicAuditAdvancedFilters';

    function configure(options) {
        state = options.state;
        onChange = options.onChange;
        compactKey = options.compactKey || compactKey;
        advancedKey = options.advancedKey || advancedKey;
    }

    function markFilterItems(container) {
        const basicFilters = root.ReviewPlusTopicAudit.config.basicFilters;
        container.querySelectorAll('.el-form-item').forEach(item => {
            const label = (item.querySelector('.el-form-item__label')?.textContent || '').trim();
            const text = (item.textContent || '').trim().replace(/\s+/g, ' ');
            const isSearch = [...item.querySelectorAll('button')]
                .some(button => ['搜索', '重置'].includes(button.textContent.trim()));
            item.classList.toggle('topic-audit-advanced-filter', !basicFilters.has(label) && !isSearch);
            item.classList.toggle('topic-audit-filter-time', label === '时间');
            item.classList.toggle('topic-audit-filter-flag', !label && !isSearch);
            item.classList.toggle('topic-audit-filter-actions', isSearch);
            if (label) item.dataset.topicAuditFilterLabel = label;
            if (!label && !isSearch) item.title = text;
        });
    }

    function updateToolbar(toolbar) {
        const compactButton = toolbar.querySelector('[data-action="compact"]');
        const advancedButton = toolbar.querySelector('[data-action="advanced"]');
        compactButton.classList.toggle('el-button--primary', state.compact);
        compactButton.setAttribute('aria-pressed', String(state.compact));
        compactButton.querySelector('span').textContent = state.compact ? '精简视图' : '原始视图';
        advancedButton.classList.toggle('el-button--primary', state.advanced);
        advancedButton.setAttribute('aria-expanded', String(state.advanced));
        advancedButton.querySelector('span').textContent = state.advanced ? '收起筛选' : '高级筛选';
    }

    function ensureToolbar(container) {
        let toolbar = container.querySelector('.topic-audit-layout-toolbar');
        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.className = 'topic-audit-layout-toolbar';
            toolbar.innerHTML = `
                <button type="button" class="el-button el-button--mini" data-action="compact" aria-pressed="false">
                    <i class="el-icon-s-operation" aria-hidden="true"></i><span>精简视图</span>
                </button>
                <button type="button" class="el-button el-button--mini" data-action="advanced" aria-expanded="false">
                    <i class="el-icon-setting" aria-hidden="true"></i><span>高级筛选</span>
                </button>`;
            toolbar.addEventListener('click', event => {
                const button = event.target.closest('button[data-action]');
                if (!button) return;
                if (button.dataset.action === 'compact') {
                    state.compact = !state.compact;
                    localStorage.setItem(compactKey, state.compact ? '1' : '0');
                } else {
                    state.advanced = !state.advanced;
                    localStorage.setItem(advancedKey, state.advanced ? '1' : '0');
                }
                onChange();
            });
            container.prepend(toolbar);
        }
        updateToolbar(toolbar);
    }

    root.ReviewPlusTopicAudit = root.ReviewPlusTopicAudit || {};
    root.ReviewPlusTopicAudit.filters = { configure, markFilterItems, updateToolbar, ensureToolbar };
})(globalThis);
