(function (root) {
    'use strict';

    const basicFilters = new Set(['直播间ID', '话题ID', '话题标题', '直播状态', '人审状态', '时间', '机审结果']);
    const hiddenColumns = new Set([
        '审核方', '转播来源', '收费类型', '工单ID', '累计人数赞赏次数', '用户投诉次数', '人审状态',
        '仅APP观看', '封禁状态', '当前推流', '直播类型'
    ]);
    const columnWidths = new Map([
        ['白名单', 112], ['仅APP观看', 64], ['封禁状态', 68], ['话题ID', 104], ['主题名称', 200],
        ['机审结果', 288], ['直播间标签', 100], ['微信开放平台', 112], ['微信小程序', 104],
        ['独立域名私有话题', 150], ['分享端口', 112], ['直播状态', 96], ['当前推流', 88],
        ['开始时间', 136], ['操作', 198]
    ]);
    const stateColumns = new Set(['白名单', '仅APP观看', '封禁状态', '直播状态']);
    const stateMarkers = {
        '白名单': { '是': { icon: 'el-icon-check', tone: 'success' }, '否': { text: '否', tone: 'muted' } },
        '仅APP观看': { '是': { icon: 'el-icon-mobile-phone', tone: 'primary' }, '否': { text: '否', tone: 'muted' } },
        '封禁状态': {
            '封禁': { icon: 'el-icon-circle-close', tone: 'danger' },
            '已封禁': { icon: 'el-icon-circle-close', tone: 'danger' },
            '未封禁': { text: '正常', tone: 'muted' }
        },
        '直播状态': {
            '正在推流': { icon: 'el-icon-video-play', text: '正在推流', tone: 'success' },
            '直播中': { icon: 'el-icon-video-play', text: '直播中', tone: 'success' },
            '未开始': { icon: 'el-icon-time', text: '未开始', tone: 'warning' },
            '已结束': { icon: 'el-icon-video-pause', text: '已结束', tone: 'muted' }
        }
    };

    root.ReviewPlusTopicAudit = root.ReviewPlusTopicAudit || {};
    root.ReviewPlusTopicAudit.config = { basicFilters, hiddenColumns, columnWidths, stateColumns, stateMarkers };
})(globalThis);
