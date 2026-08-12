(function (root) {
    'use strict';

    const platformConfig = {
        vzan: {
            label: '微赞',
            api: 'https://live-gw.vzan.com/datalive/v1/livecenter/siteinfo/livecenter_sitelist_by_impala',
            referer: 'https://audit-admin.vzan.com/'
        },
        xinxiang: {
            label: '星享',
            api: 'https://live-gw.njyqkj0ksyz.com/datalive/v1/livecenter/siteinfo/livecenter_sitelist_by_impala',
            referer: 'https://audit-admin.njyqkj0ksyz.com/'
        }
    };
    const columns = [
        '直播间ID', '用户ID', '直播间名称', '手机号', '直播间描述', '直播间状态', '封禁状态',
        '封禁标识(mininsnsId)', '限制直播', '限制直播开始时间', '限制直播结束时间', '限制支付',
        '限制支付开始时间', '限制支付结束时间', '限制历史', '版本', '省份', '城市', '区县', '标签',
        '话题数据', '创建时间', '查询状态', '失败原因'
    ];

    function getDefaultPlatform() {
        return (root.location?.hostname || '').includes('njyqkj0ksyz') ? 'xinxiang' : 'vzan';
    }

    function getPlatformConfig(platform) {
        return platformConfig[platform] || platformConfig.vzan;
    }

    function parseIds(text) {
        const seen = new Set();
        const ids = [];
        String(text || '').split(/\r?\n/).map(line => line.trim()).forEach(id => {
            if (id && /^\d+$/.test(id) && !seen.has(id)) {
                seen.add(id);
                ids.push(id);
            }
        });
        return ids;
    }

    function boolToText(value) {
        if (value === null || value === undefined) return '';
        return value ? '是' : '否';
    }

    function mapRoomState(state) {
        if (state === 1) return '正常';
        if (state === 0) return '删除';
        return state === undefined || state === null ? '' : String(state);
    }

    function formatRow(zbid, roomData, error) {
        if (!roomData) {
            return Object.fromEntries(columns.map(column => [
                column,
                column === '直播间ID' ? zbid
                    : column === '查询状态' ? '失败'
                        : column === '失败原因' ? error || '未知错误' : ''
            ]));
        }
        const mininsnsId = roomData.mininsnsId;
        return {
            '直播间ID': roomData.id || zbid,
            '用户ID': roomData.userId || '',
            '直播间名称': roomData.name || '',
            '手机号': roomData.phone || '',
            '直播间描述': roomData.descript || '',
            '直播间状态': mapRoomState(roomData.state),
            '封禁状态': mininsnsId === -1 ? '已封禁' : '未封禁',
            '封禁标识(mininsnsId)': mininsnsId === undefined || mininsnsId === null ? '' : String(mininsnsId),
            '限制直播': boolToText(roomData.limitStartLive),
            '限制直播开始时间': roomData.limitStartLiveStartTime || '',
            '限制直播结束时间': roomData.limitStartLiveEndTime || '',
            '限制支付': boolToText(roomData.limitSitePay),
            '限制支付开始时间': roomData.limitPayStartTime || '',
            '限制支付结束时间': roomData.limitPayEndTime || '',
            '限制历史': boolToText(roomData.limitHistory),
            '版本': roomData.versionName || '',
            '省份': roomData.provregion?.areaname || '',
            '城市': roomData.cityregion?.areaname || '',
            '区县': roomData.arearegion?.areaname || '',
            '标签': roomData.tagName || '',
            '话题数据': roomData.subjectTag || roomData.myQRCode || '',
            '创建时间': roomData.addtime || '',
            '查询状态': '成功',
            '失败原因': ''
        };
    }

    async function fetchOne(zbid, adminToken, config) {
        if (!config?.api) throw new Error('未找到平台配置');
        const response = await fetch(config.api, {
            method: 'POST',
            headers: {
                accept: 'application/json, text/plain, */*',
                'admin-token': adminToken,
                'content-type': 'application/json;charset=UTF-8',
                perms: 'liveroom',
                Referer: config.referer,
                priority: 'u=1, i'
            },
            body: JSON.stringify({
                id: Number(zbid), mchKey: 0, page: 1, rows: 10,
                limitStartLive: false, limitSitePay: false, tagId: 0
            })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data?.isok) throw new Error(data?.Msg || data?.msg || '接口返回失败');
        const rows = data.dataObj?.rows || [];
        if (!rows.length) throw new Error('未找到直播间信息');
        return rows[0];
    }

    async function query({ platform = 'vzan', input = '' }, onProgress = () => {}) {
        const ids = parseIds(input);
        if (!ids.length) throw new Error('请输入有效的直播间 ID（仅数字，每行一个）');
        const adminToken = root.ReviewPlusModules?.userContext?.getAdminToken();
        if (!adminToken) throw new Error('无法获取 Admin-Token，请重新登录后重试');
        const config = getPlatformConfig(platform);
        const rows = [];
        for (let index = 0; index < ids.length; index++) {
            const id = ids[index];
            try {
                rows.push(formatRow(id, await fetchOne(id, adminToken, config), null));
            } catch (error) {
                rows.push(formatRow(id, null, error.message));
            }
            onProgress({ current: index + 1, total: ids.length, id, ok: rows.at(-1)['查询状态'] === '成功' });
            if (index < ids.length - 1) await new Promise(resolve => setTimeout(resolve, 200));
        }
        return { columns, rows, platformLabel: config.label };
    }

    root.ReviewPlusModules = root.ReviewPlusModules || {};
    root.ReviewPlusModules.liveRoomQuery = {
        platformConfig, columns, getDefaultPlatform, getPlatformConfig, parseIds, fetchOne, formatRow, query
    };
})(globalThis);
