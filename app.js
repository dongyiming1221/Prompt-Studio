"use strict";

const $ = (id) => document.getElementById(id);
let currentPrompt = "";

const STORAGE_KEY = "prompt-studio-history-v2";

const NEGATIVES = {
  people: ["低质量", "模糊", "失焦", "面部畸形", "五官错位", "塑料皮肤", "过度磨皮", "身体比例失调", "解剖结构错误", "多余肢体", "多余手指", "手指粘连", "手部畸形", "关节扭曲", "肢体穿插", "服装结构错误", "布料穿模", "人物悬浮", "重复人物", "意外裁切", "过曝", "死黑阴影", "文字", "水印"],
  group: ["低质量", "模糊", "面部畸形", "人物重复", "肢体穿插", "多余肢体", "手部畸形", "比例失调", "意外裁切", "文字", "水印"],
  landscape: ["低质量", "模糊", "透视错误", "地貌结构扭曲", "重复纹理", "比例失真", "过曝", "死黑阴影", "文字", "水印"],
  product: ["低质量", "模糊", "产品变形", "结构错误", "比例失真", "材质错误", "悬浮", "重复物体", "文字", "水印"],
  architecture: ["低质量", "模糊", "建筑变形", "透视错误", "垂直线倾斜", "门窗重复", "比例失真", "文字", "水印"],
  illustration: ["低质量", "模糊", "结构崩坏", "比例失调", "色彩脏乱", "元素重复", "文字", "水印"]
};

function cleanDescription(value) {
  return String(value || "")
    .replace(/^\s*(?:生成一张|生成|画一张|绘制一张|请生成|帮我生成)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCoreDescription(raw) {
  const text = String(raw || "").replace(/\r/g, "");
  const corePatterns = [
    /【主题与核心创意】\s*([\s\S]*?)(?=\n【|$)/,
    /【核心创意】\s*([\s\S]*?)(?=\n【|$)/,
    /【画面描述】\s*([\s\S]*?)(?=\n【|$)/
  ];
  for (const pattern of corePatterns) {
    const match = text.match(pattern);
    if (match && match[1].trim()) return cleanDescription(match[1]);
  }

  const ignoredHeadings = /【(?:人物外观与主体细节|姿势与肢体控制|场景与环境[^】]*|摄影机位与构图|风格[^】]*|画面质量与一致性|负面提示词|最终画面要求|摄影与构图|细节控制)】/;
  const lines = text.split("\n");
  const kept = [];
  let ignore = false;
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line.trim())) continue;
    if (ignoredHeadings.test(line)) { ignore = true; continue; }
    if (/^【/.test(line.trim())) { ignore = false; continue; }
    if (!ignore && line.trim()) kept.push(line.trim());
  }
  return cleanDescription(kept.join(" "));
}

function getCategory(kind) {
  if (/多人|情侣/.test(kind)) return "group";
  if (/风景/.test(kind)) return "landscape";
  if (/产品/.test(kind)) return "product";
  if (/建筑/.test(kind)) return "architecture";
  if (/动漫|插画/.test(kind)) return "illustration";
  return "people";
}

function detectScene(text) {
  const rules = [
    ["flower", /花海|花田|花园|花丛|花束|花店/],
    ["beach", /海边|海滩|沙滩|海岸|海浪|海面/],
    ["pool", /泳池|游泳池|池边|水上乐园/],
    ["cafe", /咖啡馆|咖啡厅|茶馆|餐厅|餐桌/],
    ["office", /办公室|办公桌|会议室/],
    ["studio", /摄影棚|影棚|纯色背景|棚拍/],
    ["indoor", /室内|卧室|客厅|家中|房间|窗边/],
    ["night", /夜景|夜晚|夜色|霓虹|夜间/],
    ["street", /街道|街头|马路|巷子|城市街景/],
    ["forest", /森林|树林|林间|树丛/],
    ["mountain", /山间|山顶|山脉|高山|山谷/],
    ["lake", /湖边|湖泊|河边|河岸|溪流/],
    ["grassland", /草原|草地|田野|麦田/]
  ];
  for (const [id, pattern] of rules) if (pattern.test(text)) return id;
  return "general";
}

