(function (root) {
    'use strict';

    function showCopyMessage(message) {
        const tableVm = document.querySelector('.list-container > .el-table')?.__vue__;
        if (typeof tableVm?.$message === 'function') {
            tableVm.$message({ message, type: 'success', duration: 1400 });
            return;
        }
        const toast = document.createElement('div');
        toast.className = 'topic-audit-copy-toast';
        toast.textContent = message;
        document.body.append(toast);
        setTimeout(() => toast.remove(), 1400);
    }

    async function copyText(value, message = `已复制：${value}`) {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
        } catch {
            const input = document.createElement('textarea');
            input.value = value;
            input.style.position = 'fixed';
            input.style.opacity = '0';
            document.body.append(input);
            input.select();
            document.execCommand('copy');
            input.remove();
        }
        showCopyMessage(message);
    }

    function copyCellValue(cell) {
        return copyText(cell?.dataset.topicAuditCopyValue);
    }

    root.ReviewPlusTopicAudit = root.ReviewPlusTopicAudit || {};
    root.ReviewPlusTopicAudit.copy = { copyText, copyCellValue };
})(globalThis);
