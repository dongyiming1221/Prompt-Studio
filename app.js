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

function extractCoreDescription(raw) {
  const match = raw.match(/【主题与核心创意】\s*([\s\S]*?)(?=\n【|$)/);
  if (match) return match[1].trim();
  return raw.replace(/^#.*$/gm, "").trim();
}
function hasAny(text, patterns) { return patterns.some(pattern => pattern.test(text)); }

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
  const scene = detectScene(desc);
  const category = getCategory(kind);

  const cameraText = {
    "自然平视": "相机与人物视线高度接近，以自然平视角度拍摄",
    "低机位仰拍": "相机略低于主体视线，轻微向上拍摄，避免夸张透视",
    "高机位俯拍": "相机位于主体上方，以克制的俯拍角度交代人物与环境",
    "侧面视角": "从主体侧前方拍摄，呈现自然轮廓与环境纵深",
    "主观视角": "采用自然的主观视角，保持前景与主体之间的真实距离"
  }[camera] || "采用自然、稳定的观察视角";
  const lightText = {
    "自然光": "以自然日光作为主光，保留柔和阴影和真实环境反射光",
    "柔和人像光": "使用柔和、均匀的人像光，保留面部自然立体感",
    "电影感侧逆光": "使用侧逆光勾勒主体轮廓，并以微弱正面补光保留细节",
    "商业棚拍光": "使用受控棚拍光，准确呈现主体形态与材质",
    "黄昏暖光": "以低角度暖色夕阳照亮主体，形成柔和的长阴影",
    "夜景环境光": "以场景中真实存在的灯光照明，保留夜间明暗层次"
  }[lighting] || "采用符合场景的自然光线";
  const lensByCategory = { people: "50mm 等效焦段", group: "35mm 等效焦段", landscape: "28mm 等效焦段", product: "85mm 等效焦段", architecture: "28mm 等效焦段", illustration: "自然透视视角" };
  const lens = lensByCategory[category] || "50mm 等效焦段";

  let promptBody = "";
  if (category === "people") {
    const adult = hasAny(desc, [/成年/, /岁/]) ? "" : "一位明确成年的";
    const ethnicity = hasAny(desc, [/亚洲/, /东亚/]) ? "亚洲" : "亚洲";
    const ageStyle = /年轻/.test(desc) ? "年轻" : "";
    const subject = adult + ageStyle + ethnicity + "女性";
    const hasHat = /草帽|遮阳帽|帽子|帽檐/.test(desc);
    const appearance = [
      hasHat ? "头戴一顶浅色编织遮阳草帽" : "头发与配饰保持简洁自然",
      /长发/.test(desc) ? "长发自然垂落" : "发丝自然蓬松",
      /连衣裙|裙子|裙装/.test(desc) ? "穿着轻盈自然的连衣裙" : "穿着简洁得体、适合户外写真的浅色夏日连衣裙"
    ].join("，");
    const pose = [
      /双手|两只手/.test(desc) && hasHat ? "双手轻轻扶住草帽两侧帽檐" : /双手/.test(desc) ? "双手保持用户指定的动作" : "双臂姿态自然放松",
      /闭着眼|闭眼/.test(desc) ? "双眼轻轻闭合" : /看向镜头/.test(desc) ? "目光自然看向镜头" : "视线方向自然",
      /微微抬头|抬头/.test(desc) ? "下巴微微抬起" : "",
      /微笑|微微笑|笑容/.test(desc) ? "面带轻松、自然的微笑" : "表情放松自然"
    ].filter(Boolean).join("，");
    let environment = "";
    if (scene.id === "flower") {
      environment = "她置身于盛放的花海之中，近处几朵花在画面下缘形成轻微虚化的前景，中景是色彩丰富、疏密自然的花丛，远处花田向地平线延伸，与开阔的蔚蓝天空相接。花朵大小真实，颜色自然错落，不出现机械重复的图案。";
      if (/微风|风吹|风/.test(desc)) environment += "微风轻轻吹动少量发丝、裙摆和花枝，动态方向一致，不遮挡面部。";
      if (/阳光|晴天|明媚/.test(desc)) environment += "明亮的阳光从侧前方照来，在帽檐、发丝和花瓣边缘形成柔和高光，面部仍保留清晰细节。";
    } else if (scene.id === "beach") {
      environment = "背景呈现开阔的海岸与自然延伸的海平线，前景、中景和远景层次清楚，水面反光与人物受光方向一致。";
    } else if (scene.id === "indoor") {
      environment = "室内陈设简洁克制，家具、墙面和窗户形成清晰的空间层次，窗边自然光柔和地照亮人物。";
    } else if (scene.id === "studio") {
      environment = "背景干净简洁，人物与背景保持适当距离，光线柔和且阴影方向统一。";
    } else {
      environment = "背景元素与人物主题一致，前景、中景和远景层次自然，空间尺度可信，不加入无关装饰。";
    }
    promptBody = subject + " " + appearance + "。" + pose + "。" + environment;
    if (detailed) promptBody += "人物身体结构自然，肩部、手臂与手指动作协调，双脚支撑稳定；服装面料轻盈，褶皱与光线变化真实。";
  } else if (category === "group") {
    promptBody = desc + "。清楚呈现每个人物的外观、动作和相互关系，人物之间保留合理距离，手臂与身体不交叉穿插，所有人物比例自然且完整。" + scene.detail;
  } else if (category === "landscape") {
    promptBody = desc + "。画面以明确的前景、中景和远景建立空间纵深，地貌、水体、植被与天空保持真实尺度，光线和天气表现统一。";
  } else if (category === "product") {
    promptBody = desc + "。完整呈现产品轮廓、关键结构和真实比例，表面材质、纹理、反射与接触阴影准确，背景简洁且不干扰主体。";
  } else if (category === "architecture") {
    promptBody = desc + "。准确呈现建筑体量、立面节奏、门窗比例和表面材质，保持垂直线稳定、透视关系正确，并通过前景与周边环境体现建筑尺度。";
  } else {
    promptBody = desc + "。保留角色或主体的核心设计，明确轮廓、动作、色彩关系与空间层次，整体视觉风格统一，结构清晰。";
  }

  const negative = unique([
    ...NEGATIVES[category],
    ...(scene.id === "beach" ? ["海平面倾斜", "水面与沙滩边界错误", "浪花机械重复"] : []),
    ...(scene.id === "flower" ? ["花朵机械重复", "花枝穿过人物身体", "花瓣粘连", "花海遮挡人物面部"] : []),
    ...(scene.id === "indoor" ? ["家具结构扭曲", "门窗透视错误", "物体悬浮"] : []),
    ...(scene.id === "night" ? ["无来源强光", "夜景过度提亮", "霓虹文字乱码"] : []),
    ...(category === "architecture" ? ["重复门窗", "立面节奏混乱", "建筑垂直线倾斜"] : [])
  ]);
  const sections = [
    "# " + desc.split(/[，。；,.;]/)[0].slice(0, 26) + " · " + kind,
    "【画面描述】\n" + promptBody,
    "【摄影与构图】\n" + ratio + " 画幅，" + cameraText + "，" + lens + "，" + style + "。" + lightText + "。主体清晰突出，构图稳定，保留自然景深与环境层次。",
    detailed ? "【细节控制】\n真实呈现皮肤、织物与环境材质；人物结构、物体比例和透视准确，细节清楚但不过度锐化，避免塑料质感。" : "",
    "【负面提示词】\n" + negative.join("，") + "。"
  ].filter(Boolean);
  currentPrompt = sections.join("\n\n");
  if ($("language").value === "英文") currentPrompt = toEnglishPrompt(currentPrompt, desc);
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