function sceneDescription(scene, category, text) {
  const breeze = /微风|有风|海风|风吹/.test(text);
  const sunshine = /阳光|晴天|日光|明媚|夕阳|黄昏/.test(text);
  const person = category === "people" || category === "group";
  const map = {
    flower: "近处少量花朵形成自然前景，中景花丛疏密错落，远处花田向地平线延伸；花朵大小与主体比例真实，花色自然变化。",
    beach: "画面呈现沙滩、潮线、海面与远处海平线的空间层次，湿沙与水面反光自然，浪花尺度符合真实海岸环境。",
    pool: "清楚呈现池沿、池水和周围露台的空间关系，水面反射与折射自然，主体与池边接触可信。",
    indoor: "通过墙面、门窗、地面和实际存在的家具交代室内布局，前后景距离明确，物件尺度合理并稳定落地。",
    cafe: "桌椅、吧台与实际存在的餐具构成有层次的咖啡馆空间，背景陈设适量，不遮挡主体。",
    office: "办公桌、座椅、设备和墙面构成清晰的办公空间，物件比例可信，布局有序。",
    studio: "背景简洁，主体与背景保持适当距离，阴影方向与主光方向一致。",
    night: "利用画面中实际可见的路灯、窗光或招牌光源建立夜间照明，暗部保留层次。",
    street: "道路、建筑立面与街道纵深形成自然透视，背景元素保持合理尺度，不抢夺主体注意力。",
    forest: "近处植被、中景树木和远处林木形成自然纵深，枝叶疏密真实，避免重复纹理。",
    mountain: "近处地形、中景山体和远处山脊形成尺度层次，远山呈现自然空气透视。",
    lake: "水岸、湖面与周围地形形成连续空间，水面反射和岸边接触关系可信。",
    grassland: "草地或田野由近及远自然延伸，植被高度与密度有变化，远景不过度重复。",
    general: person ? "环境只补充与主体相关的空间信息，不凭空增加具体地点或道具。" : "主体与环境保持真实尺度、透视和空间关系。"
  };
  const parts = [map[scene] || map.general];
  if (breeze && ["flower", "beach", "grassland", "forest"].includes(scene)) {
    parts.push("微风只带动少量发丝、花枝或衣物，动态轻微且方向一致，不遮挡主体。");
  }
  if (sunshine && ["flower", "beach", "grassland", "lake"].includes(scene)) {
    parts.push("自然日光在实际物体边缘形成柔和高光，阴影保留细节，亮部不过曝。");
  }
  return parts.join("");
}

function getPoseDescription(text) {
  const cues = [];
  const checks = [
    [/双手扶着帽檐|双手轻轻扶住帽檐|扶着帽檐/, "双手分别扶住草帽两侧帽檐，手指自然弯曲，手腕与手臂姿态协调"],
    [/单手扶着帽檐|一只手扶着帽檐/, "一只手轻扶帽檐，另一只手保持自然放松"],
    [/闭着眼睛|双眼闭合|闭眼/, "双眼自然闭合"],
    [/微微抬头|微抬头|抬起下巴/, "下巴微微抬起"],
    [/面带微笑|微笑|笑容/, "面部呈现自然放松的微笑"],
    [/看向镜头|看镜头|注视镜头/, "视线自然看向镜头"],
    [/回头|回眸/, "身体保持自然朝向，头部轻轻转向身后"],
    [/坐在|坐着/, "保持自然坐姿，身体重心由座面稳定支撑"],
    [/行走|走在|漫步/, "处于自然行走过程中，步幅舒展，身体重心稳定"],
    [/奔跑|跑步/, "处于自然奔跑动作中，四肢运动协调"]
  ];
  for (const [pattern, phrase] of checks) if (pattern.test(text)) cues.push(phrase);
  return cues.length ? cues.join("，") + "。" : "";
}

function getPersonDescription(text) {
  const parts = [];
  if (/草帽|遮阳帽/.test(text)) parts.push("头戴一顶自然编织质感的遮阳草帽");
  if (/长发/.test(text)) parts.push("留有自然垂落的长发");
  else if (/短发/.test(text)) parts.push("留有利落的短发");
  if (/马尾/.test(text)) parts.push("头发扎成马尾");
  if (/卷发/.test(text)) parts.push("发丝呈自然卷曲");
  else if (/直发/.test(text)) parts.push("发丝自然顺直");
  if (/眼镜/.test(text)) parts.push("佩戴与原描述一致的眼镜");
  if (/耳环/.test(text)) parts.push("佩戴耳环");
  if (/项链/.test(text)) parts.push("佩戴项链");
  if (/连衣裙|裙子|裙装/.test(text)) parts.push("穿着原描述指定的裙装，呈现真实版型与面料褶皱");
  if (/衬衫/.test(text)) parts.push("穿着原描述指定的衬衫");
  if (/T恤/.test(text)) parts.push("穿着原描述指定的T恤");
  if (/泳装|泳衣/.test(text)) parts.push("穿着原描述指定的泳装");
  if (/西装/.test(text)) parts.push("穿着原描述指定的西装");
  if (/牛仔裤/.test(text)) parts.push("穿着原描述指定的牛仔裤");
  return parts.length ? parts.join("，") + "。" : "";
}

