/* module-kit.js — پوسته مشترک همه ماژول‌ها */
(function(global){
"use strict";

var FA=["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
function toFa(n){return String(n).replace(/\d/g,function(d){return FA[+d];});}
function toEn(s){
  return String(s)
    .replace(/[۰-۹]/g,function(d){return "۰۱۲۳۴۵۶۷۸۹".indexOf(d);})
    .replace(/[٠-٩]/g,function(d){return "٠١٢٣٤٥٦٧٨٩".indexOf(d);});
}

function g2j(gy,gm,gd){
  var g_d_m=[0,31,59,90,120,151,181,212,243,273,304,334];
  var gy2=(gm>2)?(gy+1):gy;
  var days=355666+365*gy+Math.floor((gy2+3)/4)-Math.floor((gy2+99)/100)+Math.floor((gy2+399)/400)+gd+g_d_m[gm-1];
  var jy=-1595+33*Math.floor(days/12053);days%=12053;
  jy+=4*Math.floor(days/1461);days%=1461;
  if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365;}
  var jm=(days<186)?1+Math.floor(days/31):7+Math.floor((days-186)/30);
  var jd=1+((days<186)?(days%31):((days-186)%30));
  return {jy:jy,jm:jm,jd:jd};
}
function j2g(jy,jm,jd){
  var jy2=jy-979,jm2=jm-1,jd2=jd-1;
  var days=365*jy2+Math.floor(jy2/33)*8+Math.floor(((jy2%33)+3)/4);
  for(var i=0;i<jm2;++i) days+=(i<6?31:30);
  days+=jd2;
  var gy=1600+400*Math.floor(days/146097);days%=146097;
  var leap=true;
  if(days>=36525){days--;gy+=100*Math.floor(days/36524);days%=36524;if(days>=365)leap=false;else days++;}
  gy+=4*Math.floor(days/1461);days%=1461;
  if(days>=366){leap=false;days--;gy+=Math.floor(days/365);days=days%365;}
  var gd=days+1, sal_a=[0,31,(leap?29:28),31,30,31,30,31,31,30,31,30,31],gm;
  for(gm=1;gm<=12&&gd>sal_a[gm];gm++) gd-=sal_a[gm];
  return {gy:gy,gm:gm,gd:gd};
}
function jMonthLength(jy,jm){
  if(jm<=6)return 31;
  if(jm<=11)return 30;
  var a=j2g(jy,12,30); var b=g2j(a.gy,a.gm,a.gd);
  return (b.jy===jy&&b.jm===12&&b.jd===30)?30:29;
}

var JM=["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
/* روزهای هفته کامل */
var JW_FULL=["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"];
var JW_SHORT=["ش","ی","د","س","چ","پ","ج"];

function startClock(elJ, elG, elC){
  function tick(){
    var n=new Date();
    var j=g2j(n.getFullYear(),n.getMonth()+1,n.getDate());
    if(elJ) elJ.textContent=toFa(j.jy)+"/"+toFa(String(j.jm).padStart(2,"0"))+"/"+toFa(String(j.jd).padStart(2,"0"));
    if(elG) elG.textContent=n.getFullYear()+"/"+String(n.getMonth()+1).padStart(2,"0")+"/"+String(n.getDate()).padStart(2,"0");
    if(elC) elC.textContent=toFa(String(n.getHours()).padStart(2,"0"))+":"+toFa(String(n.getMinutes()).padStart(2,"0"))+":"+toFa(String(n.getSeconds()).padStart(2,"0"));
  }
  tick(); setInterval(tick,1000);
}

function getActiveUser(){
  try{
    var a=JSON.parse(localStorage.getItem("smart_auth_v1")||"null");
    if(a&&a.session&&a.session.user) return a.session.user;
    if(a&&a.creds&&a.creds.admin&&a.creds.admin.user) return a.creds.admin.user;
  }catch(e){}
  try{
    var s=JSON.parse(sessionStorage.getItem("smart_user_session")||"null");
    if(s&&s.user) return s.user;
  }catch(e){}
  return "کاربر محلی";
}

var Validators={
  required:function(v){return String(v||"").trim()?null:"این فیلد الزامی است";},
  number:function(v){if(v===""||v==null)return null; if(!/^-?\d+(\.\d+)?$/.test(toEn(String(v)).trim())) return "فقط عدد وارد کنید"; return null;},
  integer:function(v){if(v===""||v==null)return null; if(!/^-?\d+$/.test(toEn(String(v)).trim())) return "فقط عدد صحیح"; return null;},
  date:function(v){if(v===""||v==null)return null; if(!/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(toEn(String(v)).trim())) return "تاریخ نامعتبر (مثال: ۱۴۰۴/۰۷/۰۱)"; return null;},
  time:function(v){if(v===""||v==null)return null; if(!/^\d{1,2}:\d{2}(:\d{2})?$/.test(toEn(String(v)).trim())) return "ساعت نامعتبر (مثال: ۱۴:۳۰)"; return null;},
  code:function(v){if(v===""||v==null)return null; if(!/^[A-Za-z0-9._-]{1,20}$/.test(String(v).trim())) return "کد فقط حروف/عدد و ._-"; return null;},
  phone:function(v){if(v===""||v==null)return null; var t=toEn(String(v)).replace(/\s/g,""); if(!/^0?\d{10,11}$/.test(t)&&!/^\+?\d{10,15}$/.test(t)) return "شماره تماس نامعتبر"; return null;}
};

function bindFieldValidation(root){
  (root||document).querySelectorAll("[data-validate]").forEach(function(el){
    var types=(el.getAttribute("data-validate")||"").split(/\s+/);
    function run(){
      var msg=null;
      for(var i=0;i<types.length;i++){
        var fn=Validators[types[i]];
        if(fn){ msg=fn(el.value); if(msg) break; }
      }
      el.classList.toggle("err", !!msg);
      var err=el.parentNode.querySelector(".field-error");
      if(!err){ err=document.createElement("div"); err.className="field-error"; el.parentNode.appendChild(err); }
      err.textContent=msg||"";
      return !msg;
    }
    el.addEventListener("blur", run);
    el.addEventListener("input", function(){ if(el.classList.contains("err")) run(); });
    el._validate=run;
  });
}
function validateForm(root){
  var ok=true;
  (root||document).querySelectorAll("[data-validate]").forEach(function(el){
    if(el._validate && !el._validate()) ok=false;
  });
  return ok;
}
function enableSpellcheck(root){
  (root||document).querySelectorAll("input[type=text], textarea").forEach(function(el){
    el.setAttribute("spellcheck","true");
    el.setAttribute("lang","fa");
  });
}

var recog=null, micActive=false, micBtn=null;
function initVoice(btn){
  micBtn=btn;
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ if(btn){ btn.title="پشتیبانی نمی‌شود"; btn.classList.add("mic-off"); } return; }
  recog=new SR();
  recog.lang="fa-IR";
  recog.continuous=true;
  recog.interimResults=false;
  recog.onresult=function(ev){
    var t="";
    for(var i=ev.resultIndex;i<ev.results.length;i++) if(ev.results[i].isFinal) t+=ev.results[i][0].transcript;
    if(t){
      var a=document.activeElement;
      if(a && (a.tagName==="INPUT"||a.tagName==="TEXTAREA") && a.type!=="password"){
        var s=a.selectionStart||a.value.length;
        a.value=a.value.slice(0,s)+t+a.value.slice(a.selectionEnd||s);
        a.dispatchEvent(new Event("input",{bubbles:true}));
      }
    }
  };
  recog.onerror=function(){ stopMic(); };
  recog.onend=function(){ if(micActive){ try{recog.start();}catch(e){} } };
  if(btn){
    btn.classList.add("mic-off");
    btn.onclick=function(){ if(micActive) stopMic(); else startMic(); };
  }
}
function startMic(){
  if(!recog) return;
  try{ recog.start(); micActive=true; if(micBtn){ micBtn.classList.remove("mic-off"); micBtn.classList.add("mic-on"); micBtn.title="میکروفون فعال"; } }catch(e){}
}
function stopMic(){
  micActive=false;
  try{ if(recog) recog.stop(); }catch(e){}
  if(micBtn){ micBtn.classList.remove("mic-on"); micBtn.classList.add("mic-off"); micBtn.title="میکروفون خاموش"; }
}

function attachJalaliPicker(input){
  if(!input || input._jcal) return;
  input._jcal=true;
  var dv=input.getAttribute("data-validate")||"";
  if(dv.indexOf("date")<0) input.setAttribute("data-validate", (dv+" date").trim());
  input.setAttribute("autocomplete","off");
  input.setAttribute("inputmode","numeric");
  var wrap=input.closest(".date-wrap")||input.parentNode;
  if(!wrap.classList.contains("date-wrap")){
    var w=document.createElement("div"); w.className="date-wrap";
    input.parentNode.insertBefore(w, input); w.appendChild(input); wrap=w;
  }
  var pop=null, viewY, viewM;
  function close(){ if(pop){ pop.remove(); pop=null; } document.removeEventListener("click", outside); }
  function outside(e){ if(pop && !pop.contains(e.target) && e.target!==input) close(); }
  function open(){
    close();
    var now=new Date();
    var j=g2j(now.getFullYear(), now.getMonth()+1, now.getDate());
    var cur=toEn(input.value||"");
    var m=cur.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    viewY=m?+m[1]:j.jy; viewM=m?+m[2]:j.jm;
    pop=document.createElement("div"); pop.className="jcal-pop"; wrap.appendChild(pop);
    render();
    setTimeout(function(){ document.addEventListener("click", outside); }, 0);
  }
  function render(){
    if(!pop) return;
    var head=document.createElement("div"); head.className="jcal-head";
    head.innerHTML=
      '<button type="button" data-a="py" title="سال قبل">«</button>'+
      '<button type="button" data-a="pm" title="ماه قبل">‹</button>'+
      '<span class="title">'+JM[viewM-1]+' '+toFa(viewY)+'</span>'+
      '<button type="button" data-a="nm" title="ماه بعد">›</button>'+
      '<button type="button" data-a="ny" title="سال بعد">»</button>';
    var week=document.createElement("div"); week.className="jcal-week";
    JW_FULL.forEach(function(w){ var s=document.createElement("span"); s.textContent=w; week.appendChild(s); });
    var days=document.createElement("div"); days.className="jcal-days";
    var dim=jMonthLength(viewY, viewM);
    var firstG=j2g(viewY, viewM, 1);
    var first=new Date(firstG.gy, firstG.gm-1, firstG.gd);
    var start=(first.getDay()+1)%7;
    for(var i=0;i<start;i++){ var b0=document.createElement("button"); b0.type="button"; b0.className="out"; b0.disabled=true; days.appendChild(b0); }
    for(var d=1;d<=dim;d++){
      (function(day){
        var g=j2g(viewY, viewM, day);
        var gFull=g.gy+"/"+String(g.gm).padStart(2,"0")+"/"+String(g.gd).padStart(2,"0");
        var btn=document.createElement("button"); btn.type="button";
        btn.innerHTML='<span class="jd">'+toFa(day)+'</span><span class="gd">'+gFull+'</span>';
        btn.onclick=function(ev){
          ev.stopPropagation();
          input.value=toFa(viewY)+"/"+toFa(String(viewM).padStart(2,"0"))+"/"+toFa(String(day).padStart(2,"0"));
          input.dispatchEvent(new Event("input",{bubbles:true}));
          input.dispatchEvent(new Event("change",{bubbles:true}));
          if(input._validate) input._validate();
          close();
        };
        days.appendChild(btn);
      })(d);
    }
    pop.innerHTML=""; pop.appendChild(head); pop.appendChild(week); pop.appendChild(days);
    head.querySelectorAll("button").forEach(function(b){
      b.onclick=function(ev){
        ev.stopPropagation();
        var a=b.getAttribute("data-a");
        if(a==="pm"){ viewM--; if(viewM<1){ viewM=12; viewY--; } }
        if(a==="nm"){ viewM++; if(viewM>12){ viewM=1; viewY++; } }
        if(a==="py") viewY--;
        if(a==="ny") viewY++;
        render();
      };
    });
  }
  input.addEventListener("focus", open);
  input.addEventListener("click", open);
}
function attachAllDatePickers(root){
  (root||document).querySelectorAll("input[data-jdate], input.jdate").forEach(attachJalaliPicker);
}

function showPanel(id){
  document.querySelectorAll(".panel").forEach(function(p){ p.classList.remove("on"); });
  var el=document.getElementById(id);
  if(el) el.classList.add("on");
  document.querySelectorAll(".tree .leaf").forEach(function(b){
    b.classList.toggle("on", b.getAttribute("data-panel")===id);
  });
}

function saveAndExit(saveFn, suiteUrl){
  try{ if(typeof saveFn==="function") saveFn(); }catch(e){}
  try{ localStorage.setItem("smart_last_exit", new Date().toISOString()); }catch(e){}
  location.href=suiteUrl||"suite.html";
}

/** راه‌اندازی کامل پوسته مشترک */
function bootShell(opts){
  opts=opts||{};
  var elJ=document.getElementById(opts.elJ||"dtJ");
  var elG=document.getElementById(opts.elG||"dtG");
  var elC=document.getElementById(opts.elC||"dtC");
  var elU=document.getElementById(opts.elU||"activeUser");
  var elMic=document.getElementById(opts.elMic||"btnMic");
  var elExit=document.getElementById(opts.elExit||"btnExit");
  startClock(elJ, elG, elC);
  if(elU) elU.textContent=getActiveUser();
  enableSpellcheck(document);
  bindFieldValidation(document);
  attachAllDatePickers(document);
  if(elMic) initVoice(elMic);
  document.querySelectorAll("[data-panel]").forEach(function(b){
    b.addEventListener("click", function(e){
      e.preventDefault();
      showPanel(b.getAttribute("data-panel"));
    });
  });
  var sideBtn=document.getElementById("btnToggleSide");
  if(sideBtn) sideBtn.onclick=function(){ var s=document.getElementById("sidePanel"); if(s) s.classList.toggle("open"); };
  if(elExit){
    elExit.onclick=function(){
      saveAndExit(opts.onSave, opts.suiteUrl||"suite.html");
    };
  }
  window.addEventListener("beforeunload", function(){
    try{ if(typeof opts.onSave==="function") opts.onSave(); }catch(e){}
  });
}

global.ModuleKit={
  toFa:toFa, toEn:toEn, g2j:g2j, j2g:j2g,
  startClock:startClock, getActiveUser:getActiveUser,
  bindFieldValidation:bindFieldValidation, validateForm:validateForm,
  enableSpellcheck:enableSpellcheck,
  initVoice:initVoice, startMic:startMic, stopMic:stopMic,
  attachJalaliPicker:attachJalaliPicker, attachAllDatePickers:attachAllDatePickers,
  showPanel:showPanel, saveAndExit:saveAndExit, bootShell:bootShell,
  Validators:Validators, JW_FULL:JW_FULL
};
})(window);
