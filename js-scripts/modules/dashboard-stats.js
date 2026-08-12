(function (root) {
    'use strict';

    const PLATFORM_CONFIG = {
        vzan: {
            shop: 'https://shop.vzan.com',
            audit: 'https://audit.vzan.com',
            live: 'https://live-gw.vzan.com',
            referer: 'https://audit-admin.vzan.com/'
        },
        xinxiang: {
            shop: 'https://shop.njyqkj0ksyz.com',
            audit: 'https://audit.njyqkj0ksyz.com',
            live: 'https://live-gw.njyqkj0ksyz.com',
            referer: 'https://audit-admin.njyqkj0ksyz.com/'
        }
    };

    function getDateRange(now = new Date()) {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return {
            date: `${year}-${month}-${day}`,
            start: `${year}-${month}-${day} 00:00:00`,
            end: `${year}-${month}-${day} 23:59:59`
        };
    }

    async function postJson(url, token, body, headers = {}) {
        const response = await root.fetch(url, {
            method: 'POST',
            headers: {
                accept: 'application/json, text/plain, */*',
                'admin-token': token,
                'content-type': 'application/json;charset=UTF-8',
                ...headers
            },
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    }

    async function fetchPendingProducts(platform, token) {
        const data = await postJson(`${PLATFORM_CONFIG[platform].shop}/api/platproduct/auditedList`, token, {
            zbId: 0, productId: 0, firstCatId: -1, secondCatId: -1, thirdCatId: -1,
            mode: -1, state: -1, beginTime: '', endTime: '', authType: -1,
            qualificationType: -1, pageIndex: 1, pageSize: 1, auditState: 1
        }, { perms: 'product', Referer: PLATFORM_CONFIG[platform].referer });
        return data?.amout ?? data?.dataObj?.amout ?? data?.Data?.amout ?? data?.data?.amout;
    }

    async function fetchMaterialCount(platform, token, riskLevel, range = getDateRange()) {
        const data = await postJson(`${PLATFORM_CONFIG[platform].audit}/v1/material_audit/page`, token, {
            page: 1, size: 1, ids: null, materialName: '', addSourceList: null, tpName: '',
            tpMachineRiskLevel: null, state: null, materialAddStartTime: range.start,
            materialAddEndTime: range.end, machineAuditStatus: null, machineRiskLevel: riskLevel,
            auditStatus: 0, zbIds: null, zbName: '', zbIndustryIdList: null
        }, { Referer: PLATFORM_CONFIG[platform].referer });
        return data?.code === 0 ? data?.data?.total : undefined;
    }

    async function fetchTopicCount(platform, token, riskLevel, range = getDateRange()) {
        const now = new Date().toISOString();
        const body = new URLSearchParams({
            isdebug: 'false', types: '-10', isaudt: '0', tag: '0', domain: '-1', site: '-2',
            modelType: '-1', livedata: '-1', stime: range.date, etime: range.date, page: '1', rows: '10',
            risk_level: '', 'riskLevelList[0]': String(riskLevel), auditType: '', mininsnsId: '0',
            wxMiniAppId: '', 'times[0]': now, 'times[1]': now, mchKey: '0', taoLeBoLiveType: '',
            zbIdList: '', tpIdList: '', appViewType: ''
        });
        const response = await root.fetch(`${PLATFORM_CONFIG[platform].live}/datalive/v1/admin/topics/GetLiveListByImpala`, {
            method: 'POST',
            headers: {
                accept: 'application/json, text/plain, */*',
                'admin-token': token,
                'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
                perms: 'topic_audit',
                Referer: PLATFORM_CONFIG[platform].referer
            },
            body: body.toString()
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data?.dataObj?.total;
    }

    async function fetchQualificationCount(platform, token, state) {
        const data = await postJson(`${PLATFORM_CONFIG[platform].shop}/api/audit/category/authlist`, token, {
            zbid: null, zbName: '', firstCatId: -1, secondCatId: -1, thirdCatId: -1,
            pageIndex: 1, pageSize: 1, state
        }, { perms: 'product', Referer: PLATFORM_CONFIG[platform].referer });
        return data?.dataObj?.total;
    }

    function setElementState(element, value, error) {
        if (!element) return;
        element.textContent = error ? '加载失败' : value ?? '获取失败';
        element.style.color = error ? '#f56c6c' : (Number(value) > 0 ? '#f56c6c' : '#67c23a');
    }

    async function updatePlatform(platform = 'vzan', options = {}) {
        const doc = options.documentRef || root.document;
        const token = options.token;
        const ids = {
            product: doc.getElementById(`${platform}-pending-products-count`),
            materialSuspicious: doc.getElementById(`${platform}-material-suspicious-count`),
            materialViolation: doc.getElementById(`${platform}-material-violation-count`),
            topicSuspicious: doc.getElementById(`${platform}-topic-suspicious-count`),
            topicViolation: doc.getElementById(`${platform}-topic-violation-count`),
            qualificationPending: doc.getElementById(`${platform}-qualification-pending-count`),
            qualificationUpdate: doc.getElementById(`${platform}-qualification-update-count`)
        };
        if (!Object.values(ids).some(Boolean)) return {};
        if (!token) {
            Object.values(ids).forEach(element => { if (element) element.textContent = 'Token无效'; });
            return {};
        }
        Object.values(ids).forEach(element => { if (element) element.textContent = '加载中...'; });
        const range = getDateRange(options.now);
        const jobs = {
            product: fetchPendingProducts(platform, token),
            materialSuspicious: fetchMaterialCount(platform, token, 2, range),
            materialViolation: fetchMaterialCount(platform, token, 3, range),
            topicSuspicious: fetchTopicCount(platform, token, 2, range),
            topicViolation: fetchTopicCount(platform, token, 3, range),
            qualificationPending: fetchQualificationCount(platform, token, 0),
            qualificationUpdate: fetchQualificationCount(platform, token, 2)
        };
        const entries = await Promise.all(Object.entries(jobs).map(async ([key, promise]) => {
            try {
                const value = await promise;
                setElementState(ids[key], value, false);
                return [key, value];
            } catch (error) {
                console.error(`仪表盘统计请求失败 (${platform}/${key}):`, error);
                setElementState(ids[key], undefined, true);
                return [key, undefined];
            }
        }));
        return Object.fromEntries(entries);
    }

    root.ReviewPlusModules = root.ReviewPlusModules || {};
    root.ReviewPlusModules.dashboardStats = {
        PLATFORM_CONFIG,
        getDateRange,
        fetchPendingProducts,
        fetchMaterialCount,
        fetchTopicCount,
        fetchQualificationCount,
        updatePlatform
    };
})(globalThis);
