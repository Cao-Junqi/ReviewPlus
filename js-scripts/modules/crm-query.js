(function (root) {
    'use strict';

    const defaultApiHost = 'https://api-bj.clink.cn';
    const apiHosts = new Set(['https://api-bj.clink.cn', 'https://api-sh.clink.cn']);
    const columns = ['直播间ID', 'C-Link客户ID', 'C-Link客户名称', 'CRM群名称', 'CRM标签', 'CRM查询状态', 'CRM失败原因', '查询状态'];
    const fieldCache = new Map();
    const fieldRequests = new Map();
    const labelCache = new Map();
    const labelRequests = new Map();

    function getConfig(settings = {}) {
        const apiHost = String(settings.crmApiHost || defaultApiHost).replace(/\/+$/, '');
        return {
            enabled: settings.crmEnabled === true,
            apiHost: apiHosts.has(apiHost) ? apiHost : defaultApiHost,
            accessKeyId: String(settings.crmAccessKeyId || '').trim(),
            accessKeySecret: String(settings.crmAccessKeySecret || '').trim()
        };
    }

    function isConfigured(config) {
        return Boolean(config?.enabled && config.accessKeyId && config.accessKeySecret);
    }

    function encodeParams(params) {
        return Object.keys(params).sort()
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
            .join('&');
    }

    function buildStringToSign(method, host, path, params) {
        return `${method.toUpperCase()}${host}${path}?${encodeParams(params)}`;
    }

    async function signParams(method, url, config, extraParams = {}) {
        if (!root.crypto?.subtle || typeof root.TextEncoder === 'undefined') {
            throw new Error('当前浏览器不支持 CRM 请求签名');
        }
        const target = new URL(url, config.apiHost);
        const common = {
            AccessKeyId: config.accessKeyId,
            Expires: '60',
            Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            ...extraParams
        };
        const stringToSign = buildStringToSign(method, target.host, target.pathname, common);
        const key = await root.crypto.subtle.importKey(
            'raw', new root.TextEncoder().encode(config.accessKeySecret),
            { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
        );
        const digest = await root.crypto.subtle.sign('HMAC', key, new root.TextEncoder().encode(stringToSign));
        let binary = '';
        new Uint8Array(digest).forEach(byte => { binary += String.fromCharCode(byte); });
        return `${target.origin}${target.pathname}?${encodeParams({ ...common, Signature: btoa(binary) })}`;
    }

    function requestApi(options) {
        return new Promise((resolve, reject) => {
            root.GM_xmlhttpRequest({
                method: options.method || 'GET', url: options.url, headers: options.headers,
                data: options.data, responseType: 'text', timeout: 20000,
                onload(response) {
                    try {
                        const data = JSON.parse(response.responseText || 'null');
                        if (response.status < 200 || response.status >= 300) {
                            reject(new Error(data?.error?.message || data?.message || data?.msg || `HTTP ${response.status}`));
                        } else if (data?.error) {
                            reject(new Error(data.error.message || data.error.code || 'CRM 接口错误'));
                        } else if (data?.code !== undefined && data.code !== 0) {
                            reject(new Error(data.msg || data.message || `CRM 接口错误（${data.code}）`));
                        } else {
                            resolve(data || {});
                        }
                    } catch {
                        reject(new Error(response.status < 200 || response.status >= 300
                            ? `HTTP ${response.status}` : 'CRM 接口返回了无效 JSON'));
                    }
                },
                onerror: () => reject(new Error('CRM 请求失败')),
                ontimeout: () => reject(new Error('CRM 请求超时'))
            });
        });
    }

    async function callApi(path, config, { method = 'POST', body = null, query = {} } = {}) {
        const url = await signParams(method, `${config.apiHost}${path}`, config, query);
        return requestApi({
            method, url,
            headers: body === null ? { accept: 'application/json, text/plain, */*' } : {
                accept: 'application/json, text/plain, */*', 'content-type': 'application/json;charset=UTF-8'
            },
            data: body === null ? undefined : JSON.stringify(body)
        });
    }

    function parseCustomer(fields) {
        const list = Array.isArray(fields) ? fields : [];
        return {
            id: Number(list.find(field => Number(field?.key) === -1)?.value),
            name: String(list.find(field => field?.name === '客户名称')?.value || '').trim()
        };
    }

    async function getCustomerNameFieldId(config) {
        const key = `${config.apiHost}:${config.accessKeyId}`;
        if (fieldCache.has(key)) return fieldCache.get(key);
        if (!fieldRequests.has(key)) {
            const request = callApi('/crm/customer_params', config, { method: 'GET' })
                .then(data => {
                    const field = (data.customerParams || []).find(item => item.name === '客户名称');
                    if (!field?.id) throw new Error('CRM 未找到“客户名称”字段');
                    fieldCache.set(key, field.id);
                    return field.id;
                }).finally(() => fieldRequests.delete(key));
            fieldRequests.set(key, request);
        }
        return fieldRequests.get(key);
    }

    async function getLabelMap(config) {
        const key = `${config.apiHost}:${config.accessKeyId}`;
        if (labelCache.has(key)) return labelCache.get(key);
        if (!labelRequests.has(key)) {
            const request = callApi('/crm/list_customer_labels', config, { body: {} })
                .then(data => {
                    const map = new Map();
                    (data.customerLabels || []).forEach(group => (group.customerLabelList || []).forEach(label => {
                        if (label?.id !== undefined) map.set(String(label.id), String(label.name || label.id));
                    }));
                    labelCache.set(key, map);
                    return map;
                }).finally(() => labelRequests.delete(key));
            labelRequests.set(key, request);
        }
        return labelRequests.get(key);
    }

    function formatCustomer(customer, labelMap) {
        if (!customer) return { name: '', tags: '', status: '未找到', error: '' };
        const tags = (Array.isArray(customer.labelIds) ? customer.labelIds : [])
            .map(id => labelMap.get(String(id)) || `ID:${id}`);
        return { name: String(customer.name || '').trim(), tags: tags.join(', '), status: '成功', error: '' };
    }

    async function queryByCustomerName(customerName, config) {
        if (!isConfigured(config)) return { name: '', tags: '', status: '未配置', error: '' };
        const name = String(customerName || '').trim();
        if (!name) return { name: '', tags: '', status: '缺少客户名称', error: '' };
        const fieldId = await getCustomerNameFieldId(config);
        const data = await callApi('/crm/list_customers', config, {
            method: 'GET', query: { offset: '0', limit: '100', customerParams: JSON.stringify({ [fieldId]: name }) }
        });
        const customers = (data.customers || []).map(parseCustomer)
            .filter(item => Number.isFinite(item.id) && item.id > 0);
        const matched = customers.find(item => item.name === name);
        if (!matched) return { name: '', tags: '', status: '未找到', error: '' };
        const groupData = await callApi('/crm/query_group_customer', config, { body: { customerId: matched.id } });
        return { customerId: matched.id, customerName: matched.name, ...formatCustomer(groupData.customer, await getLabelMap(config)) };
    }

    async function query({ input = '', config }, onProgress = () => {}) {
        const ids = root.ReviewPlusModules?.liveRoomQuery?.parseIds(input) || [];
        if (!ids.length) throw new Error('请输入有效的直播间 ID（仅数字，每行一个）');
        if (!isConfigured(config)) {
            return {
                columns,
                rows: ids.map(id => ({ '直播间ID': id, 'C-Link客户ID': '', 'C-Link客户名称': '', 'CRM群名称': '', 'CRM标签': '', 'CRM查询状态': '未配置', 'CRM失败原因': '请先启用 CRM 查询并填写 AccessKey', '查询状态': '失败' }))
            };
        }
        const rows = [];
        for (let index = 0; index < ids.length; index++) {
            const id = ids[index];
            try {
                const crm = await queryByCustomerName(id, config);
                rows.push({ '直播间ID': id, 'C-Link客户ID': crm.customerId || '', 'C-Link客户名称': crm.customerName || '', 'CRM群名称': crm.name, 'CRM标签': crm.tags, 'CRM查询状态': crm.status, 'CRM失败原因': crm.error, '查询状态': crm.status === '成功' ? '成功' : '失败' });
            } catch (error) {
                rows.push({ '直播间ID': id, 'C-Link客户ID': '', 'C-Link客户名称': '', 'CRM群名称': '', 'CRM标签': '', 'CRM查询状态': '失败', 'CRM失败原因': error.message, '查询状态': '失败' });
            }
            onProgress({ current: index + 1, total: ids.length, id, ok: rows.at(-1)['查询状态'] === '成功' });
            if (index < ids.length - 1) await new Promise(resolve => setTimeout(resolve, 200));
        }
        return { columns, rows };
    }

    root.ReviewPlusModules = root.ReviewPlusModules || {};
    root.ReviewPlusModules.crmQuery = {
        defaultApiHost, apiHosts, columns, getConfig, isConfigured, encodeParams, buildStringToSign,
        signParams, requestApi, callApi, parseCustomer, formatCustomer, queryByCustomerName, query
    };
})(globalThis);
