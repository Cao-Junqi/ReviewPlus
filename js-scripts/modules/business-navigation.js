(function (root) {
    'use strict';

    function navigate({ path, platform } = {}) {
        if (path === '#/liveadmin/updatecache') {
            window.open('https://ntestvt.vzan.com/liveadmin/updatecache', '_blank');
            return '已在新标签页打开交易单号查询';
        }
        const currentPlatform = location.hostname.includes('njyqkj0ksyz') ? 'xinxiang' : 'vzan';
        if (platform && platform !== currentPlatform) {
            const host = platform === 'xinxiang'
                ? 'https://audit-admin.njyqkj0ksyz.com/'
                : 'https://audit-admin.vzan.com/';
            location.href = host + (path || location.hash || '#/index');
        } else if (path) {
            location.hash = path;
        }
        return '页面正在跳转';
    }

    root.ReviewPlusModules = root.ReviewPlusModules || {};
    root.ReviewPlusModules.navigation = { navigate };
})(globalThis);