function getLens(category, scene, text) {
  if (category === "landscape") return "24–35mm 等效广角焦段，展现环境纵深";
  if (category === "product") return "50–85mm 等效焦段，准确呈现产品比例与细节";
  if (category === "architecture") return "24–35mm 等效焦段，控制建筑透视";
  if (category === "group") return "35–50mm 等效焦段，兼顾人物关系与环境";
  if (scene === "flower" || scene === "beach") return "50mm 等效焦段，兼顾人物与环境层次";
  return "50–85mm 等效焦段，保持自然人物透视";
}

function getCameraText(value) {
  const map = {
    "自然平视": "相机位于接近人物视线的高度，以自然平视角度拍摄",
    "低机位仰拍": "相机位置低于主体视线，适度向上仰拍，透视自然不过度夸张",
    "高机位俯拍": "相机位于主体上方，向下俯拍，保持空间关系自然",
    "侧面视角": "从主体侧方拍摄，呈现清晰的侧向轮廓与空间层次",
    "主观视角": "采用接近观察者视线的主观视角，前景关系自然"
  };
  return map[value] || map["自然平视"];
}

function getLightText(value) {
  const map = {
    "自然光": "使用符合场景的自然光，保留真实环境反射光与柔和阴影",
    "柔和人像光": "采用柔和均匀的人像光，面部曝光自然，阴影过渡细腻",
    "电影感侧逆光": "采用有方向的侧逆光，在主体轮廓形成适度边缘高光，同时保留面部细节",
    "商业棚拍光": "使用均匀可控的棚拍布光，主体受光清晰，阴影干净",
    "黄昏暖光": "使用低角度暖色夕照，形成柔和长阴影与自然暖色高光",
    "夜景环境光": "以场景中可见的灯光作为主要光源，保留夜间明暗层次"
  };
  return map[value] || map["自然光"];
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function buildPrompt() {
  const raw = $("description").value.trim();
  if (!raw) {
    toast("先描述你想生成的画面");
    $("description").focus();
    return;
  }

  const desc = extractCoreDescription(raw) || cleanDescription(raw);
  const kind = $("kind").value;
  const style = $("style").value;
  const ratio = $("ratio").value;
  const camera = $("camera").value;
  const lighting = $("lighting").value;
  const detailed = $("detailed").checked;
  const category = getCategory(kind);
  const scene = detectScene(desc);

  const title = desc.split(/[，。；,.;]/)[0].slice(0, 28) || kind;
  const visualParts = [desc];

  if (category === "people") {
    const person = getPersonDescription(desc);
    const pose = getPoseDescription(desc);
    if (person && !person.split(/[，。]/).some(part => desc.includes(part))) visualParts.push(person);
    if (pose) visualParts.push(pose);
    if (scene !== "general") visualParts.push(sceneDescription(scene, category, desc));
    visualParts.push("人物面部、手部与身体比例自然，动作符合人体结构，身体与环境接触可信。");
  } else if (category === "group") {
    visualParts.push("人物之间的距离、互动方向和遮挡关系清楚，每个人物的动作与身体结构自然。");
    if (scene !== "general") visualParts.push(sceneDescription(scene, category, desc));
  } else if (category === "landscape") {
    visualParts.push("以前景、中景和远景建立纵深，地貌、水体、植被与天空保持真实尺度。");
    if (scene !== "general") visualParts.push(sceneDescription(scene, category, desc));
  } else if (category === "product") {
    visualParts.push("完整呈现产品轮廓、关键结构和真实比例，材质纹理、反射与接触阴影符合实际物理表现。");
  } else if (category === "architecture") {
    visualParts.push("准确呈现建筑体量、立面节奏、门窗比例和表面材质，保持垂直线稳定、透视关系正确。");
  } else {
    visualParts.push("保留主体核心设计，明确轮廓、动作、色彩关系与空间层次，整体视觉风格统一。");
  }

  const composition = [
    ratio + " 画幅",
    getCameraText(camera),
    getLens(category, scene, desc),
    style,
    getLightText(lighting),
    detailed ? "主体位置、景别、留白与背景占比协调，空间层次清楚" : "主体突出，构图稳定"
  ].join("；") + "。";

  const negatives = [...(NEGATIVES[category] || NEGATIVES.people)];
  if (scene === "flower") negatives.push("花朵机械重复", "花枝穿过主体", "花瓣粘连", "花海遮挡面部");
  if (scene === "beach") negatives.push("海平面倾斜", "水面与沙滩边界错误", "浪花机械重复");
  if (["indoor", "cafe", "office"].includes(scene)) negatives.push("家具结构扭曲", "门窗透视错误", "物体悬浮", "室内比例错误");
  if (scene === "night") negatives.push("无来源强光", "夜景过度提亮", "灯光方向混乱");
  if (["pool", "lake"].includes(scene)) negatives.push("水面反射错误", "水体边界扭曲");

  const sections = [
    "# " + title + " · " + kind,
    "【画面描述】\n" + unique(visualParts).join(""),
    "【摄影与构图】\n" + composition
  ];
  if (detailed) {
    sections.push("【细节控制】\n材质表现符合画面中实际存在的对象；细节清晰但不过度锐化，透视、接触阴影与光照方向保持一致。");
  }
  sections.push("【负面提示词】\n" + unique(negatives).join("，") + "。");

  currentPrompt = sections.join("\n\n");
  if ($("language").value === "英文") {
    currentPrompt = "[English structure; original scene description is preserved]\n\n" + currentPrompt;
  }
  $("result").textContent = currentPrompt;
  $("result-panel").classList.remove("hidden");
  $("result-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function toast(message) {
  const node = $("toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2200);
}

function getHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function setHistory(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  updateHistoryCount();
}

function updateHistoryCount() {
  const count = $("history-count");
  if (count) count.textContent = String(getHistory().length);
}

function renderHistory() {
  const host = $("history-list");
  if (!host) return;
  host.innerHTML = "";
  const items = getHistory();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "还没有保存过提示词。";
    host.append(empty);
    updateHistoryCount();
    return;
  }
  items.forEach(item => {
    const card = document.createElement("article");
    card.className = "history-card";
    const time = document.createElement("time");
    time.textContent = item.time || "";
    const p = document.createElement("p");
    p.textContent = item.prompt;
    const copy = document.createElement("button");
    copy.className = "button secondary";
    copy.textContent = "复制";
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(item.prompt); toast("已复制"); }
      catch (_) { toast("复制失败，请手动选择文本"); }
    };
    const load = document.createElement("button");
    load.className = "button secondary";
    load.textContent = "载入";
    load.onclick = () => {
      currentPrompt = item.prompt;
      $("result").textContent = item.prompt;
      $("result-panel").classList.remove("hidden");
      showTab("create");
      $("result-panel").scrollIntoView({ behavior: "smooth" });
    };
    const del = document.createElement("button");
    del.className = "button secondary";
    del.textContent = "删除";
    del.onclick = () => {
      setHistory(getHistory().filter(x => x.id !== item.id));
      renderHistory();
    };
    card.append(time, p, copy, load, del);
    host.append(card);
  });
  updateHistoryCount();
}

