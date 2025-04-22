/**
 * Subconverter Filter Script for Real IP Geolocation Lookup with Rate Limiting
 *
 * @param {Array} proxies - Array of proxy objects provided by Subconverter.
 * @param {Object} params - URL parameters passed to Subconverter.
 * @returns {Array} - Modified array of proxy objects.
 */
module.exports.filter = async (proxies, params) => {
  // --- Configuration ---
  const apiEndpoint = (query) => `http://ip-api.com/json/${query}?fields=status,message,country,countryCode,query`;
  // 请求之间的延迟（毫秒），1.5秒 = 1500毫秒
  const requestDelay = 1500;
  // API 的参考速率限制（每分钟请求数）
  const rateLimitPerMinute = 45;
  // 根据我们的延迟计算出的实际速率（每分钟请求数）
  const actualRatePerMinute = 60 / (requestDelay / 1000);

  // --- Helper Functions ---
  // 创建一个 Promise 来实现延迟
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // 获取单个节点地理位置的函数 (基本与之前相同)
  const getGeo = async (proxy) => {
    const originalName = proxy.remarks;
    const serverAddress = proxy.server;

    try {
      // 注意：减少这里的日志，避免日志过多
      // console.log(`Querying geo for: ${serverAddress}`);
      const response = await fetch(apiEndpoint(serverAddress), {
          method: 'GET',
          // 可以考虑添加超时，但 fetch 的标准支持有限，通常依赖 Vercel 的函数超时
          // signal: AbortSignal.timeout(8000) // 示例：8秒超时 (需要较新环境)
      });

      if (!response.ok) {
        // 处理 HTTP 错误
        console.warn(`[节点: ${originalName}] Geo API HTTP Error for ${serverAddress}: ${response.status} ${response.statusText}`);
        proxy.remarks = `[查询HTTP失败]-${originalName}`;
        return proxy;
      }

      const data = await response.json();

      if (data.status === 'success' && data.country) {
        // 查询成功
        const realCountry = data.countryCode || data.country; // 优先用国家代码
        proxy.remarks = `真实属地${realCountry}***-名义属地${originalName}`;
        // console.log(`[节点: ${originalName}] Geo success for ${serverAddress}: ${realCountry}`); // 成功日志可选
      } else {
        // 处理 API 返回的逻辑错误 (如私有地址, 超限等)
        const reason = data.message || '查询失败';
        console.warn(`[节点: ${originalName}] Geo API Error for ${serverAddress}: ${reason}`);
        proxy.remarks = `[${reason}]-${originalName}`;
      }
    } catch (error) {
      // 处理网络请求或其他异常
      // 特别注意，如果 Vercel 函数超时，这里的 catch 可能不会完整执行或记录日志
      console.error(`[节点: ${originalName}] Geo Fetch Exception for ${serverAddress}: ${error.name === 'AbortError' ? 'Timeout' : error.message}`);
      proxy.remarks = `[查询异常${error.name === 'AbortError' ? '-超时' : ''}]-${originalName}`;
    }
    return proxy; // 返回修改后的节点对象
  };

  // --- Main Logic ---
  const numProxies = proxies.length;
  if (numProxies === 0) {
    console.log("节点列表为空，无需处理。");
    return proxies; // 如果没有节点，直接返回
  }

  // 计算预计总时间
  // 注意：实际时间可能因网络波动、API响应速度略有不同
  // Vercel 函数本身也有总执行时间限制 (免费版通常10-60秒)
  const estimatedTotalSeconds = numProxies * (requestDelay / 1000);
  const estimatedMinutes = Math.floor(estimatedTotalSeconds / 60);
  const remainingSeconds = Math.round(estimatedTotalSeconds % 60);
  const vercelTimeoutWarning = estimatedTotalSeconds > 50 ? "(注意：可能接近或超过 Vercel 免费版函数执行时间限制)" : ""; // 对 Vercel 超时进行简单提示

  // 在 Vercel 函数日志中打印提示信息
  console.log(`==================================================`);
  console.log(`Subconverter IP 归属地查询 Filter (带速率限制)`);
  console.log(`==================================================`);
  console.log(`检测到 ${numProxies} 个节点需要处理。`);
  console.log(`使用的 API (ip-api.com) 限制约为每分钟 ${rateLimitPerMinute} 次请求。`);
  console.log(`为避免触发限制，将以每 ${requestDelay / 1000} 秒处理一个节点的速度进行 (约合 ${Math.round(actualRatePerMinute)} 请求/分钟)。`);
  console.log(`预计总处理时间约为: ${estimatedMinutes} 分钟 ${remainingSeconds} 秒 ${vercelTimeoutWarning}`);
  console.log(`处理过程中请耐心等待，不要中断或重复刷新订阅链接...`);
  console.log(`--------------------------------------------------`);

  // 使用 for 循环按顺序处理节点，并在每次请求后加入延迟
  const modifiedProxies = [];
  for (let i = 0; i < proxies.length; i++) {
    const proxy = proxies[i];
    console.log(`[${i + 1}/${numProxies}] 正在处理节点: ${proxy.remarks}`); // 打印当前处理进度

    const modifiedProxy = await getGeo(proxy);
    modifiedProxies.push(modifiedProxy);

    // 如果不是最后一个节点，则在处理完当前节点后等待指定时间
    if (i < proxies.length - 1) {
      await delay(requestDelay);
    }
  }

  console.log(`--------------------------------------------------`);
  console.log(`所有 ${numProxies} 个节点的地理位置查询处理完成！`);
  console.log(`==================================================`);

  return modifiedProxies; // 返回包含所有修改后节点的数组
};
