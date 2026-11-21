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
$("description").addEventListener("input", e => $("char-count").textContent = `${e.target.value.length} 字`);

const NEGATIVES = {
  people: ["低质量", "模糊", "失焦", "面部崩坏", "五官错位", "塑料皮肤", "过度磨皮", "身体比例失调", "解剖结构错误", "多余肢体", "多余手指", "手指粘连", "手部畸形", "关节扭曲", "肢体穿插", "服装结构错误", "布料穿模", "人物悬浮", "重复人物", "意外裁切", "过曝", "死黑阴影", "文字", "水印"],
  group: ["低质量", "人数错误", "人物身份混淆", "重复人物", "肢体融合", "手臂穿插", "手指畸形", "比例失调", "视线混乱", "人物遮挡异常", "面部崩坏", "背景杂乱", "过曝", "水印", "文字"],
  landscape: ["低质量", "模糊", "地平线倾斜", "透视错误", "重复物体", "自然结构扭曲", "色彩过饱和", "过度HDR", "过度锐化", "人工塑料质感", "不合理天气", "杂乱前景", "文字", "水印"],
  product: ["低质量", "模糊", "产品变形", "比例错误", "结构缺失", "材质错误", "反射异常", "边缘融化", "悬浮", "透视错误", "杂乱背景", "文字乱码", "水印", "Logo变形"],
  architecture: ["低质量", "模糊", "建筑结构扭曲", "垂直线倾斜", "透视错误", "重复窗户", "比例失调", "材质错误", "边缘融化", "杂乱环境", "过曝", "水印"],
  illustration: ["低质量", "线条混乱", "结构崩坏", "比例错误", "五官错位", "肢体畸形", "多余手指", "重复人物", "色彩脏污", "画面杂乱", "文字", "水印"]
};

const SCENES = [
  { id: "flower", test: /花海|花田|花园|花丛|鲜花|花束|樱花|玫瑰|郁金香/, name: "花海与花园", detail: "交代花朵在前景、中景和远景中的疏密变化；花朵尺度与人物保持真实比例。若有微风，只让花枝、发丝和衣物出现轻微且方向一致的动态，不遮挡主体面部。" },
  { id: "beach", test: /海边|海滩|沙滩|海岸|泳池|海浪|海面/, name: "海岸与水边", detail: "建立沙滩、水线与远处海平面的空间关系；水面反光、浪花和湿沙质感符合光线方向，人物与水边的距离和脚下接触关系自然。" },
  { id: "indoor", test: /卧室|客厅|室内|房间|公寓|家里|窗边|咖啡馆|餐厅/, name: "室内空间", detail: "明确房间布局、墙面与家具的前后关系、窗户位置和主要光源；家具尺度可信，物体落地稳定，避免背景物件无故重复。" },
  { id: "studio", test: /影棚|棚拍|摄影棚|纯色背景|无缝背景|背景纸/, name: "摄影棚", detail: "保持背景干净、受控且无多余环境干扰；主体与背景之间保留适当距离，阴影方向与棚灯位置一致。" },
  { id: "night", test: /夜景|夜晚|夜间|霓虹|街灯|城市夜|灯光/, name: "夜间场景", detail: "以画面中可见的实际光源建立照明逻辑，区分主光、环境光与点状灯源；保留暗部层次，避免无来源的均匀补光。" },
  { id: "street", test: /街道|街头|城市|巷子|马路|天桥|地铁站/, name: "城市街景", detail: "交代道路、建筑立面和行人/车辆等元素的空间层次；透视线汇聚自然，背景细节控制在不干扰主体的程度。" },
  { id: "nature", test: /森林|树林|山林|草地|草原|山脉|湖泊|瀑布/, name: "自然户外", detail: "呈现地形、植被与天空之间可信的尺度关系；利用前景遮挡和远景空气透视建立纵深，避免植被纹理机械重复。" }
];

function detectScene(description) {
  return SCENES.find(scene => scene.test.test(description)) || {
    id: "general", name: "通用场景",
    detail: "根据用户描述建立可信的空间布局，明确主体与环境的距离、遮挡和前后层次；不添加与主题无关的装饰。"
  };
}
function getCategory(kind) {
  if (kind === "情侣/多人写真") return "group";
  if (kind === "人物写真") return "people";
  if (kind === "风景摄影") return "landscape";
  if (kind === "产品摄影") return "product";
  if (kind === "建筑摄影") return "architecture";
  return "illustration";
}
function unique(items) { return [...new Set(items)]; }

