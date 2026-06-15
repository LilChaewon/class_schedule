/* ===== 시간표 마법사 — 데이터 가공 · 색상 · 조합 엔진 ===== */
(function(){
  const DAYS = ['월','화','수','목','금','토','일'];

  // ----- cool tones for 전공, warm tones for 교양 (oklch hue families) -----
  // 쿨톤: 청록→하늘→파랑→남색→보라  / 웜톤: 빨강→주황→호박→골드→노랑
  const COOL = [196, 210, 224, 238, 252, 266, 280, 294];
  const WARM = [18, 32, 46, 62, 78, 94];

  function blockColor(hue){
    return {
      fill: `oklch(0.945 0.045 ${hue})`,
      bd:   `oklch(0.74 0.105 ${hue})`,
      tx:   `oklch(0.46 0.115 ${hue})`,
      dot:  `oklch(0.62 0.14 ${hue})`
    };
  }

  // assign a stable, well-spread hue per course at load
  function assignColors(courses){
    let ci = 0, wi = 0;
    // spread by spacing indices so neighbors differ
    courses.forEach(c=>{
      if(c.cat === '교양'){ c.hue = WARM[(wi*1) % WARM.length]; wi++; }
      else { c.hue = COOL[(ci*1) % COOL.length]; ci++; }
      c.color = blockColor(c.hue);
    });
  }

  // ----- normalize raw COURSES (from courses.js) into rich objects -----
  function build(raw){
    const courses = raw.map(c=>({
      id:c.id, name:c.n, code:c.co, credit:c.cr, dept:c.dp, cat:c.cat,
      area:c.ar||null, grade:c.gr||'전학년', college:c.cg||'',
      sections: c.s.map(s=>({
        sec:s.sec, prof:s.p||'미정', cap:s.cap,
        meets: s.m.map(m=>({d:m[0], s:m[1], e:m[2], room:m[3]||''}))
      }))
    }));
    assignColors(courses);
    return courses;
  }

  // ----- time helpers -----
  function fmt(min){ const h=Math.floor(min/60), m=min%60; return h+':'+String(m).padStart(2,'0'); }
  function summarizeMeets(meets){
    // group by contiguous? just list "월수 13:00-14:50"
    if(!meets.length) return '시간미정';
    const byTime = {};
    meets.forEach(m=>{ const k=m.s+'-'+m.e; (byTime[k]=byTime[k]||[]).push(m.d); });
    return Object.entries(byTime).map(([k,ds])=>{
      const [s,e]=k.split('-').map(Number);
      const days = ds.sort((a,b)=>a-b).map(d=>DAYS[d]).join('');
      return days+' '+fmt(s)+'-'+fmt(e);
    }).join(', ');
  }

  // does a meeting set overlap another?
  function meetsConflict(a, b){
    for(const x of a) for(const y of b){
      if(x.d===y.d && x.s < y.e && y.s < x.e) return true;
    }
    return false;
  }

  // ----- combination engine -----
  // groups: [{id, name, options:[{key, courseId, name, code, cat, hue, color, sec, prof, credit, meets}]}]
  // conds: {friOff, noEarly, lunchFree}
  function generate(groups, conds){
    const active = groups.filter(g=>g.options && g.options.length);
    const optionSets = active.map(g=>g.options);
    const results = [];
    const LIMIT = 240;
    let visited = 0;
    const VCAP = 400000;
    // total cartesian (for the "checking N" display)
    let cartesian = optionSets.reduce((a,o)=>a*o.length, 1);

    function ok(opt){
      const m = opt.meets;
      if(conds.friOff && m.some(x=>x.d===4)) return false;
      if(conds.noEarly && m.some(x=>x.s < 600)) return false;          // 10시 이전 시작 = 1교시
      if(conds.lunchFree && m.some(x=>x.s < 780 && x.e > 720)) return false; // 12:00~13:00 겹침
      return true;
    }
    function rec(i, chosen, occMeets){
      if(results.length >= LIMIT || visited > VCAP) return;
      visited++;
      if(i === optionSets.length){ results.push(chosen.slice()); return; }
      for(const opt of optionSets[i]){
        if(!ok(opt)) continue;
        if(meetsConflict(opt.meets, occMeets)) continue;
        const before = occMeets.length;
        for(const m of opt.meets) occMeets.push(m);
        chosen.push(opt);
        rec(i+1, chosen, occMeets);
        chosen.pop();
        occMeets.length = before;
      }
    }
    rec(0, [], []);
    const scored = results.map(r=>({ picks:r, ...score(r) }));
    return { list: scored, cartesian, capped: results.length >= LIMIT };
  }

  function score(picks){
    const all = picks.flatMap(p=>p.meets);
    const credit = picks.reduce((a,p)=>a+(p.credit||0),0);
    const usedDays = new Set(all.map(m=>m.d).filter(d=>d<=4));
    const emptyDays = 5 - usedDays.size;
    const early = all.filter(m=>m.s < 600).length;
    // compactness: total gap minutes within each used day
    let gap = 0;
    [0,1,2,3,4].forEach(d=>{
      const dm = all.filter(m=>m.d===d).sort((a,b)=>a.s-b.s);
      for(let i=1;i<dm.length;i++){ gap += Math.max(0, dm[i].s - dm[i-1].e); }
    });
    return { credit, emptyDays, early, gap, span:all.length };
  }

  const SORTS = {
    empty:  (a,b)=> b.emptyDays-a.emptyDays || a.early-b.early || a.gap-b.gap,
    early:  (a,b)=> a.early-b.early || b.emptyDays-a.emptyDays || a.gap-b.gap,
    compact:(a,b)=> a.gap-b.gap || b.emptyDays-a.emptyDays || a.early-b.early,
  };

  // display range for a timetable (hours)
  function rangeFor(picks){
    const all = picks.flatMap(p=>p.meets);
    let lo = 9*60, hi = 17*60;
    all.forEach(m=>{ lo=Math.min(lo,m.s); hi=Math.max(hi,m.e); });
    const start = Math.floor(lo/60), end = Math.ceil(hi/60);
    const showSat = all.some(m=>m.d===5);
    return { start, end, showSat };
  }

  // ----- export timetable as canvas (PNG / PDF) -----
  let _probe;
  function resolveColor(c){
    if(!_probe){ _probe=document.createElement('span'); _probe.style.display='none'; document.body.appendChild(_probe); }
    _probe.style.color=c; return getComputedStyle(_probe).color;
  }
  function roundRect(ctx,x,y,w,h,r){ r=Math.min(r,h/2,w/2); ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

  function exportTimetable(picks, opts={}){
    const sc=2;
    const { start, end, showSat } = rangeFor(picks);
    const days = showSat?[0,1,2,3,4,5]:[0,1,2,3,4];
    const gutter=54, dayW=158, headH=46, rowH=64, pad=22;
    const titleH = opts.title?62:8;
    const cols=days.length;
    const W=pad*2+gutter+cols*dayW;
    const H=pad+titleH+headH+(end-start)*rowH+pad;
    const cv=document.createElement('canvas'); cv.width=W*sc; cv.height=H*sc;
    const ctx=cv.getContext('2d'); ctx.scale(sc,sc);
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
    const F="Pretendard,-apple-system,sans-serif";

    let oy=pad;
    if(opts.title){
      ctx.fillStyle='#1c1c1e'; ctx.font='700 24px '+F; ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.fillText(opts.title, pad, oy);
      if(opts.sub){ ctx.fillStyle='#8e8e93'; ctx.font='400 15px '+F; ctx.fillText(opts.sub, pad, oy+32); }
      oy+=titleH;
    }
    const gridX=pad+gutter, gridY=oy+headH;
    // hour lines + labels
    ctx.strokeStyle='#ececec'; ctx.lineWidth=1;
    for(let h=start;h<=end;h++){ const y=gridY+(h-start)*rowH;
      ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke();
      ctx.fillStyle='#aeaeb2'; ctx.font='400 12px '+F; ctx.textAlign='right'; ctx.textBaseline='top';
      ctx.fillText(h+':00', gridX-8, y+4); }
    // vertical lines
    for(let i=0;i<=cols;i++){ const x=gridX+i*dayW; ctx.strokeStyle='#ececec'; ctx.beginPath();
      ctx.moveTo(x,oy+headH); ctx.lineTo(x,H-pad); ctx.stroke(); }
    // day headers
    ctx.textAlign='center'; ctx.textBaseline='middle';
    days.forEach((d,i)=>{ ctx.fillStyle='#6c6c70'; ctx.font='600 15px '+F;
      ctx.fillText(DAYS[d], gridX+i*dayW+dayW/2, oy+headH/2); });
    ctx.strokeStyle='#d8d8db'; ctx.beginPath(); ctx.moveTo(pad,oy+headH); ctx.lineTo(W-pad,oy+headH); ctx.stroke();
    // blocks
    picks.forEach(p=>{
      const fill=resolveColor(p.color.fill), bd=resolveColor(p.color.bd), tx=resolveColor(p.color.tx);
      p.meets.forEach(m=>{ const di=days.indexOf(m.d); if(di<0) return;
        const x=gridX+di*dayW+3, y=gridY+(m.s-start*60)/60*rowH+2, w=dayW-6, hgt=(m.e-m.s)/60*rowH-4;
        ctx.fillStyle=fill; ctx.strokeStyle=bd; ctx.lineWidth=1.5; roundRect(ctx,x,y,w,hgt,8); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.beginPath(); ctx.rect(x+7,y+5,w-13,hgt-9); ctx.clip();
        ctx.fillStyle=tx; ctx.textAlign='left'; ctx.textBaseline='top';
        ctx.font='700 13px '+F; ctx.fillText(p.name, x+8, y+7);
        if(hgt>36){ ctx.font='400 11px '+F; ctx.fillText(fmt(m.s)+'–'+fmt(m.e)+(m.room?' · '+m.room:''), x+8, y+25); }
        ctx.restore();
      });
    });
    return cv;
  }

  window.TT = { DAYS, build, blockColor, COOL, WARM, fmt, summarizeMeets, meetsConflict,
                generate, score, SORTS, rangeFor, exportTimetable };
})();
