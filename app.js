const $ = (id) => document.getElementById(id);
let currentPrompt = "";
const STORAGE_KEY = "prompt-studio-history-v2";

function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2100);
}
function getHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function setHistory(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  const count = $("history-count");
  if (count) count.textContent = items.length;
}
function showTab(name) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  ["create", "history", "settings"].forEach(n => {
    const view = $(n + "-view");
    if (view) view.classList.toggle("hidden", n !== name);
  });
  if (name === "history") renderHistory();
}
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
$("description").addEventListener("input", e => $("char-count").textContent = \`\${e.target.value.length} 字\`);

const NEGATIVES = {
  people: ["低质量", "模糊", "失焦", "面部崩坏", "五官错位", "塑料皮肤", "过度磨皮", "身体比例失调", "解剖结构错误", "多余肢体", "多余手指", "手指粘连", "手部畸形", "关节扭曲", "肢体穿插", "服装结构错误", "布料穿模", "人物悬浮", "重复人物", "意外裁切", "过曝", "死黑阴影", "文字", "水印"],
  group: ["低质量", "人数错误", "人物身份混淆", "重复人物", "肢体融合", "手臂穿插", "手指畸形", "比例失调", "视线混乱", "人物遮挡异常", "面部崩坏", "背景杂乱", "过曝", "水印", "文字"],
  landscape: ["低质量", "模糊", "地平线倾斜", "透视错误", "重复物体", "自然结构扭曲", "色彩过饱和", "过度HDR", "过度锐化", "人工塑料质感", "不合理天气", "杂乱前景", "文字", "水印"],
  product: ["低质量", "模糊", "产品变形", "比例错误", "结构缺失", "材质错误", "反射异常", "边缘融化", "悬浮", "透视错误", "杂乱背景", "文字乱码", "水印", "Logo变形"],
  architecture: ["低质量", "模糊", "建筑结构扭曲", "垂直线倾斜", "透视错误", "重复窗户", "比例失调", "材质错误", "边缘融化", "杂乱环境", "过曝", "水印"],
  illustration: ["低质量", "线条混乱", "结构崩坏", "比例错误", "五官错位", "肢体畸形", "多余手指", "重复人物", "色彩脏污", "画面杂乱", "文字", "水印"]
};

const SCENES = [
  { id: "flower", test: /花海|花田|花园|花丛|鲜花|花束|樱花|玫瑰|郁金香/, label: "花海/花园" },
  { id: "beach", test: /海边|海滩|沙滩|海岸|海浪|海面|海滨|岸边|礁石/, label: "海岸/海滩" },
  { id: "pool", test: /泳池|游泳池|池畔|水上平台/, label: "泳池" },
  { id: "indoor", test: /卧室|客厅|室内|房间|公寓|家里|家中|窗边|厨房|浴室|卫生间|书房/, label: "室内空间" },
  { id: "cafe", test: /咖啡馆|咖啡厅|餐厅|酒吧|茶馆/, label: "餐饮空间" },
  { id: "studio", test: /影棚|棚拍|摄影棚|纯色背景|无缝背景|背景纸/, label: "摄影棚" },
  { id: "night", test: /夜景|夜晚|夜间|霓虹|街灯|城市夜|夜色/, label: "夜间场景" },
  { id: "street", test: /街道|街头|城市|巷子|马路|天桥|地铁站|商场/, label: "城市街景" },
  { id: "forest", test: /森林|树林|山林|林间|树下/, label: "森林" },
  { id: "mountain", test: /山脉|山顶|山间|高山|雪山|山谷/, label: "山地" },
  { id: "lake", test: /湖泊|湖边|湖畔|湖面|河边|河畔|瀑布/, label: "湖泊/水岸" },
  { id: "grassland", test: /草地|草原|田野|麦田/, label: "草地/田野" },
  { id: "office", test: /办公室|会议室|工位|工作室/, label: "办公空间" }
];

const CAMERA_TEXT = {
  "自然平视": "相机位于主体视线附近，以接近人眼观察的自然透视呈现画面",
  "低机位仰拍": "相机低于主体，以克制的仰拍强调主体与环境的关系，避免夸张变形",
  "高机位俯拍": "相机高于主体，以适度俯拍交代主体与地面/环境的空间关系",
  "侧面视角": "从主体侧方或侧前方观察，呈现轮廓、动作方向与空间纵深",
  "主观视角": "采用主体所见的主观视角，前景与主体保持可信的观察距离"
};
const LIGHT_TEXT = {
  "自然光": "采用场景中合理的自然光，光线方向、阴影和环境反射保持一致",
  "柔和人像光": "使用柔和的人像照明，保留面部与主体的自然明暗过渡",
  "电影感侧逆光": "以侧逆光勾勒主体轮廓，必要时用弱补光保留暗部细节",
  "商业棚拍光": "使用可控的棚拍布光，清楚呈现主体形态、边缘和材质",
  "黄昏暖光": "使用低角度暖色夕阳，形成自然的暖色高光与柔和长阴影",
  "夜景环境光": "以场景中实际可见的灯光为主要光源，保留夜间暗部层次"
};

function unique(items) { return [...new Set(items.filter(Boolean))]; }
function hasAny(text, patterns) { return patterns.some(pattern => pattern.test(text)); }

/* 只抽取用户真正写的创意内容，不把“如何生成”的规则当成画面。 */
function extractCoreDescription(raw) {
  const labeled = [
    /【主题与核心创意】\s*([\s\S]*?)(?=\n【|$)/,
    /【画面描述】\s*([\s\S]*?)(?=\n【|$)/
  ];
  for (const pattern of labeled) {
    const match = raw.match(pattern);
    if (match && match[1].trim()) return cleanDescription(match[1]);
  }
  const withoutHeadings = raw
    .replace(/^#{1,6}\s.*$/gm, "")
    .replace(/【(?:人物外观与主体细节|姿势与肢体控制|场景与环境[^】]*|摄影机位与构图|风格[^】]*|画面质量与一致性|负面提示词|最终画面要求)】[\s\S]*?(?=\n【|$)/g, "")
    .trim();
  return cleanDescription(withoutHeadings);
}
function cleanDescription(text) {
  return text
    .replace(/^\s*(?:生成一张|生成|画一张|绘制一张)\s*/,"")
    .replace(/\s+/g, " ")
    .trim();
}
function detectScene(text) {
  return SCENES.find(scene => scene.test.test(text)) || { id: "general", label: "未明确场景" };
}
function getCategory(kind) {
  if (kind === "情侣/多人写真") return "group";
  if (kind === "人物写真") return "people";
  if (kind === "风景摄影") return "landscape";
  if (kind === "产品摄影") return "product";
  if (kind === "建筑摄影") return "architecture";
  return "illustration";
}
function detectSubject(text, category, existingText = text) {
  if (category === "people") {
    const ageMatch = text.match(/\d{1,2}\s*岁/);
    const age = /成年/.test(text) && !/成年/.test(existingText) ? "明确成年" :
      ageMatch && !/\d{1,2}\s*岁/.test(existingText) ? ageMatch[0] :
      /年轻/.test(text) && !/年轻/.test(existingText) ? "年轻" : "";
    const identity = /亚洲|东亚/.test(text) && !/亚洲|东亚/.test(existingText) ? "亚洲" :
      /欧洲/.test(text) && !/欧洲/.test(existingText) ? "欧洲" :
      /非洲/.test(text) && !/非洲/.test(existingText) ? "非洲" : "";
    const gender = /女性|女生|女孩|女人|女青年/.test(text) && !/女性|女生|女孩|女人|女青年/.test(existingText) ? "女性" :
      /男性|男生|男孩|男人/.test(text) && !/男性|男生|男孩|男人/.test(existingText) ? "男性" : "";
    const parts = [age, identity, gender].filter(Boolean);
    return parts.length ? parts.join(" ") + "，" : "";
  }
  return "";
}
function sceneDescription(scene, category, text) {
  const person = category === "people" || category === "group";
  const breeze = /微风|海风|风吹|风中/.test(text);
  const sunshine = /阳光|晴天|日光|明媚|夕阳|黄昏/.test(text);
  const parts = [];
  switch (scene.id) {
    case "flower":
      parts.push("花朵在画面近处、中景与远处形成有疏密变化的层次，花田尺度自然，远景与天空或地平线衔接");
      if (breeze) parts.push("微风只带动少量花枝、发丝或衣物，动态方向统一，不遮挡主体");
      if (sunshine) parts.push("阳光在花瓣与叶片边缘形成自然高光，阴影保留细节");
      break;
    case "beach":
      parts.push("画面交代沙滩、潮线、海面与远处海平线的前后关系，浪花尺度自然，湿沙与水面反光符合光线方向");
      if (breeze) parts.push("海风轻微带动发丝、衣物或岸边植被，避免夸张飞扬");
      if (sunshine) parts.push("日光在海面形成有方向的细碎反光，沙滩亮部不过曝");
      break;
    case "pool":
      parts.push("呈现池沿、池水与周围空间的清晰关系，水面反射和折射自然，人物或主体与池边保持真实接触");
      break;
    case "indoor":
      parts.push("通过墙面、门窗、家具和地面交代室内布局，近景与背景有真实距离，物件尺度合理且稳定落地");
      if (/窗|窗边|阳光|日光/.test(text)) parts.push("窗外自然光从明确方向进入室内，在人物和家具上形成柔和明暗变化");
      break;
    case "cafe":
      parts.push("以桌椅、吧台、餐具和室内外光线建立空间层次，背景陈设适量，不喧宾夺主");
      break;
    case "studio":
      parts.push("背景保持干净，主体与背景留有适当距离，光线和投影方向统一");
      break;
    case "night":
      parts.push("以画面中可见的路灯、窗光或霓虹等实际光源建立夜间照明，暗部保留层次");
      break;
    case "street":
      parts.push("利用道路、建筑立面与街道纵深建立透视关系，背景人物和车辆不过度抢占主体");
      break;
    case "forest":
      parts.push("树木、地面植被与远处林木形成自然纵深，枝叶疏密真实，避免重复纹理");
      break;
    case "mountain":
      parts.push("通过近处地形、中景山体和远处山脊表现尺度，远山具有自然空气透视");
      break;
    case "lake":
      parts.push("水岸、湖面或河面与周围地形形成连续空间，水面反射与岸边接触关系可信");
      break;
    case "grassland":
      parts.push("草地或田野由近及远自然延伸，植被高度和密度有变化，远景不过度重复");
      break;
    case "office":
      parts.push("桌面、座椅、设备与墙面构成清晰的办公空间，物件比例可信，布局有秩序");
      break;
    default:
      if (person) parts.push("环境只补充与主体有关的空间信息，明确近处、中景和远处的关系，不凭空添加具体道具或地点");
      else parts.push("环境元素保持真实尺度与空间关系，主体突出，背景不添加无关内容");
  }
  return parts.join("。") + (parts.length ? "。" : "");
}
function getLens(category, scene, text) {
  if (category === "product") return "约 70–100mm 等效焦段，突出产品形态并控制透视";
  if (category === "architecture") return "约 24–35mm 等效焦段，保持建筑垂直线与透视关系自然";
  if (category === "landscape") return "约 24–35mm 等效焦段，呈现环境纵深与空间尺度";
  if (category === "group") return "约 35–50mm 等效焦段，兼顾人物关系与环境";
  if (category === "illustration") return "透视与景深服从画面风格，不强行套用摄影焦段";
  if (scene.id === "indoor" || scene.id === "cafe") return "约 35–50mm 等效焦段，兼顾人物与室内环境";
  if (scene.id === "beach" || scene.id === "flower") return "约 50mm 等效焦段，保留人物比例并交代适量环境";
  return "约 50mm 等效焦段，保持自然的人物透视";
}
function getPoseDescription(text) {
  const cues = [];
  if (hasAny(text, [/站立|站在|站着/])) cues.push("人物保持自然站姿，重心由双脚稳定承托");
  if (hasAny(text, [/坐在|坐着|坐于/])) cues.push("人物以自然坐姿呈现，身体与座面接触关系可信");
  if (hasAny(text, [/行走|走在|漫步/])) cues.push("人物处于自然行走状态，步幅与身体重心协调");
  if (hasAny(text, [/奔跑|跑向/])) cues.push("动作呈现自然运动状态，四肢摆动与身体重心协调");
  if (hasAny(text, [/双手扶|双手拿|双手举|双手捧/])) cues.push("双手动作清晰可辨，手指与所接触物体的位置关系准确");
  if (hasAny(text, [/回头|侧身|转身/])) cues.push("身体转向与头部视线方向协调");
  if (hasAny(text, [/闭眼|闭着眼/])) cues.push("双眼自然闭合");
  if (hasAny(text, [/看向镜头|望向镜头/])) cues.push("视线自然落在镜头方向");
  if (hasAny(text, [/微笑|微微笑|笑容/])) cues.push("面部表情自然放松");
  return cues.join("；");
}
function getPersonDescription(text, scene) {
  const cues = [];
  if (/草帽|遮阳帽|帽檐/.test(text)) cues.push("保留用户指定的帽子及其佩戴方式");
  if (/长发|短发|马尾|卷发|直发|盘发/.test(text)) cues.push("保留用户指定的发型");
  if (/连衣裙|裙子|裙装|衬衫|T恤|外套|泳装|泳衣|西装|牛仔裤/.test(text)) cues.push("服装款式以用户明确描述为准，呈现真实版型、面料与褶皱");
  if (/眼镜|耳环|项链|发夹|头饰/.test(text)) cues.push("保留用户指定的配饰");
  if (!cues.length) return "";
  return cues.join("；") + "。";
}
function buildPrompt() {
  const raw = $("description").value.trim();
  if (!raw) { toast("先描述你想生成的画面"); $("description").focus(); return; }
  const desc = extractCoreDescription(raw) || raw;
  const kind = $("kind").value;
  const style = $("style").value;
  const ratio = $("ratio").value;
  const camera = $("camera").value;
  const lighting = $("lighting").value;
  const detailed = $("detailed").checked;
  const category = getCategory(kind);
  const headingContext = (raw.match(/^#\s*(.+)$/m) || [])[1] || "";
  const semanticText = headingContext + " " + desc;
  const scene = detectScene(semanticText);
  const subject = detectSubject(semanticText, category, desc);
  const cameraText = CAMERA_TEXT[camera] || "采用自然稳定的观察视角";
  const lightText = LIGHT_TEXT[lighting] || "采用符合场景的光线";
  const lens = getLens(category, scene, desc);

  let visual = desc;
  if (category === "people") {
    const additions = [getPersonDescription(desc, scene), getPoseDescription(desc), sceneDescription(scene, category, desc)].filter(Boolean);
    visual = [subject + desc, ...additions].filter(Boolean).join("。");
  } else if (category === "group") {
    visual = desc + "。人物之间的距离、互动方向和遮挡关系清楚，每个人物的动作与身体结构自然，不出现肢体穿插。" + sceneDescription(scene, category, desc);
  } else if (category === "landscape") {
    visual = desc + "。画面以近景、中景和远景建立纵深，地貌、水体、植被与天空保持真实尺度。" + sceneDescription(scene, category, desc);
  } else if (category === "product") {
    visual = desc + "。完整呈现产品轮廓、关键结构和真实比例，材质纹理、反射与接触阴影符合实际物理表现，背景简洁且不干扰主体。";
  } else if (category === "architecture") {
    visual = desc + "。准确呈现建筑体量、立面节奏、门窗比例和表面材质，保持垂直线稳定、透视关系正确，并通过周边环境体现建筑尺度。";
  } else {
    visual = desc + "。保留主体的核心设计，明确轮廓、动作、色彩关系与空间层次，整体视觉风格统一，结构清晰。";
  }

  const negatives = [...NEGATIVES[category]];
  if (scene.id === "beach") negatives.push("海平面倾斜", "水面与沙滩边界错误", "浪花机械重复");
  if (scene.id === "flower") negatives.push("花朵机械重复", "花枝穿过主体", "花瓣粘连", "花海遮挡主体");
  if (scene.id === "indoor" || scene.id === "cafe" || scene.id === "office") negatives.push("家具结构扭曲", "门窗透视错误", "物体悬浮", "室内空间比例错误");
  if (scene.id === "night") negatives.push("无来源强光", "夜景过度提亮", "灯光方向混乱");
  if (scene.id === "pool" || scene.id === "lake") negatives.push("水面反射错误", "水体边界扭曲");
  if (category === "architecture") negatives.push("重复门窗", "立面节奏混乱", "建筑垂直线倾斜");
  if (category === "people" && /泳装|泳衣/.test(desc)) negatives.push("泳装结构错误", "不自然的身体比例");
  const quality = detailed
    ? "细节清晰但不过度锐化；人物、物体与环境的比例、透视、接触阴影和光照方向保持一致。材质表现符合画面中实际存在的对象，不添加无关材质描述。"
    : "主体清晰，结构与透视自然，画面元素协调。";
  const composition = [
    ratio + " 画幅",
    cameraText,
    lens,
    style,
    lightText,
    detailed ? "主体与背景保持清楚的空间层次，构图留白与主体占比服从原始创意" : "主体突出，构图稳定"
  ].join("；") + "。";

  const title = desc.split(/[，。；,.;]/)[0].slice(0, 26) || kind;
  const sections = [
    "# " + title + " · " + kind,
    "【画面描述】\n" + visual,
    "【摄影与构图】\n" + composition,
    detailed ? "【细节控制】\n" + quality : "",
    "【负面提示词】\n" + unique(negatives).join("，") + "。"
  ].filter(Boolean);
  currentPrompt = sections.join("\n\n");
  if ($("language").value === "英文") currentPrompt = toEnglishPrompt(currentPrompt);
  $("result").textContent = currentPrompt;
  $("result-panel").classList.remove("hidden");
  $("result-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}
function toEnglishPrompt(prompt) {
  const labels = {
    "【画面描述】": "[VISUAL DESCRIPTION]",
    "【摄影与构图】": "[PHOTOGRAPHY AND COMPOSITION]",
    "【细节控制】": "[DETAIL CONTROL]",
    "【负面提示词】": "[NEGATIVE PROMPT]"
  };
  let output = prompt;
  for (const [zh, en] of Object.entries(labels)) output = output.replaceAll(zh, en);
  return "[OFFLINE ENGLISH-LABEL MODE — the prompt body remains in its original language; full translation is not available]\n\n" + output;
}

$("generate").addEventListener("click", buildPrompt);
$("regenerate").addEventListener("click", buildPrompt);
$("clear").addEventListener("click", () => {
  $("description").value = "";
  $("char-count").textContent = "0 字";
  $("result-panel").classList.add("hidden");
  $("description").focus();
});
$("copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(currentPrompt); toast("已复制完整提示词"); }
  catch { toast("复制失败，请手动选择文本"); }
});
$("save").addEventListener("click", () => {
  if (!currentPrompt) return;
  const items = getHistory();
  items.unshift({ id: Date.now(), date: new Date().toLocaleString("zh-CN"), prompt: currentPrompt });
  setHistory(items.slice(0, 50));
  toast("已保存到历史记录");
});
function renderHistory() {
  const items = getHistory();
  setHistory(items);
  const host = $("history-list");
  host.innerHTML = "";
  if (!items.length) {
    host.innerHTML = '<div class="panel muted">还没有保存的提示词。生成并点击“保存到历史”后会显示在这里。</div>';
    return;
  }
  items.forEach(item => {
    const card = document.createElement("article");
    card.className = "history-card";
    const time = document.createElement("time");
    time.textContent = item.date;
    const p = document.createElement("p");
    p.textContent = item.prompt;
    const copy = document.createElement("button");
    copy.className = "button secondary";
    copy.textContent = "复制";
    copy.onclick = async () => { try { await navigator.clipboard.writeText(item.prompt); toast("已复制"); } catch { toast("复制失败"); } };
    const load = document.createElement("button");
    load.className = "button secondary";
    load.textContent = "载入编辑";
    load.onclick = () => {
      $("result").textContent = item.prompt;
      currentPrompt = item.prompt;
      $("result-panel").classList.remove("hidden");
      showTab("create");
      $("result-panel").scrollIntoView({ behavior: "smooth" });
    };
    const del = document.createElement("button");
    del.className = "button secondary";
    del.textContent = "删除";
    del.onclick = () => { setHistory(getHistory().filter(x => x.id !== item.id)); renderHistory(); };
    card.append(time, p, copy, load, del);
    host.append(card);
  });
}
$("clear-history").addEventListener("click", () => {
  if (confirm("确定清空所有本地历史记录吗？")) { setHistory([]); renderHistory(); }
});
setHistory(getHistory());
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