function buildPrompt() {
  const desc = $("description").value.trim();
  if (!desc) { toast("先描述你想生成的画面"); $("description").focus(); return; }

  const kind = $("kind").value;
  const style = $("style").value;
  const ratio = $("ratio").value;
  const camera = $("camera").value;
  const lighting = $("lighting").value;
  const detailed = $("detailed").checked;
  const scene = detectScene(desc);
  const category = getCategory(kind);
  const cameraMap = {
    "自然平视": "采用自然平视机位，保持接近人眼观察的透视关系。",
    "低机位仰拍": "相机置于主体较低位置向上拍摄，明确仰拍角度与主体透视关系，避免夸张拉伸。",
    "高机位俯拍": "相机置于主体上方俯拍，交代主体与地面及环境的空间关系，避免头身比例异常。",
    "侧面视角": "从主体侧前方取景，呈现轮廓、动作方向和环境纵深。",
    "主观视角": "采用具有明确观看者位置的主观视角，保持前景与主体之间自然的空间关系。"
  };
  const lightMap = {
    "自然光": "使用符合场景的自然光，明确光线方向、软硬程度、明暗过渡与环境反射光。",
    "柔和人像光": "采用柔和人像光，控制面部阴影、皮肤高光和主体轮廓，保留自然立体感。",
    "电影感侧逆光": "采用侧逆光塑造主体轮廓，提供适度正面补光，控制高光与暗部细节。",
    "商业棚拍光": "使用有控制的商业棚拍布光，准确呈现主体形态、颜色与材质。",
    "黄昏暖光": "使用低角度黄昏暖光，形成温暖的侧向照明与柔和长阴影。",
    "夜景环境光": "以场景中的实际光源作为主要照明，保留夜景氛围和可信的明暗层次。"
  };
  const lens = {
    people: "人物写真通常使用 50mm 或 85mm 等效焦段；需要更多环境信息时可考虑 35mm。",
    group: "多人画面可考虑 35–50mm 等效焦段，保证人物之间的空间关系和边缘人物比例自然。",
    landscape: "根据景观范围选择 24–35mm 等效焦段；避免前景过度放大或地平线变形。",
    product: "产品摄影可使用 50–100mm 等效焦段，控制透视并准确呈现产品形态。",
    architecture: "建筑摄影可使用 24–35mm 等效焦段，保持垂直线和空间比例自然。",
    illustration: "根据画面风格选择合适视角，优先保证主体结构清楚、构图稳定。"
  }[category];

  let subjectSection = "";
  if (category === "people" || category === "group") {
    subjectSection = detailed
      ? "【人物外观与主体细节】\n对用户明确指定的年龄、外貌、发型、体型、服装和身份特征逐项保留。未指定时，只补充与场景相符且不过度具体的外观细节；服装描述关注款式、版型、面料、织纹、褶皱和受光表现。人物应明确为成年人。"
      : "【人物外观与主体细节】\n突出人物已指定的外观、服装和整体气质；只对缺失信息作克制、合理的补全，不擅自改变人物设定。";
  } else if (category === "product") {
    subjectSection = "【产品形态与材质】\n保留产品原有设计，描述可见的外形轮廓、结构部件、比例、表面工艺、材质反射和摆放方式；不凭空添加品牌标识或不存在的零件。";
  } else if (category === "architecture") {
    subjectSection = "【建筑结构与材质】\n描述建筑体量、立面节奏、门窗结构、材质肌理、空间尺度和周边环境；保持结构连续、比例可信，不擅自改变建筑设计。";
  } else if (category === "landscape") {
    subjectSection = "【自然环境与空间】\n根据描述呈现地貌、水体、植被、天空和天气特征；建立前景、中景、远景层次，保持自然尺度与地理关系可信。";
  } else {
    subjectSection = "【角色与画面细节】\n保留角色设计和指定视觉元素，明确造型轮廓、服饰特征、动作、线条语言、色彩体系与画面层次，保持风格统一。";
  }

  const poseSection = (category === "people" || category === "group")
    ? (detailed
      ? "【姿势与肢体控制】\n保留用户指定的动作和视线方向；进一步明确身体朝向、重心落点、肩胯关系、手臂位置、手指动作和腿部支撑。多人画面需明确人物之间的距离、互动方向和遮挡关系。动作符合人体结构，避免肢体穿插。"
      : "【姿势与肢体控制】\n准确呈现用户指定的动作、表情和视线；姿势自然舒展，重心与肢体动作符合人体结构。")
    : "";

  const sceneSection = detailed
    ? `【场景与环境｜${scene.name}】\n${scene.detail} 场景中各元素应有明确的前后关系、合理尺度和自然接触阴影；背景服务于主体，不添加抢夺注意力的无关元素。`
    : `【场景与环境】\n${scene.detail}`;

  const framingSection = detailed
    ? `【摄影机位与构图】\n画幅比例：${ratio}。摄影机位：${camera}。${cameraMap[camera]} ${lens} 根据主体选择合适的拍摄距离与景别，明确主体位置、留白、背景占比、透视关系和边缘安全空间。`
    : `【构图】\n画幅比例：${ratio}。机位：${camera}。${cameraMap[camera]} 主体清晰突出，构图平衡，重要元素完整呈现。`;

  const visualSection = detailed
    ? `【风格、光线与画面质感】\n整体风格：${style}。${lightMap[lighting]} 色彩关系自然统一，保留高光、阴影与中间调层次；准确呈现画面中实际存在的皮肤、织物、金属、玻璃、木材或自然材质。\n【画面质量与一致性】\n主体清晰，结构准确，透视合理，光照方向统一，空间层次明确；细节丰富但不过度锐化，避免塑料感和不真实滤镜。`
    : `【风格与光线】\n整体风格：${style}。${lightMap[lighting]} 画面色彩协调，主体与环境融合自然，保留真实材质和清晰的视觉重点。`;

  const negative = unique([
    ...NEGATIVES[category],
    ...(scene.id === "beach" ? ["水面与沙滩边界错误", "海平面倾斜", "浪花形态重复"] : []),
    ...(scene.id === "flower" ? ["花朵机械重复", "花枝穿过人物身体", "花瓣粘连"] : []),
    ...(scene.id === "indoor" ? ["家具结构扭曲", "门窗透视错误", "物体悬浮"] : []),
    ...(scene.id === "night" ? ["无来源强光", "夜景过度提亮", "霓虹文字乱码"] : []),
    ...(scene.id === "architecture" ? ["重复门窗", "立面节奏混乱"] : [])
  ]);

  const sections = [
    `# ${desc.split(/[，。；,.;]/)[0].slice(0, 26)} · ${kind}`,
    `【主题与核心创意】\n${desc}`,
    subjectSection,
    poseSection,
    sceneSection,
    framingSection,
    visualSection,
    `【负面提示词】\n${negative.join("，")}。`,
    "【最终画面要求】\n严格保留用户原始主题、主体和指定元素。所有补充细节必须服务于核心创意；遇到用户未指定的信息应合理克制，不得与原始描述冲突。输出完整、统一、可直接用于图像生成的画面描述。"
  ].filter(Boolean);
  currentPrompt = sections.join("\n\n");
  if ($("language").value === "英文") {
    currentPrompt = toEnglishPrompt(currentPrompt, desc);
  }
  $("result").textContent = currentPrompt;
  $("result-panel").classList.remove("hidden");
  $("result-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function toEnglishPrompt(prompt, originalDescription) {
  // Local mode cannot translate arbitrary user prose reliably. Keep the user's wording intact
  // and translate structural headings/instructions rather than pretending to provide full translation.
  const labels = {
    "【主题与核心创意】": "[CORE CONCEPT]",
    "【人物外观与主体细节】": "[SUBJECT APPEARANCE AND DETAILS]",
    "【产品形态与材质】": "[PRODUCT FORM AND MATERIALS]",
    "【建筑结构与材质】": "[ARCHITECTURE AND MATERIALS]",
    "【自然环境与空间】": "[NATURAL ENVIRONMENT AND SPACE]",
    "【角色与画面细节】": "[CHARACTER AND VISUAL DETAILS]",
    "【姿势与肢体控制】": "[POSE AND BODY LANGUAGE]",
    "【场景与环境｜": "[SETTING AND ENVIRONMENT | ",
    "【场景与环境】": "[SETTING AND ENVIRONMENT]",
    "【摄影机位与构图】": "[CAMERA AND COMPOSITION]",
    "【构图】": "[COMPOSITION]",
    "【风格、光线与画面质感】": "[STYLE, LIGHTING AND IMAGE TEXTURE]",
    "【风格与光线】": "[STYLE AND LIGHTING]",
    "【画面质量与一致性】": "[IMAGE QUALITY AND CONSISTENCY]",
    "【负面提示词】": "[NEGATIVE PROMPT]",
    "【最终画面要求】": "[FINAL REQUIREMENTS]"
  };
  let output = prompt;
  for (const [zh, en] of Object.entries(labels)) output = output.replaceAll(zh, en);
  return "[ENGLISH-LABEL MODE — user description is preserved verbatim; full translation is not available in offline mode]\n\n" + output;
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
