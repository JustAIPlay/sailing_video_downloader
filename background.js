// Chrome 扩展后台脚本
// 安装时设置侧边栏
chrome.runtime.onInstalled.addListener(async () => {
  // 设置侧边栏配置
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
