// ==================== 调试工具 ====================

// 调试开关：在控制台执行 debugMode = true 开启调试
let debugMode = false;

/**
 * 调试日志 - 仅在 debugMode = true 时输出
 * @param {string} tag - 调试标签
 * @param {any} data - 要输出的数据
 */
function debug(tag, data) {
    if (!debugMode) return;
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] [DEBUG] [${tag}]`, data);
}

/**
 * 调试日志 - 仅在 debugMode = true 时输出
 * @param {string} tag - 调试标签
 * @param {any} data - 要输出的数据
 */
function debugError(tag, data) {
    if (!debugMode) return;
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.error(`[${timestamp}] [ERROR] [${tag}]`, data);
}

/**
 * 安全地脱敏显示敏感信息
 * @param {string} str - 原始字符串
 * @param {number} showChars - 开头显示的字符数
 * @param {number} hideChars - 末尾隐藏的字符数
 */
function maskSensitive(str, showChars = 4, hideChars = 4) {
    if (!str || typeof str !== 'string') return str;
    if (str.length <= showChars + hideChars) return str.substring(0, showChars) + '***';
    return str.substring(0, showChars) + '...' + str.substring(str.length - hideChars);
}

// 在控制台暴露调试开关
window.debugMode = debugMode;
window.enableDebug = () => { debugMode = true; window.debugMode = true; console.log('🐛 调试模式已开启'); };
window.disableDebug = () => { debugMode = false; window.debugMode = false; console.log('🔒 调试模式已关闭'); };

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 大航海视频下载神器已加载，在控制台执行 enableDebug() 开启调试模式');
    // 页面切换相关
    initPageNavigation();
    // 加载配置
    loadConfig();
    // 更新配置预览
    updateConfigPreview();
    // 绑定原有事件
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfigAndReturn);
    document.getElementById('startBtn').addEventListener('click', startProcess);
    document.getElementById('stopBtn').addEventListener('click', stopProcess);
    document.getElementById('resetBtn').addEventListener('click', resetProcess);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
});

// ==================== 页面切换功能 ====================

function initPageNavigation() {
    const mainPage = document.getElementById('mainPage');
    const settingsPage = document.getElementById('settingsPage');
    const toSettingsBtn = document.getElementById('toSettingsBtn');
    const backToMainBtn = document.getElementById('backToMainBtn');

    // 前往设置页
    toSettingsBtn.addEventListener('click', () => {
        switchPage(mainPage, settingsPage);
    });

    // 返回主页
    backToMainBtn.addEventListener('click', () => {
        switchPage(settingsPage, mainPage);
    });
}

function switchPage(fromPage, toPage) {
    // 添加退出动画
    fromPage.classList.add('fade-out');

    setTimeout(() => {
        fromPage.style.display = 'none';
        fromPage.classList.remove('fade-out');
        toPage.style.display = 'block';
    }, 300);
}

// ==================== 配置管理模块 ====================

function loadConfig() {
    const keys = ['appId', 'appSecret', 'baseToken', 'tableId', 'fieldVideo', 'fieldScript', 'saveDir'];
    chrome.storage.local.get(keys, (result) => {
        keys.forEach(key => {
            if (result[key]) {
                const input = document.getElementById(key);
                if (input) input.value = result[key];
            }
        });
        updateConfigPreview();
    });
}

function saveConfig() {
    const keys = ['appId', 'appSecret', 'baseToken', 'tableId', 'fieldVideo', 'fieldScript', 'saveDir'];
    const data = {};
    keys.forEach(key => {
        const input = document.getElementById(key);
        if (input) data[key] = input.value.trim();
    });
    chrome.storage.local.set(data, () => {
        updateConfigPreview();
        log('✅ 配置已保存');
    });
}

function saveConfigAndReturn() {
    const keys = ['appId', 'appSecret', 'baseToken', 'tableId', 'fieldVideo', 'fieldScript', 'saveDir'];
    const data = {};
    keys.forEach(key => {
        const input = document.getElementById(key);
        if (input) data[key] = input.value.trim();
    });
    chrome.storage.local.set(data, () => {
        updateConfigPreview();
        // 返回主页
        const settingsPage = document.getElementById('settingsPage');
        const mainPage = document.getElementById('mainPage');
        switchPage(settingsPage, mainPage);
    });
}

function updateConfigPreview() {
    const keys = ['appId', 'baseToken', 'tableId', 'saveDir'];
    chrome.storage.local.get(keys, (result) => {
        keys.forEach(key => {
            const previewEl = document.getElementById('preview' + key.charAt(0).toUpperCase() + key.slice(1));
            if (previewEl) {
                const value = result[key];
                if (value && value.length > 0) {
                    previewEl.textContent = value;
                    previewEl.classList.remove('empty');
                } else {
                    previewEl.textContent = key === 'saveDir' ? 'FeishuVideos' : '未配置';
                    previewEl.classList.add('empty');
                }
            }
        });
    });
}

function clearHistory() {
    if(confirm('确定要清除下载历史记录吗？这将导致下次重新下载所有文件。')) {
        chrome.storage.local.remove('downloadHistory', () => log('🗑️ 下载历史已清除'));
    }
}

// ==================== 核心流程控制 ====================

let isProcessing = false;
let isStopped = false; // 用户是否点击了停止
let downloadQueue = [];
let totalTasks = 0;
let completedTasks = 0;
const CONCURRENCY = 3;
let activeDownloads = 0;

async function startProcess() {
    if (isProcessing) return;

    debug('PROCESS_START', '开始处理流程');
    isProcessing = true;
    isStopped = false; // 重置停止标志

    // 更新按钮显示
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'flex';
    document.getElementById('resetBtn').style.display = 'none';
    document.getElementById('clearHistoryBtn').style.display = 'none';

    document.getElementById('startBtn').innerHTML = `
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" class="spin">
            <circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.5" stroke-dasharray="44" stroke-dashoffset="11"/>
        </svg>
        处理中...
    `;
    downloadQueue = [];
    totalTasks = 0;
    completedTasks = 0;
    activeDownloads = 0;
    updateProgress(0, 0);
    document.getElementById('logArea').innerHTML = '';

    const config = await getConfig();
    debug('CONFIG_LOADED', {
        hasAppId: !!config.appId,
        hasAppSecret: !!config.appSecret,
        baseToken: maskSensitive(config.baseToken),
        tableId: maskSensitive(config.tableId),
        fieldVideo: config.fieldVideo,
        fieldName: config.fieldName,
        saveDir: config.saveDir
    });
    if (!config.appId || !config.appSecret) {
        log('❌ 错误: 请先配置 App ID 和 Secret');
        finish();
        return;
    }

    try {
        log('🔑 正在获取 Tenant Access Token...');
        const token = await getTenantAccessToken(config.appId, config.appSecret);

        log('📄 正在获取多维表格记录...');
        const records = await fetchTableRecords(token, config);

        if (records.length === 0) {
            log('⚠️ 表格中没有数据 (0条记录)');
            finish();
            return;
        }

        log(`📊 获取到 ${records.length} 条记录，开始解析...`);
        const tasks = await parseRecordsToTasks(token, records, config);

        if (tasks.length === 0) {
            log('⚠️ 未解析到任何视频链接。请检查字段名配置。');
            finish();
            return;
        }

        log(`✅ 解析完成，发现 ${tasks.length} 个有效链接`);

        // 去重
        const history = await getDownloadHistory();
        debug('HISTORY_LOADED', { historySize: history.length, sample: history.slice(0, 3) });
        const newTasks = tasks.filter(t => !history.includes(t.uniqueId));
        debug('DEDUPE_RESULT', { totalTasks: tasks.length, newTasks: newTasks.length, duplicates: tasks.length - newTasks.length });

        log(`🔍 去重后剩余 ${newTasks.length} 个新文件待下载`);

        if (newTasks.length === 0) {
            log('🎉 所有文件均已下载过。');
            finish();
            return;
        }

        totalTasks = newTasks.length;
        downloadQueue = newTasks;
        debug('QUEUE_INIT', { totalTasks, concurrency: CONCURRENCY });
        processQueue(config.saveDir);

    } catch (e) {
        debugError('PROCESS_ERROR', e);
        log(`❌ 发生错误: ${e.message}`);
        console.error(e);
        finish();
    }
}

// ==================== 飞书 API 交互模块 ====================

async function getTenantAccessToken(appId, appSecret) {
    debug('AUTH_START', { appId: maskSensitive(appId), appSecret: maskSensitive(appSecret) });
    try {
        const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ "app_id": appId, "app_secret": appSecret })
        });
        const data = await res.json();
        debug('AUTH_RESPONSE', { code: data.code, msg: data.msg, hasToken: !!data.tenant_access_token });
        if (data.code !== 0) {
            debugError('AUTH_FAILED', { code: data.code, msg: data.msg });
            throw new Error(`鉴权失败: ${data.msg}`);
        }
        debug('AUTH_SUCCESS', { token: maskSensitive(data.tenant_access_token, 8, 8) });
        return data.tenant_access_token;
    } catch (e) {
        debugError('AUTH_ERROR', e);
        throw new Error("连接飞书鉴权接口失败");
    }
}

async function fetchTableRecords(token, config) {
    debug('FETCH_RECORDS_START', {
        baseToken: maskSensitive(config.baseToken),
        tableId: maskSensitive(config.tableId),
        fieldVideo: config.fieldVideo,
        fieldScript: config.fieldScript,
        startScriptNo: config.startScriptNo,
        token: maskSensitive(token, 8, 8)
    });

    // 只获取需要的字段，减少数据传输量
    // 注意：record_id 是系统自带的，不需要在 field_names 中指定
    const fields = [];
    if (config.fieldVideo) fields.push(config.fieldVideo);
    if (config.fieldScript) fields.push(config.fieldScript);

    const allItems = [];
    let pageToken = '';
    let pageCount = 0;
    const pageSize = 100; // 每页100条，平衡性能和效率

    debug('FETCH_RECORDS_FIELDS', { fields: fields.length > 0 ? fields.join(', ') : '(所有字段)' });

    do {
        pageCount++;
        let url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.baseToken}/tables/${config.tableId}/records?page_size=${pageSize}`;

        // 添加字段过滤（只在有字段时才添加）
        if (fields.length > 0) {
            url += `&field_names=${encodeURIComponent(JSON.stringify(fields))}`;
        }

        // 添加分页标记
        if (pageToken) {
            url += `&page_token=${encodeURIComponent(pageToken)}`;
        }

        debug('FETCH_PAGE_START', {
            pageNum: pageCount,
            pageSize,
            hasPageToken: !!pageToken,
            url: url.substring(0, 100) + '...'
        });

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        debug('FETCH_PAGE_RESPONSE', {
            pageNum: pageCount,
            code: data.code,
            itemCount: data.data?.items?.length || 0,
            hasMore: !!data.data?.page_token
        });

        if (data.code !== 0) {
            debugError('FETCH_PAGE_FAILED', { pageNum: pageCount, code: data.code, msg: data.msg });
            throw new Error(`获取记录失败 (第${pageCount}页): ${data.msg}`);
        }

        const items = data.data.items || [];
        allItems.push(...items);

        debug('FETCH_PAGE_SUCCESS', {
            pageNum: pageCount,
            itemsCount: items.length,
            totalSoFar: allItems.length
        });

        // 获取下一页的标记
        pageToken = data.data.page_token || '';

    } while (pageToken); // 只要有 page_token 就继续获取

    debug('FETCH_RECORDS_COMPLETE', {
        totalPages: pageCount,
        totalItems: allItems.length,
        fieldsRequested: fields.join(', ')
    });

    return allItems;
}

