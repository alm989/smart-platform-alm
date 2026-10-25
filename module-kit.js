(function(g){"use strict";
var FA=["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
function toFa(n){return String(n).replace(/\d/g,function(d){return FA[+d];});}
function toEn(s){return String(s).replace(/[۰-۹]/g,function(d){return "۰۱۲۳۴۵۶۷۸۹".indexOf(d);});}
function g2j(gy,gm,gd){var g_d_m=[0,31,59,90,120,151,181,212,243,273,304,334];var gy2=(gm>2)?(gy+1):gy;var days=355666+365*gy+Math.floor((gy2+3)/4)-Math.floor((gy2+99)/100)+Math.floor((gy2+399)/400)+gd+g_d_m[gm-1];var jy=-1595+33*Math.floor(days/12053);days%=12053;jy+=4*Math.floor(days/1461);days%=1461;if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365;}var jm=(days<186)?1+Math.floor(days/31):7+Math.floor((days-186)/30);var jd=1+((days<186)?(days%31):((days-186)%30));return {jy:jy,jm:jm,jd:jd};}
function j2g(jy,jm,jd){var jy2=jy-979,jm2=jm-1,jd2=jd-1;var days=365*jy2+Math.floor(jy2/33)*8+Math.floor(((jy2%33)+3)/4);for(var i=0;i<jm2;++i)days+=(i<6?31:30);days+=jd2;var gy=1600+400*Math.floor(days/146097);days%=146097;var leap=true;if(days>=36525){days--;gy+=100*Math.floor(days/36524);days%=36524;if(days>=365)leap=false;else days++;}gy+=4*Math.floor(days/1461);days%=1461;if(days>=366){leap=false;days--;gy+=Math.floor(days/365);days=days%365;}var gd=days+1,sal_a=[0,31,(leap?29:28),31,30,31,30,31,31,30,31,30,31],gm;for(gm=1;gm<=12&&gd>sal_a[gm];gm++)gd-=sal_a[gm];return {gy:gy,gm:gm,gd:gd};}
function jMonthLength(jy,jm){if(jm<=6)return 31;if(jm<=11)return 30;var a=j2g(jy,12,30);var b=g2j(a.gy,a.gm,a.gd);return (b.jy===jy&&b.jm===12&&b.jd===30)?30:29;}
var JM=["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
var JW=["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"];
function startClock(){function tick(){var n=new Date();var j=g2j(n.getFullYear(),n.getMonth()+1,n.getDate());
var elJ=document.getElementById("dtJ"),elG=document.getElementById("dtG"),elC=document.getElementById("dtC");
if(elJ)elJ.textContent=toFa(j.jy)+"/"+toFa(String(j.jm).padStart(2,"0"))+"/"+toFa(String(j.jd).padStart(2,"0"));
if(elG)elG.textContent=n.getFullYear()+"/"+String(n.getMonth()+1).padStart(2,"0")+"/"+String(n.getDate()).padStart(2,"0");
if(elC)elC.textContent=toFa(String(n.getHours()).padStart(2,"0"))+":"+toFa(String(n.getMinutes()).padStart(2,"0"))+":"+toFa(String(n.getSeconds()).padStart(2,"0"));
}tick();setInterval(tick,1000);}
function getFiscalYear(){try{var f=JSON.parse(localStorage.getItem("smart_fiscal_v1")||"null");if(f&&f.year)return f.year;}catch(e){}var n=new Date();return g2j(n.getFullYear(),n.getMonth()+1,n.getDate()).jy;}
function setFiscalYear(y){localStorage.setItem("smart_fiscal_v1",JSON.stringify({year:y}));}
function getAuth(modId){try{return JSON.parse(localStorage.getItem("smart_users_"+modId)||"null")||{users:[{user:"admin",pass:"admin",name:"مدیر"}],session:null};}catch(e){return {users:[{user:"admin",pass:"admin",name:"مدیر"}],session:null};}}
function saveAuth(modId,d){localStorage.setItem("smart_users_"+modId,JSON.stringify(d));}
function getActiveUser(modId){var a=getAuth(modId);return (a.session&&(a.session.name||a.session.user))||"کاربر محلی";}
function ensureSession(modId){var a=getAuth(modId);if(a.session&&a.session.user)return;a.session={user:"admin",name:"مدیر"};saveAuth(modId,a);}
var Validators={required:function(v){return String(v||"").trim()?null:"الزامی";},number:function(v){if(!String(v||"").trim())return null;if(!/^-?\d+(\.\d+)?$/.test(toEn(String(v)).trim()))return "فقط عدد";return null;},date:function(v){if(!String(v||"").trim())return null;if(!/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(toEn(String(v)).trim()))return "تاریخ نامعتبر";return null;}};
function clearFieldError(el){el.classList.remove("err");var e=el.parentNode&&el.parentNode.querySelector(".field-error");if(e)e.textContent="";}
function bindFieldValidation(root){(root||document).querySelectorAll("[data-validate]").forEach(function(el){var types=(el.getAttribute("data-validate")||"").split(/\s+/).filter(Boolean);function run(){var val=el.value;if(!String(val||"").trim()&&types.indexOf("required")<0){clearFieldError(el);return true;}var msg=null;for(var i=0;i<types.length;i++){if(types[i]==="required"&&!String(val||"").trim())msg="الزامی";else if(Validators[types[i]])msg=Validators[types[i]](val);if(msg)break;}if(msg){el.classList.add("err");var err=el.parentNode.querySelector(".field-error");if(!err){err=document.createElement("div");err.className="field-error";el.parentNode.appendChild(err);}err.textContent=msg;return false;}clearFieldError(el);return true;}el.addEventListener("input",run);el.addEventListener("blur",run);el._validate=run;});}
function validateForm(root){var ok=true;(root||document).querySelectorAll("[data-validate]").forEach(function(el){if(el._validate&&!el._validate())ok=false;});return ok;}
var recog=null,micActive=false,micBtn=null;
function insertText(t){if(!t)return;var a=document.activeElement;if(a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA")){var s=a.selectionStart||a.value.length,e=a.selectionEnd||s;a.value=a.value.slice(0,s)+t+a.value.slice(e);a.dispatchEvent(new Event("input",{bubbles:true}));}}
function initVoice(btn){micBtn=btn;var SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR||!btn)return;recog=new SR();recog.lang="fa-IR";recog.continuous=true;recog.interimResults=true;
recog.onresult=function(ev){var f="";for(var i=ev.resultIndex;i<ev.results.length;i++)if(ev.results[i].isFinal)f+=ev.results[i][0].transcript;if(f)insertText(f);};
recog.onend=function(){if(micActive)setTimeout(function(){try{if(micActive)recog.start();}catch(e){}},100);};
btn.onclick=function(){if(micActive){micActive=false;try{recog.stop();}catch(e){}btn.classList.remove("on");btn.classList.add("off");}else{micActive=true;try{recog.start();}catch(e){}btn.classList.add("on");btn.classList.remove("off");}};
btn.classList.add("off");}
function showPanel(id){document.querySelectorAll(".panel").forEach(function(p){p.classList.remove("on");});var el=document.getElementById(id);if(el)el.classList.add("on");document.querySelectorAll(".tabs button").forEach(function(b){b.classList.toggle("on",b.getAttribute("data-panel")===id);});}
function attachJalaliPicker(input){if(!input||input._j)return;input._j=true;var wrap=input.parentNode;var pop=null,vy,vm;
function close(){if(pop){pop.remove();pop=null;}document.removeEventListener("click",out);}
function out(e){if(pop&&!pop.contains(e.target)&&e.target!==input)close();}
function open(){close();var n=new Date(),j=g2j(n.getFullYear(),n.getMonth()+1,n.getDate());var m=toEn(input.value||"").match(/^(\d{4})[\/\-](\d{1,2})/);vy=m?+m[1]:j.jy;vm=m?+m[2]:j.jm;pop=document.createElement("div");pop.className="jcal-pop";(input.closest(".date-wrap")||wrap).appendChild(pop);render();setTimeout(function(){document.addEventListener("click",out);},0);}
function render(){if(!pop)return;pop.innerHTML="";var head=document.createElement("div");head.className="jcal-head";head.innerHTML='<button type="button" data-a="py">«</button><button type="button" data-a="pm">‹</button><span>'+JM[vm-1]+' '+toFa(vy)+'</span><button type="button" data-a="nm">›</button><button type="button" data-a="ny">»</button>';var week=document.createElement("div");week.className="jcal-week";JW.forEach(function(w){var s=document.createElement("span");s.textContent=w;week.appendChild(s);});var days=document.createElement("div");days.className="jcal-days";var dim=jMonthLength(vy,vm);var fg=j2g(vy,vm,1);var start=(new Date(fg.gy,fg.gm-1,fg.gd).getDay()+1)%7;for(var i=0;i<start;i++)days.appendChild(document.createElement("button"));for(var d=1;d<=dim;d++){(function(day){var g=j2g(vy,vm,day);var b=document.createElement("button");b.type="button";b.innerHTML='<span class="jd">'+toFa(day)+'</span><span class="gd">'+g.gy+"/"+g.gm+"/"+g.gd+'</span>';b.onclick=function(ev){ev.stopPropagation();input.value=toFa(vy)+"/"+toFa(String(vm).padStart(2,"0"))+"/"+toFa(String(day).padStart(2,"0"));input.dispatchEvent(new Event("input",{bubbles:true}));close();};days.appendChild(b);})(d);}pop.appendChild(head);pop.appendChild(week);pop.appendChild(days);head.querySelectorAll("button").forEach(function(b){b.onclick=function(ev){ev.stopPropagation();var a=b.getAttribute("data-a");if(a==="pm"){vm--;if(vm<1){vm=12;vy--;}}if(a==="nm"){vm++;if(vm>12){vm=1;vy++;}}if(a==="py")vy--;if(a==="ny")vy++;render();};});}
if(!input.closest(".date-wrap")){var dw=document.createElement("div");dw.className="date-wrap";input.parentNode.insertBefore(dw,input);dw.appendChild(input);}
input.addEventListener("focus",open);input.addEventListener("click",open);}
function loadJSON(k,d){try{return JSON.parse(localStorage.getItem(k)||"null")||d;}catch(e){return d;}}
function saveJSON(k,v){localStorage.setItem(k,JSON.stringify(v));}
function playBeep(){try{var c=new(window.AudioContext||window.webkitAudioContext)();var o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=660;g.gain.value=0.07;o.start();setTimeout(function(){o.stop();c.close();},180);}catch(e){}}
function updateAlerts(modId){var notes=loadJSON("smart_mod_notes_"+modId,[]);var rems=loadJSON("smart_mod_rem_"+modId,[]);var cart=loadJSON("smart_cartable_v1",{items:[]});var u=getActiveUser(modId);var unread=(cart.items||[]).filter(function(x){return !x.read&&(x.to===u||x.to==="*");}).length;var nb=document.getElementById("alertNotes"),rb=document.getElementById("alertRems"),cb=document.getElementById("alertCart");
if(nb){nb.querySelector(".b").textContent=notes.length;}
if(rb){rb.querySelector(".b").textContent=rems.length;if(rems.length){rb.classList.add("blink");}else rb.classList.remove("blink");}
if(cb){cb.querySelector(".b").textContent=unread;if(unread){cb.classList.add("blink");playBeep();}else cb.classList.remove("blink");}}
function openCodePicker(input,codes){var m=document.createElement("div");m.className="modal open";m.innerHTML='<div class="box"><h3 style="margin-bottom:8px">انتخاب کد</h3><input id="cs" placeholder="جستجو" style="margin-bottom:8px"><div id="cl"></div><button type="button" class="btn btn-g" id="cc">بستن</button></div>';document.body.appendChild(m);
function ren(q){q=(q||"").toLowerCase();var list=(codes||[]).filter(function(c){return !q||(c.code+" "+c.title).toLowerCase().indexOf(q)>=0;});document.getElementById("cl").innerHTML=list.map(function(c){return "<div style=\\"padding:8px;border-bottom:1px solid #334155;cursor:pointer\\" data-c=\\""+c.code+"\\">"+c.code+" — "+c.title+"</div>";}).join("")||"<p class=\\"empty\\">—</p>";
document.getElementById("cl").querySelectorAll("[data-c]").forEach(function(el){el.onclick=function(){input.value=el.getAttribute("data-c");m.remove();};});}
document.getElementById("cs").oninput=function(){ren(this.value);};document.getElementById("cc").onclick=function(){m.remove();};ren("");}
function pushToAccQueue(source,payload,uniqueId){var q=loadJSON("smart_acc_queue_v1",{items:[]});if(uniqueId&&q.items.some(function(x){return x.uniqueId===uniqueId&&!x.posted;}))return false;q.items.push({id:Date.now().toString(36),source:source,uniqueId:uniqueId,payload:payload,at:new Date().toISOString(),posted:false});saveJSON("smart_acc_queue_v1",q);return true;}
function bootShell(opts){opts=opts||{};var modId=opts.modId||"mod";ensureSession(modId);startClock();
var u=document.getElementById("activeUser");if(u)u.textContent=getActiveUser(modId);
var fy=document.getElementById("fiscalYear");if(fy)fy.textContent="سال مالی "+toFa(getFiscalYear());
bindFieldValidation(document);document.querySelectorAll("input.jdate,[data-jdate]").forEach(attachJalaliPicker);initVoice(document.getElementById("btnMic"));
document.querySelectorAll("[data-panel]").forEach(function(b){b.addEventListener("click",function(e){e.preventDefault();var id=b.getAttribute("data-panel");if(id)showPanel(id);});});
document.querySelectorAll("[data-code-picker]").forEach(function(inp){if(inp.parentNode.classList.contains("code-wrap"))return;var w=document.createElement("div");w.className="code-wrap";inp.parentNode.insertBefore(w,inp);w.appendChild(inp);var btn=document.createElement("button");btn.type="button";btn.className="code-btn";btn.textContent="📋";btn.onclick=function(){openCodePicker(inp,opts.codes||[]);};w.appendChild(btn);});
updateAlerts(modId);setInterval(function(){updateAlerts(modId);},20000);
if(document.getElementById("alertNotes"))document.getElementById("alertNotes").onclick=function(){showPanel("p-notes");};
if(document.getElementById("alertRems"))document.getElementById("alertRems").onclick=function(){showPanel("p-rems");};
if(document.getElementById("alertCart"))document.getElementById("alertCart").onclick=function(){showPanel("p-cartable");};
var ex=document.getElementById("btnExit");if(ex)ex.onclick=function(){try{if(opts.onSave)opts.onSave();}catch(e){}location.href=opts.suiteUrl||"index.html";};
}
g.ModuleKit={toFa:toFa,toEn:toEn,bootShell:bootShell,validateForm:validateForm,showPanel:showPanel,getFiscalYear:getFiscalYear,setFiscalYear:setFiscalYear,getActiveUser:getActiveUser,getAuth:getAuth,saveAuth:saveAuth,loadJSON:loadJSON,saveJSON:saveJSON,pushToAccQueue:pushToAccQueue,updateAlerts:updateAlerts,openCodePicker:openCodePicker};
})(window);