function showTab(name) {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
  document.querySelectorAll(".view").forEach(view => view.classList.add("hidden"));
  const target = $(name + "-view");
  if (target) target.classList.remove("hidden");
  if (name === "history") renderHistory();
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
});

$("description").addEventListener("input", event => {
  $("char-count").textContent = event.target.value.length + " 字";
});
$("generate").addEventListener("click", buildPrompt);
$("regenerate").addEventListener("click", buildPrompt);
$("clear").addEventListener("click", () => {
  $("description").value = "";
  $("char-count").textContent = "0 字";
  $("result-panel").classList.add("hidden");
  $("description").focus();
});
$("copy").addEventListener("click", async () => {
  if (!currentPrompt) return;
  try {
    await navigator.clipboard.writeText(currentPrompt);
    toast("完整提示词已复制");
  } catch (_) {
    toast("复制失败，请手动选择文本");
  }
});
$("save").addEventListener("click", () => {
  if (!currentPrompt) return;
  const items = getHistory();
  items.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    time: new Date().toLocaleString(),
    prompt: currentPrompt
  });
  setHistory(items.slice(0, 100));
  toast("已保存到历史记录");
});
$("clear-history").addEventListener("click", () => {
  if (confirm("确定清空所有本地历史记录吗？")) {
    setHistory([]);
    renderHistory();
  }
});

function setupEngineMode() {
  const notice = document.querySelector(".editor-panel .notice");
  if (!notice || document.getElementById("engine-mode")) return;
  const wrapper = document.createElement("label");
  wrapper.style.cssText = "display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:12px;font-weight:600";
  wrapper.textContent = "生成引擎";
  const select = document.createElement("select");
  select.id = "engine-mode";
  select.style.cssText = "height:36px;border:1px solid #e8e7e0;border-radius:8px;padding:0 10px;background:white;font:inherit";
  const local = document.createElement("option");
  local.value = "local";
  local.textContent = "免费离线模式（可用）";
  const ai = document.createElement("option");
  ai.value = "ai";
  ai.textContent = "AI 增强模式（后续接入）";
  ai.disabled = true;
  select.append(local, ai);
  wrapper.append(select);
  notice.parentNode.insertBefore(wrapper, notice);
  select.addEventListener("change", () => {
    if (select.value === "ai") {
      select.value = "local";
      toast("AI 增强接口尚未接入，当前使用免费离线模式");
    }
  });
}

setupEngineMode();
setHistory(getHistory());

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
