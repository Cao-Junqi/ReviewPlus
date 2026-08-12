(function (root) {
    'use strict';

    function getAuditScore(row) {
        const levels = row?.auditRecord?.riskLevels;
        if (!Array.isArray(levels)) return 0;
        return levels.reduce((total, item) => {
            return total + ([2, 3].includes(Number(item?.riskLevel)) ? Number(item?.num) || 0 : 0);
        }, 0);
    }

    function isActiveStream(value) {
        return Boolean(value?.trim() && value.trim() !== '00:00:00');
    }

    function buildExtractText({ liveId, roomName, topicId, title, tag, domain }) {
        const value = input => String(input ?? '').trim() || '-';
        return [
            `直播间 ID：${value(liveId)}（${value(roomName)}）`,
            `话题 ID：${value(topicId)}（${value(title)}）`,
            `标签：${value(tag)}`,
            `域名：${value(domain)}`
        ].join('\n');
    }

    root.ReviewPlusTopicAudit = root.ReviewPlusTopicAudit || {};
    root.ReviewPlusTopicAudit.utils = { getAuditScore, isActiveStream, buildExtractText };
})(globalThis);
