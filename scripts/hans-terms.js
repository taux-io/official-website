// THE ONLY PLACE THE SIMPLIFIED VOCABULARY IS DECIDED.
//
// Converting zh-Hant-TW to zh-Hans-CN is two jobs, and only one of them is
// mechanical. The characters are a fixed mapping: 資 is 资 everywhere, always.
// The WORDS are not — Taiwan and the mainland name the same thing differently
// often enough that a page converted character-by-character reads as
// Traditional Chinese wearing simplified glyphs, which is worse than either.
//
// OpenCC ships a phrase dictionary for exactly this (`twp` → `cn`), and it is
// right about most of it. It is wrong about nine terms in this corpus, and the
// wrong ones are frequent: it turns 核心使命 into 内核使命 (a kernel is an
// operating system component, not a mission), 政策執行 into 政策运行, and
// 稽核 into 审核 — vetting, when the word means audit.
//
// So the split here is deliberate: OpenCC converts the CHARACTERS, and this
// file decides the WORDS. Every entry is reviewable, and the ones deliberately
// left alone are written down with their reason rather than being absent.
//
// Keys are in SIMPLIFIED form, because the map runs after the character pass.
// Longest key wins — 资料夹 must be settled before 资料.

// NAMES THE TERM MAP MUST NOT TOUCH.
//
// A name is identity, not prose — the same reason the registered company name
// is not translated. Each of these CONTAINS a key from the map below: 数位 →
// 数字 would turn Taiwan's 數位發展部數位產業署 into a ministry that does not
// exist, 资安 → 网络安全 would rename the 後量子資安產業聯盟, and 资料 → 数据
// would rewrite the statute 個人資料保護法 into one nobody passed. All three
// are cited as sources, so a corrupted name lands on the claim about where the
// claim came from.
//
// SORTING THE MAP LONGEST-FIRST DOES NOT PROTECT THEM, and that is the whole
// reason this is a separate list. A longest-first pass only wins when the
// longer replacement REMOVES the shorter trigger; mapping a name to itself
// leaves 资安 sitting in the text for the next rule to find, which is exactly
// what happened. They are swapped for sentinels before the map runs and swapped
// back after.
//
// Written in the simplified character forms, because the character pass has
// already run by the time these are matched.
const PROPER_NOUNS = [
  "数位发展部数位产业署",
  "后量子资安产业联盟",
  "个人资料保护法",
  "个人资料",
];

// 艾伦人工智能研究所 is deliberately NOT here: the Allen Institute for AI is
// written that way on the mainland, so 人工智慧 → 人工智能 is right for it.

// Terms whose mainland form differs and is unambiguous.
const TERMS = {
  // Filesystem and documents. 资料夹 first: it is a folder, not data.
  资料夹: "文件夹",
  资料库: "数据库",
  资料: "数据",
  档案: "文件",
  档名: "文件名",
  主档名: "主文件名",
  文件: "文档", // Taiwan 文件 is a document; mainland 文档
  资讯: "信息",

  // Software.
  程式: "程序",
  程式码: "代码",
  原始码: "源代码",
  软体: "软件",
  硬体: "硬件",
  韧体: "固件",
  伺服器: "服务器",
  模组: "模块",
  元件: "组件",
  函式: "函数",
  变数: "变量",
  型别: "类型",
  字串: "字符串",
  字元: "字符",
  阵列: "数组",
  物件: "对象",
  介面: "界面",
  栏位: "字段",
  演算法: "算法",
  回圈: "循环",
  行程: "进程",
  子行程: "子进程",
  外挂: "插件",
  内建: "内置",
  相容: "兼容",
  支援: "支持",
  载入: "加载",
  存取: "访问",
  呼叫: "调用",
  宣告: "声明",
  部署: "部署",
  排程: "调度",
  批次: "批量",
  快取: "缓存",
  堆叠: "堆栈",
  杂凑: "哈希",
  金钥: "密钥",
  凭证: "证书", // TLS and PKI throughout this corpus, never a voucher
  网路: "网络",
  连线: "连接",
  连结: "链接",
  远端: "远程",
  讯号: "信号",
  讯息: "消息",
  装置: "设备",
  晶片: "芯片",
  硬碟: "硬盘",
  记忆体: "内存",
  效能: "性能",
  即时: "实时",
  预设: "默认",
  范本: "模板",
  最佳化: "优化",
  品质: "质量",
  回馈: "反馈",
  回传: "返回",
  重新命名: "重命名",
  优先顺序: "优先级",
  检视: "查看",
  视窗: "窗口",
  选单: "菜单",
  登入: "登录",
  储存: "保存",
  汇出: "导出",
  贴上: "粘贴",
  新增: "添加",
  释出: "发布",
  撷取: "提取", // NOT 截取, which is truncation

  // Product and business.
  使用者: "用户",
  专案: "项目",
  设定: "设置",
  搜寻: "搜索",
  社群: "社区",
  社群媒体: "社交媒体",
  互动: "交互",
  整合: "集成",
  数位: "数字",
  智慧: "智能",
  人工智慧: "人工智能",
  智慧财产: "知识产权",
  影片: "视频",
  短影片: "短视频",
  简报: "演示文稿",
  进阶: "高级",
  机率: "概率",
  音讯: "音频",
  防毒: "杀毒",
  骇客: "黑客",
  遮蔽: "屏蔽",
  联络: "联系",
  稽核: "审计", // an audit. OpenCC says 审核, which is vetting.
  资安: "网络安全", // Taiwan short form; the mainland spells it out
  协定: "协议", // a network protocol. Taiwan 協定; the mainland reserves 协定 for a pact
  建置: "搭建", // Taiwan 建置; the mainland builds things with 搭建 or 构建
  测试档: "测试文件",
};

// TERMS DELIBERATELY LEFT AS THE CHARACTER CONVERSION GIVES THEM.
//
// Each of these is a word OpenCC's phrase dictionary would replace, and each
// replacement is wrong here often enough that no replacement is the better
// default. The character form is already correct mainland Chinese in every one
// of them — this is not a gap, it is the answer.
const LEFT_ALONE = {
  执行: "OpenCC says 运行, which only fits software. 政策执行, 执行摘要 and 执行长 all break.",
  建立: "OpenCC says 创建, which fits a file or a project. 建立信任 and 建立关系 do not.",
  核心: "OpenCC says 内核 — an operating system kernel. 核心使命 would become 内核使命.",
  查询: "OpenCC says 查找, which is looking something up. A query is 查询.",
  指标: "Could be a pointer or a metric, and this site uses both. 指标 carries the metric sense.",
  程序: "Taiwan 程序 is a procedure. OpenCC reads it as an OS process and says 进程.",
  开启: "Describes an issue that is still open, not the act of opening something.",
  向量: "AI embeddings are 向量 on the mainland too. 矢量 belongs to physics and graphics.",
};

module.exports = { TERMS, LEFT_ALONE, PROPER_NOUNS };
