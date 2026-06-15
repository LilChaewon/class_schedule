/* ===== 시간표 마법사 — App · Editor · Wizard · Search · Calc ===== */
const { useState, useEffect, useRef, useMemo } = React;

// ---------- icons ----------
function Icon({ name, size=20 }){
  const p = { width:size, height:size, viewBox:'0 0 24 24', fill:'none',
    stroke:'currentColor', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round' };
  switch(name){
    case 'plus':   return <svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case 'x':      return <svg {...p}><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>;
    case 'check':  return <svg {...p}><polyline points="4 12 10 18 20 6"/></svg>;
    case 'search': return <svg {...p}><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>;
    case 'chevL':  return <svg {...p} strokeWidth="2.3"><polyline points="15 5 8 12 15 19"/></svg>;
    case 'chevR':  return <svg {...p}><polyline points="9 5 16 12 9 19"/></svg>;
    case 'trash':  return <svg {...p} strokeWidth="1.8"><polyline points="4 7 20 7"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>;
    case 'image':  return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><polyline points="4 18 9 13 13 16 16 13 20 17"/></svg>;
    case 'doc':    return <svg {...p}><path d="M6 3h8l4 4v14H6z"/><polyline points="14 3 14 7 18 7"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="16.5" x2="15" y2="16.5"/></svg>;
    case 'spark':  return <svg {...p}><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><line x1="3" y1="9.5" x2="21" y2="9.5"/><line x1="8" y1="2.5" x2="8" y2="6"/><line x1="16" y1="2.5" x2="16" y2="6"/></svg>;
    default: return null;
  }
}

function makeOpt(c, s){
  return { key:c.id+'_'+s.sec, courseId:c.id, name:c.name, code:c.code, cat:c.cat,
    hue:c.hue, color:c.color, sec:s.sec, prof:s.prof, credit:c.credit, meets:s.meets };
}
function buildOptions(courseIds, courseMap){
  const opts=[];
  courseIds.forEach(cid=>{ const c=courseMap[cid]; if(!c) return; c.sections.forEach(s=>opts.push(makeOpt(c,s))); });
  return opts;
}

// course shown if at least one section fits fully inside the selected time cells
function fitsTime(meets, sel){
  if(!meets.length) return false;
  return meets.every(m=>{
    const h0=Math.floor(m.s/60), h1=Math.ceil(m.e/60);
    for(let h=h0;h<h1;h++){ if(!sel.has(m.d*100+h)) return false; }
    return true;
  });
}
const GR_SHORT = g => (g||'').replace('학년','').replace('전','전');

// build 대학 › 학부 › 전공 hierarchy from major courses
function buildDeptTree(courses){
  const cols={}, colOrder=[];
  courses.filter(c=>c.cat==='전공' && c.college!=='교양' && c.college!=='자연캠퍼스').forEach(c=>{
    const col=c.college||c.dept;
    if(!cols[col]){ cols[col]={name:col,schools:{},schoolOrder:[]}; colOrder.push(col); }
    const C=cols[col];
    const m=c.dept.match(/^(.+?학부)\s+(.+)$/);
    const school=m?m[1]:c.dept;
    if(!C.schools[school]){ C.schools[school]={name:school,self:false,majors:{},majorOrder:[]}; C.schoolOrder.push(school); }
    const S=C.schools[school];
    if(m){ if(!S.majors[c.dept]){ S.majors[c.dept]={name:m[2],dept:c.dept}; S.majorOrder.push(c.dept); } }
    else { S.self=true; }
  });
  const ORDER=['스마트시스템공과대학','반도체·ICT대학','자연과학대학','화학·생명과학대학','예술체육대학','스포츠예술대학','건축대학','융합전공'];
  colOrder.sort((a,b)=>{ const ia=ORDER.indexOf(a),ib=ORDER.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); });
  return { cols, colOrder };
}

