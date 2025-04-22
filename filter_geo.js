// filter_geo.js
const fetch = require('node-fetch');

/**
 * @param {object} node - 节点对象，包含 node.server、node.name 等属性
 * @returns {boolean} - 返回 true 以保留该节点，false 以过滤该节点
 */
async function filter(node) {
  const ip = node.server;
  const response = await fetch(`https://ipinfo.io/${ip}/json?token=${process.env.IPINFO_TOKEN}`);
  //Token去Vercel的环境变量设置
  const data = await response.json();
  const country = data.country;
  const region = data.region;
  const city = data.city;

  // 构建地理位置字符串
  const location = `真实属地${country} ${region ? region + ' ' : ''}${city ? city + ' ' : ''}`.trim();

  // 将地理位置添加到节点名称前
  node.name = `${location} 名义属地${node.name}`;

  // 返回 true 以保留该节点
  return true;
}

module.exports = { filter };
