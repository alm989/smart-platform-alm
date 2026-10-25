(function(g){"use strict";
var FA=["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
function toFa(n){return String(n).replace(/\d/g,function(d){return FA[+d];});}
function toEn(s){return String(s).replace(/[۰-۹]/g,function(d){return "۰۱۲۳۴۵۶۷۸۹".indexOf(d);});}
function g2j(gy,gm,gd){var g_d_m=[0,31,59,90,120,151,181,212,243,273,304,334];var gy2=(gm>2)?(gy+1):gy;var days=355666+365*gy+Math.floor((gy2+3)/4)-Math.floor((gy2+99)/100)+Math.floor((gy2+399)/400)+gd+g_d_m[gm-1];var jy=-1595+33*Math.floor(days/12053);days%=12053;jy+=4*Math.floor(days/1461);days%=1461;if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365;}var jm=(days<186)?1+Math.floor(days/31):7+Math.floor((days-186)/30);var jd=1+((days<186)?(days%31):((days-186)%30));return {jy:jy,jm:jm,jd:jd};}
function j2g(jy,jm,jd){var jy2=jy-979,jm2=jm-1,jd2=jd-1;var days=365*jy2+Math.floor(jy2/33)*8+Math.floor(((jy2%33)+3)/4);for(var i=0;i<jm2;++i)days+=(i<6?31:30);days+=jd2;var gy=1600+400*Math.floor(days/146097);days%=146097;var leap=true;if(days>=36525){days--;gy+=100*Math.floor(days/36524);days%=36524;if(days>=365)leap=false;else days++;}gy+=4*Math.floor(days/1461);days%=1461;if(days>=366){leap=false;days--;gy+=Math.floor(days/365);days=days%365;}var gd=days+1,sal_a=[0,31,(leap?29:28),31,30,31,30,31,31,30,31,30,31],gm;for(gm=1;gm<=12&&gd>sal_a[gm];gm++)gd-=sal_a[gm];return {gy:gy,gm:gm,gd:gd};}
function jMonthLength(jy,jm){if(jm<=6)return 31;if(jm<=11)return 30;var a=j2g(jy,12,30);var b=g2j(a.gy,a.gm,a.gd);return (b.jy===jy&&b.jm===12&&b.jd===30)?30:29;}
var JM=["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
var JW=["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"];
function startClock(){
  function tick(){
    var n=new Date(),j=g2j(n.getFullYear(),n.getMonth()+1,n.getDate());
    var a=document.getElementById("dtJ"),b=document.getElementById("dtG"),c=document.getElementById("dtC");
    if(a){a.textContent=toFa(j.jy)+"/"+toFa(String(j.jm).padStart(2,"0"))+"/"+toFa(String(j.jd).padStart(2,"0"));}
    if(b){b.textContent=n.getFullYear()+"/"+String(n.getMonth()+1).padStart(2,"0")+"/"+String(n.getDate()).padStart(2,"0");}
    if(c){c.textContent=toFa(String(n.getHours()).padStart(2,"0"))+":"+toFa(String(n.getMinutes()).padStart(2,"0"))+":"+toFa(String(n.getSeconds()).padStart(2,"0"));}
  }
  tick();setInterval(tick,1000);
}
function getFiscalYear(){try{var f=JSON.parse(localStorage.getItem("smart_fiscal_v1")||"null");if(f&&f.year)return f.year;}catch(e){}return g2j(new Date().getFullYear(),new Date().getMonth()+1,new Date().getDate()).jy;}
function setFiscalYear(y){localStorage.setItem("smart_fiscal_v1",JSON.stringify({year:y}));}
function getAuth(modId){try{return JSON.parse(localStorage.getItem("smart_users_"+modId)||"null")||{users:[{user:"admin",pass:"admin",name:"مدیر"}],session:{user:"admin",name:"مدیر"}};}catch(e){return {users:[{user:"admin",pass:"admin",name:"مدیر"}],session:{user:"admin",name:"مدیر"}};} }
function saveAuth(modId,d){localStorage.setItem("smart_users_"+modId,JSON.stringify(d));}
function getActiveUser(modId){var a=getAuth(modId);if(!a.session){a.session={user:"admin",name:"مدیر"};saveAuth(modId,a);}return a.session.name||a.session.user||"مدیر";}
function loadJSON(k,d){try{return JSON.parse(localStorage.getItem(k)||"null")||d;}catch(e){return d;}}
function saveJSON(k,v){localStorage.setItem(k,JSON.stringify(v));}
function toast(msg,type){var t=document.getElementById("toast");if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.appendChild(t);}t.textContent=msg;t.className="toast show"+(type==="err"?" err":type==="warn"?" warn":"");clearTimeout(t._tm);t._tm=setTimeout(function(){t.classList.remove("show");},2800);}
function playBeep(){try{var ctx=new(window.AudioContext||window.webkitAudioContext)();var o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=720;g.gain.value=0.06;o.start();setTimeout(function(){o.stop();ctx.close();},220);}catch(e){}}
function showPanel(id){
  if(!id)return;
  document.querySelectorAll(".panel").forEach(function(p){p.classList.remove("on");});
  var el=document.getElementById(id);
  if(el)el.classList.add("on");
  document.querySelectorAll(".tree .leaf").forEach(function(b){b.classList.toggle("on",b.getAttribute("data-panel")===id);});
  document.querySelectorAll(".nav-item > .nav-btn").forEach(function(b){
    var p=b.getAttribute("data-panel");
    b.classList.toggle("on",p===id);
  });
  document.querySelectorAll(".nav-item.open").forEach(function(n){n.classList.remove("open");});
}
function bindNav(){
  document.querySelectorAll("[data-panel]").forEach(function(btn){
    btn.addEventListener("click",function(e){
      e.preventDefault();
      e.stopPropagation();
      var id=btn.getAttribute("data-panel");
      if(id)showPanel(id);
    });
  });
  document.querySelectorAll(".nav-item").forEach(function(item){
    item.addEventListener("mouseenter",function(){item.classList.add("open");});
    item.addEventListener("mouseleave",function(){item.classList.remove("open");});
  });
}
var recog=null,micOn=false;
function initMic(btn){
  if(!btn)return;
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){btn.classList.add("off");return;}
  recog=new SR();recog.lang="fa-IR";recog.continuous=true;recog.interimResults=true;
  recog.onresult=function(ev){var f="";for(var i=ev.resultIndex;i<ev.results.length;i++)if(ev.results[i].isFinal)f+=ev.results[i][0].transcript;
    if(f){var a=document.activeElement;if(a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA")){var s=a.selectionStart||0,e=a.selectionEnd||0;a.value=a.value.slice(0,s)+f+a.value.slice(e);a.dispatchEvent(new Event("input",{bubbles:true}));}}};
  recog.onend=function(){if(micOn)setTimeout(function(){try{if(micOn)recog.start();}catch(e){}},80);};
  btn.classList.add("off");
  btn.onclick=function(){if(micOn){micOn=false;try{recog.stop();}catch(e){}btn.classList.remove("on");btn.classList.add("off");}else{micOn=true;try{recog.start();}catch(e){}btn.classList.add("on");btn.classList.remove("off");}};
}
function attachJDate(input){
  if(!input||input._j)return;input._j=true;
  var wrap=input.parentNode;if(!wrap.classList.contains("date-wrap")){var d=document.createElement("div");d.className="date-wrap";wrap.insertBefore(d,input);d.appendChild(input);wrap=d;}
  var pop,vy,vm;
  function close(){if(pop){pop.remove();pop=null;}document.removeEventListener("click",out);}
  function out(e){if(pop&&!pop.contains(e.target)&&e.target!==input)close();}
  function open(){close();var n=new Date(),j=g2j(n.getFullYear(),n.getMonth()+1,n.getDate());var m=toEn(input.value||"").match(/^(\d{4})[\/\-](\d{1,2})/);vy=m?+m[1]:j.jy;vm=m?+m[2]:j.jm;pop=document.createElement("div");pop.className="jcal-pop";wrap.appendChild(pop);render();setTimeout(function(){document.addEventListener("click",out);},0);}
  function render(){if(!pop)return;pop.innerHTML="";var h=document.createElement("div");h.className="jcal-head";h.innerHTML='<button type="button" data-a="py">«</button><button type="button" data-a="pm">‹</button><span>'+JM[vm-1]+' '+toFa(vy)+'</span><button type="button" data-a="nm">›</button><button type="button" data-a="ny">»</button>';
    var w=document.createElement("div");w.className="jcal-week";JW.forEach(function(x){var s=document.createElement("span");s.textContent=x;w.appendChild(s);});
    var days=document.createElement("div");days.className="jcal-days";var dim=jMonthLength(vy,vm);var fg=j2g(vy,vm,1);var st=(new Date(fg.gy,fg.gm-1,fg.gd).getDay()+1)%7;
    for(var i=0;i<st;i++)days.appendChild(document.createElement("button"));
    for(var d=1;d<=dim;d++){(function(day){var g=j2g(vy,vm,day);var b=document.createElement("button");b.type="button";b.innerHTML='<span class="jd">'+toFa(day)+'</span><span class="gd">'+g.gy+'/'+g.gm+'/'+g.gd+'</span>';
      b.onclick=function(ev){ev.stopPropagation();input.value=toFa(vy)+"/"+toFa(String(vm).padStart(2,"0"))+"/"+toFa(String(day).padStart(2,"0"));input.dispatchEvent(new Event("input",{bubbles:true}));close();};days.appendChild(b);})(d);}
    pop.appendChild(h);pop.appendChild(w);pop.appendChild(days);
    h.querySelectorAll("button").forEach(function(b){b.onclick=function(ev){ev.stopPropagation();var a=b.getAttribute("data-a");if(a==="pm"){vm--;if(vm<1){vm=12;vy--;}}if(a==="nm"){vm++;if(vm>12){vm=1;vy++;}}if(a==="py")vy--;if(a==="ny")vy++;render();};});}
  input.addEventListener("click",open);input.addEventListener("focus",open);
}
function openCodePicker(input,codes){
  var m=document.createElement("div");m.className="modal open";
  m.innerHTML='<div class="box"><h3 style="margin-bottom:8px">انتخاب کد</h3><input id="cs" placeholder="جستجو" style="margin-bottom:8px"><div id="cl"></div><button type="button" class="btn btn-g" id="cx">بستن</button></div>';
  document.body.appendChild(m);
  function ren(q){q=(q||"").toLowerCase();var list=(codes||[]).filter(function(c){return !q||(c.code+" "+(c.title||"")).toLowerCase().indexOf(q)>=0;});
    document.getElementById("cl").innerHTML=list.map(function(c){return '<div style="padding:8px;border-bottom:1px solid #334155;cursor:pointer" data-c="'+c.code+'">'+c.code+' — '+(c.title||"")+'</div>';}).join("")||'<p class="empty">—</p>';
    document.getElementById("cl").querySelectorAll("[data-c]").forEach(function(el){el.onclick=function(){input.value=el.getAttribute("data-c");m.remove();};});}
  document.getElementById("cs").oninput=function(){ren(this.value);};document.getElementById("cx").onclick=function(){m.remove();};ren("");
}
function notesKey(m){return "smart_mod_notes_"+m;}
function remsKey(m){return "smart_mod_rem_"+m;}
function cartKey(){return "smart_cartable_v1";}
function updateAlerts(modId){
  var notes=(loadJSON(notesKey(modId),[])).filter(function(x){return !x.done;});
  var rems=(loadJSON(remsKey(modId),[])).filter(function(x){return !x.done;});
  var user=getActiveUser(modId);
  var cart=(loadJSON(cartKey(),{items:[]}).items||[]).filter(function(x){return !x.done&&(x.to===user||x.to==="*"||x.to===modId);});
  var an=document.getElementById("alertNotes"),ar=document.getElementById("alertRems"),ac=document.getElementById("alertCart");
  if(an)an.querySelector(".n").textContent=String(notes.length);
  if(ar){ar.querySelector(".n").textContent=String(rems.length);ar.classList.toggle("blink",rems.length>0);}
  if(ac){ac.querySelector(".n").textContent=String(cart.length);ac.classList.toggle("blink",cart.length>0);}
  // due reminders today-ish alert once per session flag
  rems.forEach(function(r){if(r.date&&!r._alerted){r._alerted=true;playBeep();toast("یادآوری: "+(r.text||""),"warn");}});
  if(cart.length){var last=cart[0];if(last&&!last._alerted){last._alerted=true;playBeep();toast("فایل/پیام جدید در کارتابل","warn");saveJSON(cartKey(),{items:loadJSON(cartKey(),{items:[]}).items});}}
}
function pushAcc(source,payload,uid){var q=loadJSON("smart_acc_queue_v1",{items:[]});if(uid&&q.items.some(function(x){return x.uniqueId===uid&&!x.posted;}))return false;q.items.push({id:Date.now().toString(36),source:source,uniqueId:uid,payload:payload,posted:false,at:new Date().toISOString()});saveJSON("smart_acc_queue_v1",q);return true;}
function bootShell(opts){
  opts=opts||{};var modId=opts.modId||"mod";
  startClock();
  var u=document.getElementById("activeUser");if(u)u.textContent=getActiveUser(modId);
  var fy=document.getElementById("fiscalYear");if(fy)fy.textContent="سال مالی "+toFa(getFiscalYear());
  bindNav();
  initMic(document.getElementById("btnMic"));
  document.querySelectorAll("input.jdate,[data-jdate]").forEach(attachJDate);
  document.querySelectorAll("[data-code-picker]").forEach(function(inp){
    if(inp.closest(".code-wrap"))return;
    var w=document.createElement("div");w.className="code-wrap";inp.parentNode.insertBefore(w,inp);w.appendChild(inp);
    var b=document.createElement("button");b.type="button";b.className="code-btn";b.textContent="📋";
    b.onclick=function(){openCodePicker(inp,opts.codes||[]);};w.appendChild(b);
  });
  var sideBtn=document.getElementById("btnSide");if(sideBtn)sideBtn.onclick=function(){var s=document.getElementById("side");if(s)s.classList.toggle("open");};
  var ex=document.getElementById("btnExit");if(ex)ex.onclick=function(){try{if(opts.onSave)opts.onSave();}catch(e){}location.href=opts.suiteUrl||"index.html";};
  if(document.getElementById("alertNotes"))document.getElementById("alertNotes").onclick=function(){showPanel("p-notes");};
  if(document.getElementById("alertRems"))document.getElementById("alertRems").onclick=function(){showPanel("p-rems");};
  if(document.getElementById("alertCart"))document.getElementById("alertCart").onclick=function(){showPanel("p-cartable");};
  updateAlerts(modId);
  setInterval(function(){updateAlerts(modId);},15000);
  showPanel("p-dash");
}
g.ModuleKit={toFa:toFa,toEn:toEn,bootShell:bootShell,showPanel:showPanel,getActiveUser:getActiveUser,getAuth:getAuth,saveAuth:saveAuth,getFiscalYear:getFiscalYear,setFiscalYear:setFiscalYear,loadJSON:loadJSON,saveJSON:saveJSON,toast:toast,updateAlerts:updateAlerts,notesKey:notesKey,remsKey:remsKey,cartKey:cartKey,pushAcc:pushAcc,playBeep:playBeep};
})(window);