/**
 * 提取脚本号中的数字部分进行比较
 * @param {string} scriptNo - 脚本号，例如 "AITSfym000570"
 * @returns {number} 提取的数字，例如 570
 */
function extractScriptNumber(scriptNo) {
    if (!scriptNo) return 0;
    // 提取所有数字
    const match = scriptNo.match(/\d+/g);
    if (!match || match.length === 0) return 0;
    // 取最后一个数字（通常是序号）
    return parseInt(match[match.length - 1], 10) || 0;
}

/**
 * 比较两个脚本号，返回 true 表示 scriptNo1 >= scriptNo2
 * 只比较最后6位的数字序号，忽略前缀
 * @param {string} scriptNo1 - 脚本号1
 * @param {string} scriptNo2 - 脚本号2
 * @returns {boolean}
 */
function isScriptNoGreaterOrEqual(scriptNo1, scriptNo2) {
    const num1 = extractScriptNumber(scriptNo1);
    const num2 = extractScriptNumber(scriptNo2);
    return num1 >= num2;
}

async function parseRecordsToTasks(token, items, config) {
    debug('PARSE_START', {
        itemCount: items.length,
        fieldVideo: config.fieldVideo,
        fieldScript: config.fieldScript,
        startScriptNo: config.startScriptNo
    });

    // 如果设置了起始脚本号，记录日志
    if (config.startScriptNo) {
        const startNum = extractScriptNumber(config.startScriptNo);
        log(`🔖 起始脚本号: ${config.startScriptNo} (序号 >= ${startNum})`);
        debug('PARSE_START_SCRIPT_NO', {
            startScriptNo: config.startScriptNo,
            startNumber: startNum
        });
    }

    const tasks = [];
    const fileTokens = [];
    const tempTaskMap = [];

    // 智能诊断日志
    if (items.length > 0) {
        const firstFields = items[0].fields;
        const availableKeys = Object.keys(firstFields);
        debug('PARSE_FIELDS', { availableKeys, configFieldVideo: config.fieldVideo, configFieldScript: config.fieldScript });
        if (!availableKeys.includes(config.fieldVideo)) {
            log(`❌ 找不到字段 "${config.fieldVideo}"`);
            log(`ℹ️ 可用字段: [ ${availableKeys.join(', ')} ]`);
            return [];
        }
    }

    let linkCount = 0;
    let textCount = 0;
    let attachmentCount = 0;
    let skippedCount = 0;
    let scriptFilteredCount = 0; // 被脚本号过滤掉的记录数

    for (const item of items) {
        const fields = item.fields;
        const videoField = fields[config.fieldVideo];

        // 脚本号筛选逻辑
        if (config.fieldScript && config.startScriptNo) {
            const scriptField = fields[config.fieldScript];
            const currentScriptNo = scriptField ? String(scriptField).trim() : '';

            if (currentScriptNo) {
                const currentNum = extractScriptNumber(currentScriptNo);
                const startNum = extractScriptNumber(config.startScriptNo);

                if (!isScriptNoGreaterOrEqual(currentScriptNo, config.startScriptNo)) {
                    scriptFilteredCount++;
                    debug('PARSE_SKIP_BY_SCRIPT', {
                        scriptNo: currentScriptNo,
                        scriptNumber: currentNum,
                        startScriptNo: config.startScriptNo,
                        startNumber: startNum,
                        reason: `脚本号 ${currentNum} < 起始 ${startNum}`
                    });
                    continue; // 跳过小于起始脚本号的记录
                }

                debug('PARSE_KEEP_BY_SCRIPT', {
                    scriptNo: currentScriptNo,
                    scriptNumber: currentNum,
                    startNumber: startNum
                });
            }
        }

        // 获取文件名（使用脚本号字段）
        let nameBase = item.record_id;
        if (config.fieldScript && fields[config.fieldScript]) {
            const scriptObj = fields[config.fieldScript];
            if (typeof scriptObj === 'object' && scriptObj.text) {
                nameBase = scriptObj.text;
            } else if (typeof scriptObj === 'object' && Array.isArray(scriptObj)) {
                nameBase = scriptObj[0].text || scriptObj[0];
            } else {
                nameBase = String(scriptObj);
            }
        }

        if (!videoField) {
            skippedCount++;
            continue;
        }

        // 处理超链接字段类型
        if (typeof videoField === 'object' && !Array.isArray(videoField) && videoField.link) {
            const linkUrl = videoField.link;
            linkCount++;

            let ext = 'mp4';
            try {
                const urlObj = new URL(linkUrl);
                const pathExt = urlObj.pathname.split('.').pop();
                if (pathExt && pathExt.length < 5 && pathExt !== urlObj.pathname) {
                    ext = pathExt;
                }
            } catch(e) {}

            tasks.push({
                url: linkUrl,
                filename: nameBase,
                ext: ext,
                uniqueId: item.record_id  // 使用 record_id 作为唯一标识
            });
            debug('PARSE_LINK', { filename: nameBase, ext, url: linkUrl.substring(0, 50) + '...', recordId: item.record_id });
        }

        // 兼容文本字段类型
        else if (typeof videoField === 'string' && videoField.startsWith('http')) {
            textCount++;
            tasks.push({
                url: videoField,
                filename: nameBase,
                ext: 'mp4',
                uniqueId: item.record_id  // 使用 record_id 作为唯一标识
            });
            debug('PARSE_TEXT', { filename: nameBase, url: videoField.substring(0, 50) + '...', recordId: item.record_id });
        }

        // 兼容附件类型
        else if (Array.isArray(videoField)) {
            videoField.forEach((file, index) => {
                if (!file.file_token) return;
                const originalName = file.name || `file_${index}`;
                const ext = originalName.lastIndexOf('.') > -1 ? originalName.split('.').pop() : 'mp4';
                const taskName = (videoField.length > 1) ? `${nameBase}_${index+1}` : nameBase;

                attachmentCount++;
                fileTokens.push(file.file_token);
                tempTaskMap.push({
                    fileToken: file.file_token,
                    filename: taskName,
                    ext: ext,
                    uniqueId: item.record_id  // 使用 record_id 作为唯一标识
                });
                debug('PARSE_ATTACHMENT', { filename: taskName, fileToken: maskSensitive(file.file_token), ext, recordId: item.record_id });
            });
        }
    }

    debug('PARSE_SUMMARY', {
        linkCount,
        textCount,
        attachmentCount,
        skippedCount,
        scriptFilteredCount,
        totalFileTokens: fileTokens.length
    });

    // 记录脚本号过滤结果
    if (scriptFilteredCount > 0) {
        log(`🔖 已跳过 ${scriptFilteredCount} 条小于起始脚本号的记录`);
    }

    // 如果有附件类型，换取链接
    if (fileTokens.length > 0) {
        const CHUNK_SIZE = 50;
        debug('BATCH_FETCH_START', { total: fileTokens.length, chunks: Math.ceil(fileTokens.length / CHUNK_SIZE) });
        for (let i = 0; i < fileTokens.length; i += CHUNK_SIZE) {
            const chunk = fileTokens.slice(i, i + CHUNK_SIZE);
            const batchUrl = `https://open.feishu.cn/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=${chunk.join(',')}`;
            try {
                debug('BATCH_FETCH_CHUNK', { chunkIndex: Math.floor(i / CHUNK_SIZE), chunkSize: chunk.length });
                const res = await fetch(batchUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                debug('BATCH_FETCH_RESPONSE', { code: data.code, urlCount: data.data?.tmp_download_urls?.length || 0 });
                if (data.code === 0 && data.data.tmp_download_urls) {
                    data.data.tmp_download_urls.forEach(item => {
                        const targets = tempTaskMap.filter(t => t.fileToken === item.file_token);
                        targets.forEach(t => {
                            t.url = item.tmp_download_url;
                            tasks.push(t);
                        });
                    });
                } else {
                    debugError('BATCH_FETCH_FAILED', { code: data.code, msg: data.msg });
                }
            } catch (err) {
                debugError('BATCH_FETCH_ERROR', err);
            }
        }
    }

    debug('PARSE_COMPLETE', { totalTasks: tasks.length });
    return tasks;
}

// ==================== 下载队列管理 ====================

function processQueue(saveDir) {
    // 检查是否已被停止
    if (isStopped) {
        debug('QUEUE_STOPPED', '队列已停止，不再处理新任务');
        return;
    }

    debug('QUEUE_PROCESS', {
        queueLength: downloadQueue.length,
        activeDownloads,
        concurrency: CONCURRENCY,
        isStopped
    });

    if (downloadQueue.length === 0 && activeDownloads === 0) {
        debug('QUEUE_COMPLETE', { completedTasks, totalTasks });
        finish();
        return;
    }

    while (activeDownloads < CONCURRENCY && downloadQueue.length > 0 && !isStopped) {
        const task = downloadQueue.shift();
        activeDownloads++;
        debug('QUEUE_START_TASK', {
            filename: task.filename,
            ext: task.ext,
            remainingQueue: downloadQueue.length,
            activeDownloads
        });

        downloadFile(task, saveDir)
            .then((downloadId) => {
                // 如果已停止，不再处理成功回调
                if (isStopped) {
                    debug('DOWNLOAD_IGNORED_STOPPED', { filename: task.filename });
                    return;
                }
                completedTasks++;
                debug('DOWNLOAD_SUCCESS', {
                    filename: task.filename,
                    downloadId,
                    progress: `${completedTasks}/${totalTasks}`
                });
                addToHistory(task.uniqueId);
            })
            .catch(err => {
                if (isStopped) {
                    debug('DOWNLOAD_ERROR_IGNORED_STOPPED', { filename: task.filename });
                    return;
                }
                debugError('DOWNLOAD_FAILED', {
                    filename: task.filename,
                    error: err.message
                });
                log(`❌ 下载失败 [${task.filename}]: ${err.message}`);
            })
            .finally(() => {
                activeDownloads--;
                if (!isStopped) {
                    updateProgress(completedTasks, totalTasks);
                }
                debug('QUEUE_TASK_COMPLETE', {
                    activeDownloads,
                    queueLength: downloadQueue.length,
                    isStopped
                });
                if (!isStopped) {
                    processQueue(saveDir);
                }
            });
    }
}

function downloadFile(task, saveDir) {
    return new Promise((resolve, reject) => {
        const safeName = (task.filename + "").replace(/[\\/:*?"<>|]/g, "_").trim();
        const fullName = `${safeName}.${task.ext}`;
        const finalPath = saveDir ? `${saveDir}/${fullName}` : fullName;

        debug('DOWNLOAD_START', {
            filename: task.filename,
            safeName,
            ext: task.ext,
            finalPath,
            urlLength: task.url?.length || 0
        });

        if (!task.url) {
            debugError('DOWNLOAD_EMPTY_URL', { filename: task.filename });
            return reject(new Error("空链接"));
        }

        // 设置超时保护，防止回调永远不触发
        let completed = false;
        const timeout = setTimeout(() => {
            if (!completed) {
                completed = true;
                debugError('DOWNLOAD_TIMEOUT', {
                    filename: task.filename,
                    url: task.url.substring(0, 50) + '...'
                });
                // 超时也视为成功（Chrome 可能已经开始下载）
                resolve(-1); // -1 表示超时但可能已开始下载
            }
        }, 10000); // 10秒超时

        chrome.downloads.download({
            url: task.url,
            filename: finalPath,
            conflictAction: 'uniquify',
            saveAs: false
        }, (id) => {
            if (completed) return; // 如果已经超时，忽略回调
            completed = true;
            clearTimeout(timeout);

            if (chrome.runtime.lastError) {
                debugError('DOWNLOAD_CHROME_ERROR', {
                    filename: task.filename,
                    error: chrome.runtime.lastError
                });
                reject(chrome.runtime.lastError);
            }
            else {
                debug('DOWNLOAD_CHROME_SUCCESS', { filename: task.filename, downloadId: id });
                resolve(id);
            }
        });
    });
}

// ==================== 辅助函数 ====================

function getConfig() {
    return new Promise(resolve => {
        const keys = ['appId', 'appSecret', 'baseToken', 'tableId', 'fieldVideo', 'fieldScript', 'saveDir'];
        chrome.storage.local.get(keys, (result) => {
            // 起始脚本号从页面输入框直接读取，不从 storage 读取
            const startScriptNoInput = document.getElementById('startScriptNo');
            if (startScriptNoInput) {
                result.startScriptNo = startScriptNoInput.value.trim();
            }
            debug('STORAGE_GET_CONFIG', { keys: keys.join(', '), hasData: Object.keys(result).length > 0 });
            resolve(result);
        });
    });
}

function getDownloadHistory() {
    return new Promise(resolve => {
        chrome.storage.local.get(['downloadHistory'], (res) => {
            const history = res.downloadHistory || [];
            debug('STORAGE_GET_HISTORY', { historySize: history.length });
            resolve(history);
        });
    });
}

function addToHistory(uniqueId) {
    debug('HISTORY_ADD', { uniqueId: maskSensitive(uniqueId) });
    chrome.storage.local.get(['downloadHistory'], (res) => {
        const list = res.downloadHistory || [];
        if (!list.includes(uniqueId)) {
            list.push(uniqueId);
            debug('HISTORY_SAVE', { newSize: list.length });
            chrome.storage.local.set({downloadHistory: list});
        } else {
            debug('HISTORY_EXISTS', { uniqueId: maskSensitive(uniqueId) });
        }
    });
}

function log(msg) {
    const logArea = document.getElementById('logArea');
    const div = document.createElement('div');
    const time = new Date().toLocaleTimeString('zh-CN', {hour12: false});
    div.textContent = `[${time}] ${msg}`;
    if (msg.includes('❌') || msg.includes('错误')) div.style.color = '#EF4444';
    if (msg.includes('✅') || msg.includes('完成')) div.style.color = '#10B981';
    logArea.prepend(div);
    document.getElementById('statusText').textContent = msg.replace(/\[.*?\] /, '').substring(0, 20);
}

function updateProgress(done, total) {
    document.getElementById('progressText').textContent = `${done} / ${total}`;
    if (total > 0) document.getElementById('progressBar').style.width = `${(done / total) * 100}%`;
    else document.getElementById('progressBar').style.width = `0%`;
}

function finish() {
    isProcessing = false;

    // 根据停止状态显示不同的按钮
    if (isStopped) {
        // 如果是被停止的，显示重置按钮
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('stopBtn').style.display = 'none';
        document.getElementById('resetBtn').style.display = 'flex';
        document.getElementById('clearHistoryBtn').style.display = 'flex';
        log('⏹️ 下载已停止，点击"重置状态"可重新开始');
    } else {
        // 正常完成，显示开始按钮
        document.getElementById('startBtn').style.display = 'flex';
        document.getElementById('startBtn').disabled = false;
        document.getElementById('startBtn').innerHTML = `
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 9L15 9M15 9L9 3M15 9L9 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            开始下载
        `;
        document.getElementById('stopBtn').style.display = 'none';
        document.getElementById('resetBtn').style.display = 'none';
        document.getElementById('clearHistoryBtn').style.display = 'flex';
        log('🏁 任务流程结束');
    }
}

// 停止下载
function stopProcess() {
    if (!isProcessing) return;

    debug('STOP_PROCESS', '用户点击停止按钮');
    isStopped = true;

    log('⏹️ 正在停止下载...');

    // 清空下载队列
    const stoppedCount = downloadQueue.length;
    downloadQueue = [];

    debug('STOP_PROCESS', {
        stoppedQueueItems: stoppedCount,
        activeDownloads,
        completedTasks
    });

    if (stoppedCount > 0) {
        log(`🛑 已取消 ${stoppedCount} 个待下载任务`);
    }

    // 等待当前活动下载完成（最多等待30秒）
    const maxWaitTime = 30000; // 30秒
    const checkInterval = 500; // 每0.5秒检查一次
    let waitedTime = 0;

    const waitInterval = setInterval(() => {
        waitedTime += checkInterval;

        if (activeDownloads === 0 || waitedTime >= maxWaitTime) {
            clearInterval(waitInterval);

            if (activeDownloads > 0) {
                // 超时了还有活动下载，强制结束
                log(`⚠️ 部分下载可能仍在后台进行`);
            }

            finish();
        }
    }, checkInterval);
}

// 重置状态
function resetProcess() {
    debug('RESET_PROCESS', '用户点击重置按钮');

    isProcessing = false;
    isStopped = false;
    downloadQueue = [];
    totalTasks = 0;
    completedTasks = 0;
    activeDownloads = 0;

    // 重置按钮显示
    document.getElementById('startBtn').style.display = 'flex';
    document.getElementById('stopBtn').style.display = 'none';
    document.getElementById('resetBtn').style.display = 'none';
    document.getElementById('clearHistoryBtn').style.display = 'flex';

    // 重置开始按钮文本
    document.getElementById('startBtn').innerHTML = `
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 9L15 9M15 9L9 3M15 9L9 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        开始下载
    `;

    // 重置进度
    updateProgress(0, 0);
    document.getElementById('statusText').textContent = '准备就绪';

    log('🔄 状态已重置，可以重新开始下载');
}