// ---------- dept tree picker modal (대학 › 학부 › 전공) ----------
function DeptTreeModal({ courses, onApply, onClose }){
  const [show,setShow]=useState(false);
  const [exp,setExp]=useState(()=>new Set());
  const tree=useMemo(()=>buildDeptTree(courses),[courses]);
  useEffect(()=>{ const t=setTimeout(()=>setShow(true),20); return ()=>clearTimeout(t); },[]);
  const close=()=>{ setShow(false); setTimeout(onClose,240); };
  const toggle=(k)=>setExp(s=>{ const n=new Set(s); n.has(k)?n.delete(k):n.add(k); return n; });
  const pick=(sel)=>{ onApply(sel); close(); };

  return (
    <div className={"detail"+(show?" show":"")} style={{zIndex:62}} onClick={close}>
      <div className="detail-card" onClick={e=>e.stopPropagation()}>
        <div className="detail-head"><h3>학과 선택</h3><button className="icon-btn" onClick={close}><Icon name="x"/></button></div>
        <div className="detail-body" style={{padding:'0 10px 8px'}}>
          <div className="tree-row lv0" onClick={()=>pick(null)}>
            <span className="tree-lead"></span><span className="tree-label all">전체 학과</span>
          </div>
          {tree.colOrder.map(col=>{
            const C=tree.cols[col], ck='c/'+col, copen=exp.has(ck);
            return (
              <React.Fragment key={col}>
                <div className="tree-row lv0">
                  <button className={"tree-chev"+(copen?" open":"")} onClick={(e)=>{e.stopPropagation();toggle(ck);}}><Icon name="chevR" size={17}/></button>
                  <span className="tree-label" onClick={()=>pick({kind:'college',value:col,label:col})}>{col}</span>
                </div>
                {copen && C.schoolOrder.map(sn=>{
                  const S=C.schools[sn]; const hasKids=S.majorOrder.length>0;
                  const sk=ck+'/'+sn, sopen=exp.has(sk);
                  const isCollegeSelf = sn===col;
                  if(!hasKids){
                    // leaf 학과 / college-self
                    return (
                      <div className="tree-row lv1" key={sn} onClick={()=>pick({kind:'school',value:sn,label:sn})}>
                        <span className="tree-lead dash">–</span><span className="tree-label">{sn}</span>
                      </div>
                    );
                  }
                  return (
                    <React.Fragment key={sn}>
                      <div className="tree-row lv1">
                        <button className={"tree-chev"+(sopen?" open":"")} onClick={(e)=>{e.stopPropagation();toggle(sk);}}><Icon name="chevR" size={16}/></button>
                        <span className="tree-label" onClick={()=>pick({kind:'school',value:sn,label:sn})}>{sn}</span>
                      </div>
                      {sopen && (
                        <React.Fragment>
                          {S.self && (
                            <div className="tree-row lv2" onClick={()=>pick({kind:'major',value:sn,label:sn+' (공통)'})}>
                              <span className="tree-lead dash">–</span><span className="tree-label dim">{sn} 공통</span>
                            </div>
                          )}
                          {S.majorOrder.map(mk=>{
                            const M=S.majors[mk];
                            return (
                              <div className="tree-row lv2" key={mk} onClick={()=>pick({kind:'major',value:M.dept,label:M.name})}>
                                <span className="tree-lead dash">–</span><span className="tree-label">{M.name}</span>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      )}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- time grid modal (paint cells = allowed times) ----------
function TimeGridModal({ initial, onApply, onClose }){
  const [show,setShow]=useState(false);
  const [sel,setSel]=useState(()=>new Set(initial));
  const drag=useRef(null);
  useEffect(()=>{
    const t=setTimeout(()=>setShow(true),20);
    const up=()=>{drag.current=null;};
    window.addEventListener('pointerup',up);
    return ()=>{ clearTimeout(t); window.removeEventListener('pointerup',up); };
  },[]);
  const close=()=>{ setShow(false); setTimeout(onClose,240); };
  const days=['월','화','수','목','금','토','일'];
  const hours=[]; for(let h=8;h<=23;h++) hours.push(h);
  const paint=(key,add)=>setSel(s=>{ const n=new Set(s); add?n.add(key):n.delete(key); return n; });
  const down=(key,e)=>{ e.preventDefault(); const add=!sel.has(key); drag.current={add}; paint(key,add); };
  const enter=(key)=>{ if(drag.current) paint(key,drag.current.add); };
  return (
    <div className={"detail"+(show?" show":"")} style={{zIndex:62}} onClick={close}>
      <div className="detail-card" onClick={e=>e.stopPropagation()}>
        <div className="detail-head"><h3>시간</h3><button className="icon-btn" onClick={close}><Icon name="x"/></button></div>
        <div style={{padding:'0 18px 6px',color:'var(--label2)',fontSize:14}}>칠한 시간 안에 들어가는 과목만 검색해요.</div>
        <div className="detail-body">
          <div className="timegrid">
            <div className="tg-corner"></div>
            {days.map(d=><div className="tg-h" key={d}>{d}</div>)}
            {hours.map(h=>(
              <React.Fragment key={h}>
                <div className="tg-time">{h}</div>
                {days.map((d,di)=>{ const key=di*100+h;
                  return <div key={key} className={"tg-cell"+(sel.has(key)?" on":"")}
                    onPointerDown={e=>down(key,e)} onPointerEnter={()=>enter(key)}></div>; })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="detail-foot">
          <button className="btn btn-gray" style={{flex:'0 0 auto'}} onClick={()=>setSel(new Set())}>초기화</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={()=>{ onApply(sel); close(); }}>적용 {sel.size?`(${sel.size})`:''}</button>
        </div>
      </div>
    </div>
  );
}

// ---------- search sheet (section mode = editor, group mode = wizard) ----------
function SearchSheet({ courses, mode, group, placedKeys, onPickCourse, onPickSection, onClose }){
  const [show,setShow]=useState(false);
  const [q,setQ]=useState('');
  const [cat,setCat]=useState('전체');
  const [grade,setGrade]=useState('전체');
  const [deptSel,setDeptSel]=useState(null);
  const [deptOpen,setDeptOpen]=useState(false);
  const [area,setArea]=useState('전체');
  const [timeSel,setTimeSel]=useState(()=>new Set());
  const [timeOpen,setTimeOpen]=useState(false);
  const [open,setOpen]=useState(null);
  const inputRef=useRef(null);
  useEffect(()=>{ const t=setTimeout(()=>setShow(true),20); setTimeout(()=>inputRef.current&&inputRef.current.focus(),340); return ()=>clearTimeout(t); },[]);
  const close=()=>{ setShow(false); setTimeout(onClose,300); };

  const pickCat=(c)=>{ setCat(c); setDeptSel(null); setArea('전체'); };

  const results = useMemo(()=>{
    const kw=q.trim().toLowerCase(); let list=courses;
    if(cat!=='전체') list=list.filter(c=>c.cat===cat);
    if(grade!=='전체'&&cat!=='교양') list=list.filter(c=>c.grade===grade||c.grade==='전학년');
    if(cat==='전공'&&deptSel){
      if(deptSel.kind==='college') list=list.filter(c=>c.college===deptSel.value);
      else if(deptSel.kind==='school') list=list.filter(c=>c.dept===deptSel.value||c.dept.startsWith(deptSel.value+' '));
      else list=list.filter(c=>c.dept===deptSel.value);
    }
    if(cat==='교양'&&area!=='전체') list=list.filter(c=>c.area===area);
    if(timeSel.size) list=list.filter(c=>c.sections.some(s=>fitsTime(s.meets,timeSel)));
    if(kw) list=list.filter(c=>
      c.name.toLowerCase().includes(kw)||(c.code||'').toLowerCase().includes(kw)||c.dept.toLowerCase().includes(kw)||
      c.sections.some(s=>(s.prof||'').toLowerCase().includes(kw)));
    return list.slice(0,80);
  },[q,cat,grade,deptSel,area,timeSel,courses]);

  const inGroup = mode==='group' ? new Set(group.courseIds) : null;

  return (
    <div className={"scrim"+(show?" show":"")} onClick={close}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="sheet-grip"></div>
        <div className="sheet-head">
          <div className="sh-top">
            <h3>{mode==='group'?'후보 과목 추가':'과목 추가'}</h3>
            <button className="btn-plain" onClick={close} style={{fontWeight:600}}>완료</button>
          </div>
          <div className="searchbar">
            <span style={{color:'var(--label3)',display:'flex'}}><Icon name="search" size={18}/></span>
            <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} placeholder="과목명 · 학수번호 · 교수 · 학부"/>
            {q && <button className="icon-btn" onClick={()=>setQ('')} style={{width:24,height:24}}><Icon name="x" size={15}/></button>}
          </div>
          <div className="filter-row">
            {['전체','전공','교양'].map(c=>(
              <button key={c} className={"fchip"+(cat===c?" on":"")} onClick={()=>pickCat(c)}>{c}</button>
            ))}
            <button className={"fchip"+(timeSel.size?" on":"")} onClick={()=>setTimeOpen(true)}>시간{timeSel.size?` · ${timeSel.size}`:''}</button>
            <span style={{flex:1}}></span>
            <span className="fchip" style={{pointerEvents:'none',color:'var(--label3)',borderColor:'transparent',background:'transparent'}}>{results.length}개</span>
          </div>
          <div className="filter-row">
            {cat==='전공' && (
              <button className={"fchip tree-trigger"+(deptSel?" on":"")} onClick={()=>setDeptOpen(true)}>
                {deptSel?deptSel.label:'학과 선택'}<Icon name="chevR" size={13}/>
              </button>
            )}
            {cat!=='교양' && ['전체','1학년','2학년','3학년','4학년'].map(g=>(
              <button key={g} className={"fchip"+(grade===g?" on":"")} onClick={()=>setGrade(g)}>{g==='전체'?'학년 전체':g}</button>
            ))}
            {cat==='교양' && ['전체','교양필수','교양선택','균형교양'].map(a=>(
              <button key={a} className={"fchip"+(area===a?" on":"")} onClick={()=>setArea(a)}>{a==='전체'?'영역 전체':a}</button>
            ))}
          </div>
        </div>
        <div className="sheet-body">
          {results.length===0 && <div className="empty-note">검색 결과가 없어요.<br/>다른 키워드로 찾아보세요.</div>}
          {results.map(c=>{
            if(mode==='group'){
              const added=inGroup.has(c.id);
              return (
                <div className="res-row" key={c.id}>
                  <span className="swatch" style={{background:c.color.fill,borderColor:c.color.bd}}></span>
                  <div className="res-main">
                    <div className="res-title">{c.name}
                      <span className="cat-tag" style={{color:c.color.tx,borderColor:c.color.bd,background:c.color.fill}}>{c.cat==='교양'?(c.area||'교양'):'전공'}</span></div>
                    <div className="res-sub">{c.code} · {c.grade} · {c.credit}학점 · {c.dept} · 분반 {c.sections.length}개</div>
                  </div>
                  <button className={"add-btn"+(added?" added":"")} onClick={()=>onPickCourse(c.id)}><Icon name={added?"check":"plus"} size={18}/></button>
                </div>
              );
            }
            // section mode
            const isOpen=open===c.id;
            const placedHere=c.sections.some(s=>placedKeys.has(c.id+'_'+s.sec));
            return (
              <div key={c.id}>
                <div className="res-row expandable" onClick={()=>setOpen(isOpen?null:c.id)}>
                  <span className="swatch" style={{background:c.color.fill,borderColor:c.color.bd}}></span>
                  <div className="res-main">
                    <div className="res-title">{c.name}
                      <span className="cat-tag" style={{color:c.color.tx,borderColor:c.color.bd,background:c.color.fill}}>{c.cat==='교양'?(c.area||'교양'):'전공'}</span>
                      {placedHere && <Icon name="check" size={15}/>}
                    </div>
                    <div className="res-sub">{c.code} · {c.grade} · {c.credit}학점 · {c.dept} · 분반 {(timeSel.size?c.sections.filter(s=>fitsTime(s.meets,timeSel)):c.sections).length}개</div>
                  </div>
                  <span className={"res-chev"+(isOpen?" open":"")}><Icon name="chevR" size={18}/></span>
                </div>
                {isOpen && (
                  <div className="sec-list">
                    {(timeSel.size?c.sections.filter(s=>fitsTime(s.meets,timeSel)):c.sections).map(s=>{
                      const key=c.id+'_'+s.sec, on=placedKeys.has(key);
                      return (
                        <button className={"sec-opt"+(on?" on":"")} key={key} onClick={()=>onPickSection(c,s)}>
                          <div className="so-main">
                            <div className="so-top">{s.sec}분반 · {s.prof}</div>
                            <div className="so-sub">{window.TT.summarizeMeets(s.meets)}{s.cap?` · 정원 ${s.cap}`:''}</div>
                          </div>
                          <span className="so-ico"><Icon name={on?"check":"plus"} size={16}/></span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {timeOpen && <TimeGridModal initial={timeSel} onApply={setTimeSel} onClose={()=>setTimeOpen(false)}/>}
      {deptOpen && <DeptTreeModal courses={courses} onApply={setDeptSel} onClose={()=>setDeptOpen(false)}/>}
    </div>
  );
}

// ---------- group card (wizard) ----------
function GroupCard({ group, courseMap, onRename, onRemoveCourse, onAddClick, onDelete }){
  return (
    <div className="card group">
      <div className="group-head">
        <input className="group-name" value={group.name} onChange={e=>onRename(group.id,e.target.value)} spellCheck={false}/>
        <span className="pick-badge">택 1</span>
        <button className="icon-btn danger" onClick={()=>onDelete(group.id)}><Icon name="trash" size={18}/></button>
      </div>
      <div className="opt-list">
        {group.courseIds.map(cid=>{
          const c=courseMap[cid]; if(!c) return null;
          return (
            <div key={cid}>
              <div className="opt-row">
                <span className="swatch" style={{background:c.color.fill,borderColor:c.color.bd}}></span>
                <div className="opt-main">
                  <div className="opt-title">{c.name}<span className="sec-pill">{c.sections.length}분반</span></div>
                  <div className="opt-sub">{c.code}<span className="dot">·</span>{c.credit}학점<span className="dot">·</span>{c.cat==='교양'?(c.area||'교양'):c.dept}</div>
                </div>
                <button className="icon-btn" onClick={()=>onRemoveCourse(group.id,cid)}><Icon name="x" size={17}/></button>
              </div>
              <div className="sec-sublist">
                {c.sections.map(s=>(
                  <div className="sec-sub" key={s.sec}>
                    <span className="ss-sec">{s.sec}분반</span>
                    <span className="ss-prof">{s.prof}</span>
                    <span className="ss-time">{window.TT.summarizeMeets(s.meets)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <button className="add-row" onClick={()=>onAddClick(group.id)}><Icon name="plus" size={18}/> 후보 과목 추가</button>
      </div>
    </div>
  );
}

// ---------- calc overlay ----------
function CalcOverlay({ target, onDone }){
  const [show,setShow]=useState(false);
  const [prog,setProg]=useState(0);
  const [n,setN]=useState(0);
  useEffect(()=>{
    const t1=setTimeout(()=>setShow(true),20);
    const dur=1500, t0=performance.now(); let raf;
    const tick=(t)=>{ const k=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-k,3);
      setProg(e); setN(Math.round(e*target)); if(k<1) raf=requestAnimationFrame(tick); };
    raf=requestAnimationFrame(tick);
    const done=setTimeout(()=>{ setProg(1); setN(target); onDone(); }, dur+320);
    return ()=>{ clearTimeout(t1); clearTimeout(done); cancelAnimationFrame(raf); };
  },[]);
  const C=2*Math.PI*44;
  return (
    <div className={"calc"+(show?" show":"")}>
      <div className="calc-ring">
        <svg viewBox="0 0 96 96">
          <circle className="tracker" cx="48" cy="48" r="44"/>
          <circle className="bar" cx="48" cy="48" r="44" strokeDasharray={C} strokeDashoffset={C*(1-prog)}/>
        </svg>
        <div className="calc-spark"><Icon name="spark" size={30}/></div>
      </div>
      <h2>가능한 조합을 만들고 있어요</h2>
      <div className="ccount"><b>{n.toLocaleString()}</b>개 조합을 확인했어요</div>
    </div>
  );
}

function Toast({ msg }){
  const [show,setShow]=useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setShow(true),20); return ()=>clearTimeout(t); },[]);
  return <div className={"toast"+(show?" show":"")}>{msg}</div>;
}

// ---------- editor (home) ----------
function EditorScreen({ placed, totalCredit, onAdd, onWizard, onRemove, onSaveImage, onSavePdf }){
  return (
    <React.Fragment>
      <div className="largetitle">
        <h1>내 시간표</h1>
        <p>2026학년도 1학기 · 과목을 추가해 직접 짜거나, 마법사로 모든 조합을 한 번에 만들어 보세요.</p>
      </div>
      <div className="page">
        <button className="wizard-cta" onClick={onWizard}>
          <span className="wc-ico"><Icon name="spark" size={22}/></span>
          <span className="wc-text">
            <span className="wc-title">최적의 시간표 만들러 가기</span>
            <span className="wc-sub">꼭 들어야 할 과목들, 어느 시간대(분반)로 들어야 가장 좋은 시간표가 될까요? 가능한 조합을 다 따져서 골라드려요</span>
          </span>
          <Icon name="chevR" size={20}/>
        </button>
        <div className="builder-grid">
          <div className="builder-left">
            <div className="tt-toolbar">
              <button className="btn btn-gray sm-btn" disabled={!placed.length} onClick={onSaveImage}><Icon name="image" size={17}/> 이미지 저장</button>
              <button className="btn btn-gray sm-btn" disabled={!placed.length} onClick={onSavePdf}><Icon name="doc" size={17}/> PDF 저장</button>
            </div>
            <div className="card" style={{overflow:'hidden',padding:'10px 8px 8px'}}>
              <Timetable picks={placed} range={[9,18]} onBlockRemove={onRemove}/>
            </div>
            <p className="grid-hint">블록의 × 버튼을 누르면 시간표에서 빼요.</p>
          </div>
          <div className="builder-right">
            <div className="section-label">담은 과목<span className="hint">{placed.length}과목 · {totalCredit}학점</span></div>
            <div className="card">
              {placed.length===0 && <div className="placed-empty">아직 담은 과목이 없어요.<br/>‘과목 추가’로 시작해 보세요.</div>}
              {placed.map(p=>(
                <div className="opt-row" key={p.key}>
                  <span className="swatch" style={{background:p.color.fill,borderColor:p.color.bd}}></span>
                  <div className="opt-main">
                    <div className="opt-title">{p.name}<span className="sec-pill">{p.sec}분반</span></div>
                    <div className="opt-sub">{p.prof}<span className="dot">·</span>{window.TT.summarizeMeets(p.meets)}</div>
                  </div>
                  <button className="icon-btn" onClick={()=>onRemove(p)}><Icon name="x" size={17}/></button>
                </div>
              ))}
            </div>
            <div className="side-actions" style={{marginTop:14}}>
              <button className="btn btn-primary btn-lg" onClick={onAdd}><Icon name="plus" size={18}/> 과목 추가</button>
            </div>
          </div>
        </div>
      </div>
      <div className="dock">
        <div className="dock-inner">
          <button className="btn btn-primary" style={{flex:1,padding:'14px'}} onClick={onAdd}><Icon name="plus" size={18}/> 과목 추가</button>
        </div>
      </div>
    </React.Fragment>
  );
}

// ---------- wizard (pushed screen) ----------
function WizardScreen({ visible, groups, courseMap, stats, onBack, onRename, onRemoveCourse, onAddClick, onDelete, onAddGroup, onGenerate }){
  return (
    <div className={"push-screen"+(visible?" show":"")}>
      <div className="results-nav">
        <div className="results-nav-inner">
          <button className="back-btn" onClick={onBack}><Icon name="chevL"/> 내 시간표</button>
          <div className="rn-title">시간표 마법사</div>
          <div className="rn-spacer"></div>
        </div>
      </div>
      <div className="results-head">
        <h1>비슷한 과목을 묶어요</h1>
        <p>예를 들어 같은 과목의 여러 분반(시간대)을 한 그룹에 넣으면, 그중 시간이 가장 잘 맞는 하나를 골라 최적의 시간표를 만들어줘요.</p>
      </div>
      <div className="page" style={{paddingTop:8}}>
        <div className="builder-grid">
          <div className="builder-left">
            <div className="section-label">그룹<span className="hint">그룹마다 택 1</span></div>
            {groups.map(g=>(
              <GroupCard key={g.id} group={g} courseMap={courseMap}
                onRename={onRename} onRemoveCourse={onRemoveCourse} onAddClick={onAddClick} onDelete={onDelete}/>
            ))}
            <button className="add-group" onClick={onAddGroup}><Icon name="plus" size={18}/> 그룹 추가</button>
          </div>
          <div className="builder-right">
            <div className="card pad">
              <div style={{display:'flex',justifyContent:'space-between',fontSize:15}}><span style={{color:'var(--label2)'}}>그룹</span><b>{stats.groups}개</b></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:15,marginTop:7}}><span style={{color:'var(--label2)'}}>후보 과목</span><b>{stats.courses}개</b></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:15,marginTop:7,paddingTop:9,borderTop:'.5px solid var(--sep)'}}><span style={{color:'var(--label2)'}}>확인할 조합</span><b style={{color:'var(--accent)'}}>{stats.cartesian.toLocaleString()}개</b></div>
              <button className="btn btn-primary btn-lg side-actions" style={{marginTop:16}} disabled={stats.cartesian===0} onClick={onGenerate}><Icon name="spark" size={19}/> 조합 만들기</button>
            </div>
          </div>
        </div>
      </div>
      <div className="dock">
        <div className="dock-inner">
          <div className="dock-info"><div className="di-big">{stats.groups}개 그룹 · 후보 {stats.courses}개</div><div className="di-sub">확인할 조합 {stats.cartesian.toLocaleString()}개</div></div>
          <button className="btn btn-primary" disabled={stats.cartesian===0} onClick={onGenerate}><Icon name="spark" size={18}/> 조합 만들기</button>
        </div>
      </div>
    </div>
  );
}

// ---------- seeds ----------
function seedPlaced(courses){
  const out=[], occ=[];
  const add=(c)=>{ if(!c) return; const s=c.sections.find(s=>s.meets.length); if(!s) return;
    if(occ.length && window.TT.meetsConflict(s.meets,occ)) return; out.push(makeOpt(c,s)); occ.push(...s.meets); };
  const majors=courses.filter(c=>c.cat==='전공');
  const ges=courses.filter(c=>c.cat==='교양'&&c.credit>=2&&!/채플/.test(c.name));
  const byDept={}; majors.forEach(c=>{(byDept[c.dept]=byDept[c.dept]||[]).push(c);});
  const dept=Object.keys(byDept).sort((a,b)=>byDept[b].length-byDept[a].length)[0];
  const pool=byDept[dept]||majors;
  add(pool[0]); add(pool[1]); add(ges[3]);
  return out;
}
let GID=10;
function seedGroups(courses){
  const chapel=courses.find(c=>c.name==='채플');
  const majors=courses.filter(c=>c.cat==='전공');
  const ges=courses.filter(c=>c.cat==='교양'&&c.credit>=2&&!/채플/.test(c.name));
  const byDept={}; majors.forEach(c=>{(byDept[c.dept]=byDept[c.dept]||[]).push(c);});
  const dept=Object.keys(byDept).sort((a,b)=>byDept[b].length-byDept[a].length).find(d=>byDept[d].length>=4)||Object.keys(byDept)[0];
  const pool=byDept[dept]||[];
  const sel=pool.slice(0,3);
  const gePick=[ges[3],ges[11]].filter(Boolean);
  const g=[];
  if(chapel) g.push({id:'g1',name:'그룹 1',courseIds:[chapel.id]});
  if(sel.length) g.push({id:'g2',name:'그룹 2',courseIds:sel.map(c=>c.id)});
  if(gePick.length) g.push({id:'g3',name:'그룹 3',courseIds:gePick.map(c=>c.id)});
  return g.length?g:[{id:'g1',name:'그룹 1',courseIds:[]}];
}

// ---------- App ----------
function App(){
  const courses=useMemo(()=>window.TT.build(window.COURSES),[]);
  const courseMap=useMemo(()=>{ const m={}; courses.forEach(c=>m[c.id]=c); return m; },[courses]);

  const [placed,setPlaced]=useState(()=>seedPlaced(courses));
  const [groups,setGroups]=useState(()=>seedGroups(courses));
  const [search,setSearch]=useState(null);      // {mode:'section'} | {mode:'group',gid}
  const [wizOpen,setWizOpen]=useState(false);
  const [wizVisible,setWizVisible]=useState(false);
  const [calc,setCalc]=useState(null);
  const [results,setResults]=useState(null);
  const [resVisible,setResVisible]=useState(false);
  const [toast,setToast]=useState(null);
  const [scrolled,setScrolled]=useState(false);

  const [t,setTweak]=useTweaks(TWEAK_DEFAULTS);
  useEffect(()=>{ document.documentElement.style.setProperty('--accent',t.accent); },[t.accent]);
  useEffect(()=>{ document.documentElement.style.setProperty('--radius',t.radius+'px');
    document.documentElement.style.setProperty('--radius-sm',Math.max(8,t.radius-6)+'px'); },[t.radius]);
  useEffect(()=>{ const on=()=>setScrolled(window.scrollY>6); window.addEventListener('scroll',on); return ()=>window.removeEventListener('scroll',on); },[]);

  function showToast(m){ setToast(m); setTimeout(()=>setToast(null),2000); }

  // ----- editor: placed -----
  const placedKeys=useMemo(()=>new Set(placed.map(p=>p.key)),[placed]);
  const totalCredit=placed.reduce((a,p)=>a+(p.credit||0),0);
  function togglePlace(c,s){
    const opt=makeOpt(c,s);
    if(placedKeys.has(opt.key)){ setPlaced(ps=>ps.filter(p=>p.key!==opt.key)); return; }
    const occ=placed.flatMap(p=>p.meets);
    if(window.TT.meetsConflict(opt.meets,occ)){
      const cf=placed.find(p=>window.TT.meetsConflict(opt.meets,p.meets));
      showToast(`${cf?cf.name:'다른 수업'}과 시간이 겹쳐요`); return;
    }
    setPlaced(ps=>[...ps,opt]);
  }
  const removePlaced=(p)=>setPlaced(ps=>ps.filter(x=>x.key!==p.key));

  // ----- wizard: groups -----
  const rename=(id,name)=>setGroups(gs=>gs.map(g=>g.id===id?{...g,name}:g));
  const delGroup=(id)=>setGroups(gs=>gs.filter(g=>g.id!==id));
  const removeCourse=(gid,cid)=>setGroups(gs=>gs.map(g=>g.id===gid?{...g,courseIds:g.courseIds.filter(x=>x!==cid)}:g));
  const addGroup=()=>{ const id='g'+(GID++); setGroups(gs=>[...gs,{id,name:'그룹 '+(gs.length+1),courseIds:[]}]); };
  const toggleCourseInGroup=(cid)=>setGroups(gs=>gs.map(g=>{
    if(!search||g.id!==search.gid) return g;
    return g.courseIds.includes(cid)?{...g,courseIds:g.courseIds.filter(x=>x!==cid)}:{...g,courseIds:[...g.courseIds,cid]};
  }));

  const stats=useMemo(()=>{
    const act=groups.filter(g=>g.courseIds.length);
    const courseCount=act.reduce((a,g)=>a+g.courseIds.length,0);
    const cart=act.reduce((a,g)=>{ const opt=g.courseIds.reduce((s,cid)=>s+(courseMap[cid]?courseMap[cid].sections.length:0),0); return a*opt; }, act.length?1:0);
    return { groups:act.length, courses:courseCount, cartesian:cart };
  },[groups,courseMap]);

  // ----- navigation -----
  function openWizard(){ setWizOpen(true); setTimeout(()=>setWizVisible(true),20); }
  function closeWizard(){ setWizVisible(false); setTimeout(()=>setWizOpen(false),420); }

  function handleGenerate(){
    const gs=groups.map(g=>({...g,options:buildOptions(g.courseIds,courseMap)}));
    const data=window.TT.generate(gs,{});
    setCalc({ target:Math.max(1,data.cartesian), data });
  }
  function calcDone(){ const data=calc.data; setCalc(null); setResults(data); setTimeout(()=>setResVisible(true),20); }
  function backFromResults(){ setResVisible(false); setTimeout(()=>setResults(null),420); }
  function saveImage(){
    if(!placed.length){ showToast('담은 과목이 없어요'); return; }
    const cv=window.TT.exportTimetable(placed,{title:'2026-1학기 내 시간표', sub:placed.length+'과목 · '+totalCredit+'학점'});
    cv.toBlob(b=>{ const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download='내 시간표.png';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),1500); });
    showToast('이미지를 저장했어요');
  }
  function savePdf(){
    if(!placed.length){ showToast('담은 과목이 없어요'); return; }
    const cv=window.TT.exportTimetable(placed,{title:'2026-1학기 내 시간표', sub:placed.length+'과목 · '+totalCredit+'학점'});
    const url=cv.toDataURL('image/png');
    const w=window.open('','_blank');
    if(!w){ showToast('팝업을 허용하면 PDF로 저장할 수 있어요'); return; }
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>내 시간표</title><style>@page{size:auto;margin:12mm}html,body{margin:0}body{display:flex;justify-content:center;align-items:flex-start;padding:8px}img{max-width:100%;height:auto}</style></head><body><img src="'+url+'" onload="setTimeout(function(){window.focus();window.print();},300)"></body></html>');
    w.document.close();
  }
  function pickResult(item){
    setPlaced(item.picks.map(p=>({...p})));
    setResVisible(false); setWizVisible(false);
    setTimeout(()=>{ setResults(null); setWizOpen(false); },440);
    showToast('마법사 시간표를 불러왔어요');
  }

  const searchGroup = search && search.mode==='group' ? groups.find(g=>g.id===search.gid) : null;

  return (
    <div className="app">
      <div className={"navbar"+(scrolled?" scrolled":"")}>
        <div className="navbar-inner">
          <div className="nbtitle">내 시간표</div>
        </div>
      </div>

      <EditorScreen placed={placed} totalCredit={totalCredit}
        onAdd={()=>setSearch({mode:'section'})} onWizard={openWizard} onRemove={removePlaced}
        onSaveImage={saveImage} onSavePdf={savePdf}/>

      {wizOpen && <WizardScreen visible={wizVisible} groups={groups} courseMap={courseMap} stats={stats}
        onBack={closeWizard} onRename={rename} onRemoveCourse={removeCourse}
        onAddClick={(gid)=>setSearch({mode:'group',gid})} onDelete={delGroup} onAddGroup={addGroup} onGenerate={handleGenerate}/>}

      {results && <ResultsScreen data={results} visible={resVisible} onBack={backFromResults} onPick={pickResult}/>}

      {search && <SearchSheet courses={courses} mode={search.mode}
        group={searchGroup} placedKeys={placedKeys}
        onPickCourse={toggleCourseInGroup} onPickSection={togglePlace} onClose={()=>setSearch(null)}/>}

      {calc && <CalcOverlay target={calc.target} onDone={calcDone}/>}
      {toast && <Toast msg={toast}/>}

      <TweaksPanel>
        <TweakSection label="포인트 컬러" />
        <TweakColor label="강조색" value={t.accent}
          options={['#3b4a6b','#0a84ff','#1f8a5b','#c0563a','#1c1c1e']}
          onChange={v=>setTweak('accent',v)} />
        <TweakSection label="모양" />
        <TweakSlider label="모서리 둥글기" value={t.radius} min={8} max={22} step={1} unit="px"
          onChange={v=>setTweak('radius',v)} />
      </TweaksPanel>
    </div>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#3b4a6b",
  "radius": 18
}/*EDITMODE-END*/;

Object.assign(window,{ Icon, App });
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
