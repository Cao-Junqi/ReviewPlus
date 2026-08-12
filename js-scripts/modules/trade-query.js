(function (root) {
    'use strict';

    const columns = [
        '交易单号', '订单ID', '订单状态', '账户类型', '下单用户ID', '联系电话', '收款用户（ID/昵称）',
        '直播间ID', '创建者联系方式', '频道/话题 ID', '下单时间', '支付说明', '配送方式', '门店名称',
        '门店电话', '门店地址', '核销时间', '发货时间', '快递单号', '收货时间', '退款时间', '查询状态', '查询方式'
    ];
    const platformConfig = {
        api: 'https://ntestvt.vzan.com/liveadmin/orderquery',
        referer: 'https://ntestvt.vzan.com/liveadmin/updatecache'
    };

    function parseNumbers(text) {
        const seen = new Set();
        const numbers = [];
        String(text || '').split(/\r?\n/).map(line => line.trim()).forEach(number => {
            if (number && !seen.has(number)) {
                seen.add(number);
                numbers.push(number);
            }
        });
        return numbers;
    }

    function request(number, field, config) {
        const orderno = field === 'orderno' ? number : '';
        const tradeno = field === 'tradeno' ? number : '';
        return new Promise((resolve, reject) => {
            root.GM_xmlhttpRequest({
                method: 'POST',
                url: config.api,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    Accept: '*/*',
                    'X-Requested-With': 'XMLHttpRequest',
                    Referer: config.referer
                },
                data: `otp=0&orderno=${encodeURIComponent(orderno)}&tradeno=${encodeURIComponent(tradeno)}`,
                onload(response) {
                    try {
                        resolve(JSON.parse(response.responseText));
                    } catch {
                        reject(new Error('解析响应失败'));
                    }
                },
                onerror: () => reject(new Error('网络请求失败')),
                ontimeout: () => reject(new Error('请求超时'))
            });
        });
    }

    async function fetchOne(number, config = platformConfig) {
        for (const [field, queryMethod] of [['tradeno', '微信订单号'], ['orderno', '微赞订单号']]) {
            try {
                const result = await request(number, field, config);
                if (result?.isok && result.data !== null) return { data: result.data, queryMethod };
            } catch (error) {
                console.warn(`[交易查询] ${queryMethod}查询失败: ${error.message}`);
            }
        }
        throw new Error('未找到订单信息');
    }

    function formatRow(number, result, error) {
        if (error) {
            return Object.fromEntries(columns.map(column => [
                column,
                column === '交易单号' ? number
                    : column === '查询状态' ? '失败'
                        : column === '查询方式' ? error : ''
            ]));
        }
        const data = Array.isArray(result.data) ? result.data[0] : result.data;
        return {
            '交易单号': number,
            '订单ID': data.id || '',
            '订单状态': data.orderStatus || '',
            '账户类型': data.accountTypeStr || '',
            '下单用户ID': data.fuserid || '',
            '联系电话': data.phone || '',
            '收款用户（ID/昵称）': data.tuser || '',
            '直播间ID': data.zbid || '',
            '创建者联系方式': data.creator || '',
            '频道/话题 ID': data.topicid || '',
            '下单时间': data.addTime || '',
            '支付说明': data.showNote || '',
            '配送方式': data.deliveryTypeStr || '',
            '门店名称': data.storeName || '',
            '门店电话': data.storePhone || '',
            '门店地址': data.storeAddress || '',
            '核销时间': data.verifyTimeStr || '',
            '发货时间': data.deliveryTimeStr || '',
            '快递单号': data.deliveryNoStr || '',
            '收货时间': data.receivingTimeStr || '',
            '退款时间': data.refundTimeStr || '',
            '查询状态': '成功',
            '查询方式': result.queryMethod
        };
    }

    async function query({ input = '' }, onProgress = () => {}) {
        const numbers = parseNumbers(input);
        if (!numbers.length) throw new Error('请输入有效的交易单号（每行一个）');
        const rows = [];
        for (let index = 0; index < numbers.length; index++) {
            const number = numbers[index];
            try {
                rows.push(formatRow(number, await fetchOne(number), null));
            } catch (error) {
                rows.push(formatRow(number, null, error.message));
            }
            onProgress({ current: index + 1, total: numbers.length, id: number, ok: rows.at(-1)['查询状态'] === '成功' });
            if (index < numbers.length - 1) await new Promise(resolve => setTimeout(resolve, 300));
        }
        return { columns, rows };
    }

    root.ReviewPlusModules = root.ReviewPlusModules || {};
    root.ReviewPlusModules.tradeQuery = { columns, platformConfig, parseNumbers, fetchOne, formatRow, query };
})(globalThis);
