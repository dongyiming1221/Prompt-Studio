const $ = (id) => document.getElementById(id);
let currentPrompt = "";
const STORAGE_KEY = "prompt-studio-history-v2";

function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.remove("show"),2100)}
function getHistory(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")}catch{return []}}
function setHistory(items){localStorage.setItem(STORAGE_KEY,JSON.stringify(items));$("history-count").textContent=items.length}
function showTab(name){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));["create","history","settings"].forEach(n=>$(`${n}-view`).classList.toggle("hidden",n!==name));if(name==="history")renderHistory()}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
$("description").addEventListener("input",e=>$("char-count").textContent=`${e.target.value.length} 字`);

const negatives={
人物写真:"低质量，模糊，失焦，面部崩坏，五官错位，塑料皮肤，过度磨皮，过度锐化，身体比例失调，解剖结构错误，多余肢体，多余手指，手指粘连，手部畸形，关节扭曲，肢体穿插，服装结构错误，布料穿模，人物悬浮，背景杂乱，重复人物，透视错误，意外裁切，过曝，死黑阴影，文字，水印，Logo",
"情侣/多人写真":"低质量，模糊，面部崩坏，人物身份混淆，重复人物，人数错误，肢体融合，手臂穿插，手指畸形，比例失调，视线混乱，人物遮挡异常，背景杂乱，过曝，水印，文字",
风景摄影:"低质量，模糊，地平线倾斜，透视错误，重复物体，结构扭曲，色彩过饱和，过度HDR，过度锐化，雾霾感，杂乱前景，人工塑料质感，文字，水印",
产品摄影:"低质量，模糊，产品变形，比例错误，结构缺失，材质错误，反射异常，边缘融化，悬浮，透视错误，杂乱背景，文字乱码，水印，Logo变形",
建筑摄影:"低质量，模糊，建筑结构扭曲，垂直线倾斜，透视错误，重复窗户，比例失调，材质错误，边缘融化，杂乱环境，过曝，水印",
动漫插画:"低质量，线条混乱，结构崩坏，比例错误，五官错位，肢体畸形，多余手指，重复人物，色彩脏污，画面杂乱，文字，水印"
};
function buildPrompt(){
 const desc=$("description").value.trim();if(!desc){toast("先描述你想生成的画面");$("description").focus();return}
 const kind=$("kind").value,style=$("style").value,ratio=$("ratio").value,camera=$("camera").value,lighting=$("lighting").value,detail=$("detailed").checked;
 const cameraMap={"自然平视":"采用自然平视机位，保持接近人眼观察的透视关系，避免不必要的广角畸变。","低机位仰拍":"相机置于较低位置向上拍摄，明确机位高度、仰拍角度与主体透视关系；透视变化服务于画面表达，避免夸张拉伸。","高机位俯拍":"相机置于主体上方俯拍，交代主体与地面、环境的空间关系，避免头身比例异常。","侧面视角":"从主体侧前方取景，呈现轮廓、动作方向和环境纵深。","主观视角":"采用具有明确观看者位置的主观视角，保持前景与主体之间自然的空间关系。"};
 const lightMap={"自然光":"使用符合场景的自然光，明确光线方向、软硬程度、明暗过渡与环境反射光。","柔和人像光":"采用柔和人像光，控制面部阴影、皮肤高光和主体轮廓，保留自然立体感。","电影感侧逆光":"采用侧逆光塑造主体轮廓，提供适度正面补光，控制高光与暗部细节。","商业棚拍光":"使用有控制的商业棚拍布光，准确呈现主体形态、颜色与材质。","黄昏暖光":"使用低角度黄昏暖光，形成温暖的侧向照明与柔和长阴影。","夜景环境光":"以场景中的实际光源作为主要照明，保留夜景氛围和可信的明暗层次。"};
 const cameraLens=kind.includes("人物")?"人物写真优先考虑 50mm 或 85mm 等效焦段；近距离环境人像可考虑 35mm。":kind==="风景摄影"?"根据场景范围选择 24–35mm 等效焦段，注意前中后景关系。":kind==="产品摄影"?"使用 50–100mm 等效焦段，控制透视并准确呈现产品形态。":kind==="建筑摄影"?"优先使用 24–35mm 等效焦段，保持建筑垂直线与空间比例自然。":"根据画面风格选择合适视角，确保主体结构清楚。";
 const subject=kind.includes("人物")?`【人物外观与主体细节】\n${detail?"明确人物为成年人（如涉及人物），具体描述面部轮廓、五官特征、发型、肤质、妆容、身材比例与辨识性细节。服装需说明款式、裁片结构、版型、面料厚薄、织纹、褶皱和受光表现。":"突出人物最重要的外观特征、服装和整体气质。"}\n未指定的外观细节只做合理补全，不改变用户指定特征。`:
 kind==="产品摄影"?"【产品与材质】\n明确产品外形、结构、尺寸关系、表面工艺、材质反射、边缘细节和摆放方式，保持产品设计一致。":
 kind==="建筑摄影"?"【建筑结构与材质】\n明确建筑体量、立面节奏、门窗结构、材质肌理、空间尺度和周边环境，保持结构与透视可信。":
 kind==="风景摄影"?"【自然环境与空间】\n明确地貌、水体、植被、天空和天气特征，建立前景、中景、远景的层次，保持自然尺度。":
 "【角色与画面细节】\n明确角色外观、服饰设计、动作、线条语言、色彩体系和画面层次，保持造型统一。";
 const pose=kind.includes("人物")?`【姿势与肢体控制】\n${detail?"明确身体朝向、重心落点、肩胯关系、手臂位置、手指动作、腿部支撑和视线方向。动作符合人体结构，避免僵硬、肢体穿插与不合理关节角度。":"姿势自然舒展，肢体比例与动作逻辑合理。"}\n`:"";
 const framing=`【摄影机位与构图】\n画幅比例：${ratio}。${cameraMap[camera]}${cameraLens}\n根据主体选择合适的拍摄距离与景别，明确主体在画面中的位置、留白、背景占比、透视关系和边缘安全空间。避免重要部位被意外裁切。`;
 const environment=`【场景与环境】\n根据原始描述补全合理地点、环境元素和空间层次。分别安排前景、中景与背景，交代主体和环境之间的距离、遮挡与空间关系。背景应服务主体，不添加抢夺视觉注意力的无关元素。`;
 const quality=`【风格、光线与画面质感】\n整体风格：${style}。${lightMap[lighting]}\n色彩关系自然统一，保留高光、阴影与中间调层次。准确呈现皮肤、织物、金属、玻璃、木材或自然景物等对应材质。画面细节清晰但不过度锐化，避免塑料感与不真实滤镜。\n【画面质量与一致性】\n主体清晰，结构准确，透视合理，光照方向统一，空间层次明确，画面具有明确视觉重点。`;
 const negative=`【负面提示词】\n${negatives[kind]||negatives.人物写真}。`;
 currentPrompt=`# ${desc.split(/[，。；,.;]/)[0].slice(0,26)} · ${kind}\n\n【主题与核心创意】\n${desc}\n\n${subject}\n\n${pose}${environment}\n${framing}\n\n${quality}\n\n${negative}\n【最终画面要求】\n严格保留用户原始主题、主体和指定元素。所有补充细节必须服务于核心创意，各部分之间保持视觉与物理逻辑一致，直接呈现完整、统一、可执行的最终画面。`;
 if($("language").value==="英文")currentPrompt=toEnglishLite(currentPrompt);
 $("result").textContent=currentPrompt;$("result-panel").classList.remove("hidden");$("result-panel").scrollIntoView({behavior:"smooth",block:"start"});
}
function toEnglishLite(text){return "Create a professional image based on the following visual brief. Preserve the original concept and all specified details. Use coherent anatomy, perspective, lighting, materials, and composition.\n\n"+text.replaceAll("【主题与核心创意】","[CORE CONCEPT]").replaceAll("【人物外观与主体细节】","[SUBJECT APPEARANCE AND DETAILS]").replaceAll("【姿势与肢体控制】","[POSE AND BODY LANGUAGE]").replaceAll("【场景与环境】","[SETTING AND ENVIRONMENT]").replaceAll("【摄影机位与构图】","[CAMERA AND COMPOSITION]").replaceAll("【风格、光线与画面质感】","[STYLE, LIGHTING AND TEXTURE]").replaceAll("【画面质量与一致性】","[IMAGE QUALITY AND CONSISTENCY]").replaceAll("【负面提示词】","[NEGATIVE PROMPT]").replaceAll("【最终画面要求】","[FINAL REQUIREMENTS]")+"\n\nNote: This language option currently translates section labels only; full English translation requires the AI-enhanced backend."}
$("generate").addEventListener("click",buildPrompt);
$("regenerate").addEventListener("click",buildPrompt);
$("clear").addEventListener("click",()=>{$("description").value="";$("char-count").textContent="0 字";$("result-panel").classList.add("hidden");$("description").focus()});
$("copy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(currentPrompt);toast("已复制完整提示词")}catch{toast("复制失败，请手动选择文本")}});
$("save").addEventListener("click",()=>{if(!currentPrompt)return;const items=getHistory();items.unshift({id:Date.now(),date:new Date().toLocaleString("zh-CN"),prompt:currentPrompt});setHistory(items.slice(0,50));toast("已保存到历史记录")});
function renderHistory(){const items=getHistory();setHistory(items);const host=$("history-list");host.innerHTML="";if(!items.length){host.innerHTML='<div class="panel muted">还没有保存的提示词。生成并点击“保存到历史”后会显示在这里。</div>';return}items.forEach(item=>{const card=document.createElement("article");card.className="history-card";const time=document.createElement("time");time.textContent=item.date;const p=document.createElement("p");p.textContent=item.prompt;const copy=document.createElement("button");copy.className="button secondary";copy.textContent="复制";copy.onclick=async()=>{await navigator.clipboard.writeText(item.prompt);toast("已复制")};const load=document.createElement("button");load.className="button secondary";load.textContent="载入编辑";load.onclick=()=>{$("result").textContent=item.prompt;currentPrompt=item.prompt;$("result-panel").classList.remove("hidden");showTab("create");$("result-panel").scrollIntoView({behavior:"smooth"})};const del=document.createElement("button");del.className="button secondary";del.textContent="删除";del.onclick=()=>{setHistory(getHistory().filter(x=>x.id!==item.id));renderHistory()};card.append(time,p,copy,load,del);host.append(card)})}
$("clear-history").addEventListener("click",()=>{if(confirm("确定清空所有本地历史记录吗？")){setHistory([]);renderHistory()}});
setHistory(getHistory());
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
