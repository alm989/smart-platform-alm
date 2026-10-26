/* module-kit.js — تقویم شمسی، ناوبری، منوی راست */
(function(global){
var FA=["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
var JM=["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
var JW=["ش","ی","د","س","چ","پ","ج"];
function toFa(n){return String(n).replace(/\d/g,function(d){return FA[+d];});}
function toEn(s){return String(s).replace(/[۰-۹]/g,function(d){return "۰۱۲۳۴۵۶۷۸۹".indexOf(d);});}
function g2j(gy,gm,gd){var g_d_m=[0,31,59,90,120,151,181,212,243,273,304,334];var gy2=(gm>2)?(gy+1):gy;var days=355666+365*gy+Math.floor((gy2+3)/4)-Math.floor((gy2+99)/100)+Math.floor((gy2+399)/400)+gd+g_d_m[gm-1];var jy=-1595+33*Math.floor(days/12053);days%=12053;jy+=4*Math.floor(days/1461);days%=1461;if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365;}var jm=(days<186)?1+Math.floor(days/31):7+Math.floor((days-186)/30);var jd=1+((days<186)?(days%31):((days-186)%30));return{jy:jy,jm:jm,jd:jd};}
function j2g(jy,jm,jd){var jy2=jy-979,jm2=jm-1,jd2=jd-1;var days=365*jy2+Math.floor(jy2/33)*8+Math.floor(((jy2%33)+3)/4);for(var i=0;i<jm2;++i)days+=(i<6?31:30);days+=jd2;var gy=1600+400*Math.floor(days/146097);days%=146097;var leap=true;if(days>=36525){days--;gy+=100*Math.floor(days/36524);days%=36524;if(days>=365)leap=false;else days++;}gy+=4*Math.floor(days/1461);days%=1461;if(days>=366){leap=false;days--;gy+=Math.floor(days/365);days=days%365;}var gd=days+1,sal_a=[0,31,(leap?29:28),31,30,31,30,31,31,30,31,30,31],gm;for(gm=1;gm<=12&&gd>sal_a[gm];gm++)gd-=sal_a[gm];return{gy:gy,gm:gm,gd:gd};}
function jML(jy,jm){if(jm<=6)return 31;if(jm<=11)return 30;var a=j2g(jy,12,30);var b=g2j(a.gy,a.gm,a.gd);return(b.jy===jy&&b.jm===12&&b.jd===30)?30:29;}
function fmtJ(jy,jm,jd){return toFa(jy)+"/"+toFa(String(jm).padStart(2,"0"))+"/"+toFa(String(jd).padStart(2,"0"));}

function tickClock(){
  var jEl=document.getElementById("dtJ"),gEl=document.getElementById("dtG"),cEl=document.getElementById("dtC");
  if(!jEl)return;
  var n=new Date(),j=g2j(n.getFullYear(),n.getMonth()+1,n.getDate());
  jEl.textContent=fmtJ(j.jy,j.jm,j.jd);
  if(gEl)gEl.textContent=n.getFullYear()+"/"+String(n.getMonth()+1).padStart(2,"0")+"/"+String(n.getDate()).padStart(2,"0");
  if(cEl)cEl.textContent=toFa(String(n.getHours()).padStart(2,"0"))+":"+toFa(String(n.getMinutes()).padStart(2,"0"))+":"+toFa(String(n.getSeconds()).padStart(2,"0"));
}

function showPanel(id){
  if(!id)return;var el=document.getElementById(id);if(!el)return;
  document.querySelectorAll(".panel").forEach(function(p){p.classList.remove("on");});
  el.classList.add("on");
  document.querySelectorAll(".side .sub button[data-panel]").forEach(function(b){
    b.classList.toggle("on",b.getAttribute("data-panel")===id);
  });
  if(id==="p-cal"&&typeof global.renderFullCal==="function")global.renderFullCal();
  if(typeof global.onPanelShow==="function")global.onPanelShow(id);
}

function attachJDate(input){
  if(!input||input._j)return;input._j=true;
  var wrap=input.parentNode;
  if(!wrap.classList.contains("date-wrap")){
    var d=document.createElement("div");d.className="date-wrap";
    wrap.insertBefore(d,input);d.appendChild(input);wrap=d;
  }
  var pop,vy,vm;
  function close(){if(pop){pop.remove();pop=null;}document.removeEventListener("click",out);}
  function out(e){if(pop&&!pop.contains(e.target)&&e.target!==input)close();}
  function open(){
    close();var n=new Date(),j=g2j(n.getFullYear(),n.getMonth()+1,n.getDate());
    var m=toEn(input.value||"").match(/^(\d{4})[\/\-](\d{1,2})/);
    vy=m?+m[1]:j.jy;vm=m?+m[2]:j.jm;
    pop=document.createElement("div");pop.className="jcal";wrap.appendChild(pop);render();
    setTimeout(function(){document.addEventListener("click",out);},0);
  }
  function render(){
    if(!pop)return;pop.innerHTML="";
    var h=document.createElement("div");h.className="jcal-h";
    h.innerHTML='<button type="button" data-a="py">«</button><button type="button" data-a="pm">‹</button><span class="ttl">'+JM[vm-1]+' '+toFa(vy)+'</span><button type="button" data-a="nm">›</button><button type="button" data-a="ny">»</button>';
    var w=document.createElement("div");w.className="jcal-w";
    JW.forEach(function(x){var s=document.createElement("span");s.textContent=x;w.appendChild(s);});
    var days=document.createElement("div");days.className="jcal-d";
    var dim=jML(vy,vm),fg=j2g(vy,vm,1),st=(new Date(fg.gy,fg.gm-1,fg.gd).getDay()+1)%7;
    for(var i=0;i<st;i++){var em=document.createElement("button");em.type="button";em.disabled=true;em.style.visibility="hidden";days.appendChild(em);}
    for(var d=1;d<=dim;d++){(function(day){
      var g=j2g(vy,vm,day);var b=document.createElement("button");b.type="button";
      b.innerHTML='<span class="jd">'+toFa(day)+'</span><span class="gd">'+g.gy+'/'+String(g.gm).padStart(2,"0")+'/'+String(g.gd).padStart(2,"0")+'</span>';
      b.onclick=function(ev){ev.stopPropagation();input.value=fmtJ(vy,vm,day);close();
        input.dispatchEvent(new Event("change",{bubbles:true}));
        if(typeof global.onJDatePick==="function")global.onJDatePick(input,fmtJ(vy,vm,day));
      };
      days.appendChild(b);
    })(d);}
    pop.appendChild(h);pop.appendChild(w);pop.appendChild(days);
    h.querySelectorAll("button").forEach(function(b){b.onclick=function(ev){ev.stopPropagation();
      var a=b.getAttribute("data-a");
      if(a==="pm"){vm--;if(vm<1){vm=12;vy--;}}if(a==="nm"){vm++;if(vm>12){vm=1;vy++;}}
      if(a==="py")vy--;if(a==="ny")vy++;render();
    };});
  }
  input.addEventListener("click",open);input.addEventListener("focus",open);
}

function renderFullCal(boxId,onPick){
  var box=document.getElementById(boxId||"fullCal");if(!box)return;
  var n=new Date(),j=g2j(n.getFullYear(),n.getMonth()+1,n.getDate());
  var vy=box._y||j.jy,vm=box._m||j.jm;box._y=vy;box._m=vm;
  var html='<div class="jcal" style="position:static;width:100%;max-width:340px"><div class="jcal-h">'+
    '<button type="button" id="fcPy">«</button><button type="button" id="fcPm">‹</button>'+
    '<span class="ttl">'+JM[vm-1]+' '+toFa(vy)+'</span>'+
    '<button type="button" id="fcNm">›</button><button type="button" id="fcNy">»</button></div><div class="jcal-w">';
  JW.forEach(function(x){html+='<span>'+x+'</span>';});html+='</div><div class="jcal-d">';
  var dim=jML(vy,vm),fg=j2g(vy,vm,1),st=(new Date(fg.gy,fg.gm-1,fg.gd).getDay()+1)%7;
  for(var i=0;i<st;i++)html+='<button type="button" style="visibility:hidden"></button>';
  for(var d=1;d<=dim;d++){var g=j2g(vy,vm,d);
    html+='<button type="button" data-d="'+d+'"><span class="jd">'+toFa(d)+'</span><span class="gd">'+g.gy+'/'+g.gm+'/'+g.gd+'</span></button>';}
  html+='</div></div>';box.innerHTML=html;
  document.getElementById("fcPm").onclick=function(){box._m--;if(box._m<1){box._m=12;box._y--;}renderFullCal(boxId,onPick);};
  document.getElementById("fcNm").onclick=function(){box._m++;if(box._m>12){box._m=1;box._y++;}renderFullCal(boxId,onPick);};
  document.getElementById("fcPy").onclick=function(){box._y--;renderFullCal(boxId,onPick);};
  document.getElementById("fcNy").onclick=function(){box._y++;renderFullCal(boxId,onPick);};
  box.querySelectorAll("[data-d]").forEach(function(b){b.onclick=function(){
    var val=fmtJ(box._y,box._m,+b.getAttribute("data-d"));
    if(onPick)onPick(val);else if(typeof global.onCalDayClick==="function")global.onCalDayClick(val);
  };});
}

function initModuleKit(opts){
  opts=opts||{};
  tickClock();setInterval(tickClock,1000);
  document.addEventListener("click",function(e){
    var t=e.target.closest("[data-panel]");
    if(t&&t.getAttribute("data-panel")){e.preventDefault();showPanel(t.getAttribute("data-panel"));}
  });
  document.querySelectorAll(".jdate,[data-jdate]").forEach(attachJDate);
  var exit=document.getElementById("btnExit");
  if(exit)exit.onclick=function(){location.href=opts.suiteUrl||"index.html";};
  /* میکروفون */
  var btn=document.getElementById("btnMic");
  if(btn){
    var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(SR){var rec=new SR(),on=false;rec.lang="fa-IR";rec.continuous=true;rec.interimResults=false;
      rec.onresult=function(ev){for(var i=ev.resultIndex;i<ev.results.length;i++)if(ev.results[i].isFinal){
        var a=document.activeElement;if(a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA")){
          var t=ev.results[i][0].transcript;var s=a.selectionStart||0,e2=a.selectionEnd||0;
          a.value=a.value.slice(0,s)+t+a.value.slice(e2);a.dispatchEvent(new Event("input",{bubbles:true}));
        }}};
      rec.onend=function(){if(on)try{rec.start();}catch(e){};};
      btn.onclick=function(){if(on){on=false;try{rec.stop();}catch(e){}btn.classList.remove("on");}
        else{on=true;try{rec.start();}catch(e){}btn.classList.add("on");}};
    }
  }
  showPanel(opts.defaultPanel||"p-dash");
}

global.ModuleKit={
  toFa:toFa,toEn:toEn,g2j:g2j,j2g:j2g,fmtJ:fmtJ,jML:jML,
  showPanel:showPanel,attachJDate:attachJDate,renderFullCal:renderFullCal,
  init:initModuleKit,tickClock:tickClock
};
global.renderFullCal=function(){renderFullCal("fullCal");};
})(window);
