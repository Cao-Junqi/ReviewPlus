(function (root) {
    'use strict';

    const RESULT_TYPES = {
        all: '全部',
        unchecked: '未检查',
        normal: '正常',
        suspicious: '可疑',
        violation: '违规'
    };
    let routeGuard = () => true;
    let searchTimer = null;

    function configure(options = {}) {
        if (typeof options.isTopicAuditRoute === 'function') routeGuard = options.isTopicAuditRoute;
    }

    function formatDate(date) {
        const value = date instanceof Date ? date : new Date(date);
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getDefaultTimeRange(now = new Date()) {
        const date = new Date(now.getTime());
        if (date.getHours() < 9) date.setDate(date.getDate() - 1);
        const day = formatDate(date);
        return { startTime: day, endTime: day };
    }

    function setInputValue(input, value) {
        if (!input || input.disabled) return false;
        try {
            const descriptor = root.HTMLInputElement &&
                Object.getOwnPropertyDescriptor(root.HTMLInputElement.prototype, 'value');
            descriptor?.set ? descriptor.set.call(input, value) : (input.value = value);
            input.dispatchEvent(new root.Event('input', { bubbles: true }));
            input.dispatchEvent(new root.Event('change', { bubbles: true }));
            return true;
        } catch (error) {
            console.error('设置日期输入值失败:', error);
            return false;
        }
    }

    function visible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect?.();
        return !rect || (rect.width > 0 && rect.height > 0);
    }

    function confirmDatePicker(picker) {
        const panel = picker?.id
            ? root.document.querySelector(`[aria-describedby="${picker.id}"]`)
            : null;
        const button = panel?.querySelector('.el-picker-panel__footer .el-button--primary');
        button?.click();
    }

    function applyDatePicker(startTime, endTime) {
        const doc = root.document;
        const rangePickers = doc.querySelectorAll('.el-date-editor.el-range-editor');
        for (const picker of rangePickers) {
            if (!visible(picker)) continue;
            const inputs = picker.querySelectorAll('input');
            if (inputs.length < 2) continue;
            if (setInputValue(inputs[0], startTime) && setInputValue(inputs[1], endTime)) {
                inputs[0].dispatchEvent(new root.Event('blur', { bubbles: true }));
                inputs[1].dispatchEvent(new root.Event('blur', { bubbles: true }));
                confirmDatePicker(picker);
                return true;
            }
        }
        for (const item of doc.querySelectorAll('.el-form-item')) {
            const label = item.querySelector('.el-form-item__label')?.textContent?.trim() || '';
            if (!label.includes('时间')) continue;
            for (const picker of item.querySelectorAll('.el-date-editor')) {
                const inputs = picker.querySelectorAll('input.el-input__inner');
                if (inputs.length < 2) continue;
                if (setInputValue(inputs[0], startTime) && setInputValue(inputs[1], endTime)) {
                    inputs[0].dispatchEvent(new root.Event('blur', { bubbles: true }));
                    inputs[1].dispatchEvent(new root.Event('blur', { bubbles: true }));
                    confirmDatePicker(picker);
                    return true;
                }
            }
        }
        return false;
    }

    function applyPlainDateInputs(startTime, endTime) {
        const doc = root.document;
        const startInputs = doc.querySelectorAll('input[placeholder*="开始日期"], input[placeholder*="开始时间"]');
        const endInputs = doc.querySelectorAll('input[placeholder*="结束日期"], input[placeholder*="结束时间"]');
        let found = false;
        startInputs.forEach(input => { found = setInputValue(input, startTime) || found; });
        endInputs.forEach(input => { found = setInputValue(input, endTime) || found; });
        return found;
    }

    function applyTimeRangeSettings(options = {}) {
        const range = options.range || getDefaultTimeRange(options.now);
        const handled = applyDatePicker(range.startTime, range.endTime);
        const plainHandled = handled ? false : applyPlainDateInputs(range.startTime, range.endTime);
        if (handled || (plainHandled && options.triggerWhenFound !== false)) {
            root.setTimeout(() => triggerSearch(), options.delay ?? 300);
        }
        return { ...range, handled: handled || plainHandled };
    }

    function findResultInput() {
        const doc = root.document;
        for (const item of doc.querySelectorAll('.el-form-item, .form-item, [class*="form-item"]')) {
            const label = item.querySelector('.el-form-item__label, .form-label, [class*="label"]');
            if (label?.textContent?.includes('机审结果')) {
                const input = item.querySelector('.el-input__inner, .el-input input, input[class*="input"]');
                if (input) return input;
            }
        }
        return [...doc.querySelectorAll('input[readonly], .el-input__inner[readonly]')]
            .find(input => input.closest('.el-form-item, .form-item, [class*="form"]')
                ?.textContent?.includes('机审结果')) || null;
    }

    function findOpenDropdown() {
        const doc = root.document;
        return doc.querySelector('.el-select-dropdown:not([style*="display: none"])')
            || doc.querySelector('.el-popper:not([style*="display: none"]) .el-select-dropdown')
            || doc.querySelector('[class*="dropdown"]:not([style*="display: none"])');
    }

    function closeDropdown(input, dropdown) {
        input?.blur();
        const body = root.document.body || root.document.documentElement;
        body?.dispatchEvent(new root.MouseEvent('click', { bubbles: true, cancelable: true }));
        root.document.dispatchEvent(new root.KeyboardEvent('keydown', {
            key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true
        }));
        dropdown?.style && (dropdown.style.display = 'none');
    }

    function chooseResult(selectedType) {
        const input = findResultInput();
        if (!input) {
            root.setTimeout(() => triggerSearch(), 500);
            return false;
        }
        input.click();
        root.setTimeout(() => {
            const dropdown = findOpenDropdown();
            const list = dropdown?.querySelector('ul.el-scrollbar__view, ul.el-select-dropdown__list, ul[role="listbox"], ul');
            const items = list ? [...list.querySelectorAll('li.el-select-dropdown__item, li[role="option"], li')] : [];
            const selected = items.filter(item => item.classList.contains('selected') ||
                item.classList.contains('is-selected') ||
                item.classList.contains('el-select-dropdown__item--selected') ||
                item.getAttribute('aria-selected') === 'true' ||
                item.textContent.trim() === '全部');
            selected.forEach(item => (item.querySelector('.el-checkbox__input, .el-radio__input, .el-checkbox, .el-radio') || item).click());
            const text = RESULT_TYPES[selectedType];
            const target = text && items.find(item => item.textContent.trim() === text || item.textContent.trim().includes(text));
            target?.click();
            closeDropdown(input, dropdown);
            root.setTimeout(() => triggerSearch(), target ? 200 : 400);
        }, 600);
        return true;
    }

    function applyResultSelection(selectedType) {
        if (!selectedType) {
            root.setTimeout(() => triggerSearch(), 500);
            return false;
        }
        return chooseResult(selectedType);
    }

    function findSearchButton() {
        const doc = root.document;
        for (const button of doc.querySelectorAll('button.el-button.ml10.el-button--primary.el-button--mini, button span')) {
            const text = (button.textContent || '').trim();
            if (text === '搜索') return button.closest('button') || button;
        }
        for (const button of doc.querySelectorAll('button, .el-button, [class*="search"], [class*="query"], input[type="button"], input[type="submit"]')) {
            const text = (button.textContent || '').trim();
            if (/搜索|查询|Search|Query|检索|查找/.test(text)) return button;
        }
        return doc.querySelector('button.el-button--primary, .el-button.el-button--primary, .ant-btn-primary, .btn-primary');
    }

    function triggerSearch() {
        if (!routeGuard()) return false;
        if (searchTimer) root.clearTimeout(searchTimer);
        const doc = root.document;
        const settled = () => !doc.querySelector('.el-select-dropdown:not([style*="display: none"])') &&
            ![...doc.querySelectorAll('.el-picker-panel')].some(panel => panel.style.display !== 'none' && visible(panel));
        const click = () => {
            if (!settled()) return root.setTimeout(click, 300);
            const button = findSearchButton();
            if (button && !button.disabled && !button.dataset.triggerSearch) {
                button.dataset.triggerSearch = 'true';
                button.click();
                root.setTimeout(() => delete button.dataset.triggerSearch, 1000);
                return true;
            }
            return false;
        };
        searchTimer = root.setTimeout(click, 800);
        return true;
    }

    function detectAndApplySettings(settings) {
        if (!routeGuard()) return false;
        let value = settings;
        if (!value) {
            try { value = JSON.parse(root.localStorage.getItem('extractContentSettings') || '{}'); } catch { value = {}; }
        }
        if (!value.autoTimeRange && !value.autoSelectResult) return false;
        root.setTimeout(() => {
            if (value.autoTimeRange) applyTimeRangeSettings();
            if (value.autoSelectResult) applyResultSelection(value.resultType || '');
            if (value.autoTimeRange || value.autoSelectResult) root.setTimeout(triggerSearch, 1000);
        }, 2000);
        return true;
    }

    root.ReviewPlusModules = root.ReviewPlusModules || {};
    root.ReviewPlusModules.auditAutomation = {
        configure,
        formatDate,
        getDefaultTimeRange,
        applyTimeRangeSettings,
        applyResultSelection,
        triggerSearch,
        detectAndApplySettings,
        chooseResult
    };
})(globalThis);
