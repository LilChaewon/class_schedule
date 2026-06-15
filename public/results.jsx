/* ===== Results screen · Timetable · Detail overlay ===== */
const { useState, useEffect, useRef, useMemo } = React;

// ---------- reusable Timetable ----------
function Timetable({ picks, mini, nano, range, onBlockRemove, ghost }){
  let { start, end, showSat } = window.TT.rangeFor(picks);
  if(range){ start=Math.min(start,range[0]); end=Math.max(end,range[1]); }
  if(ghost && ghost.meets){ ghost.meets.forEach(m=>{
    start=Math.min(start,Math.floor(m.s/60)); end=Math.max(end,Math.ceil(m.e/60)); if(m.d===5) showSat=true; }); }
  const hours = [];
  for(let h=start; h<=end; h++) hours.push(h);
  const days = showSat ? [0,1,2,3,4,5] : [0,1,2,3,4];
  const rowH = nano ? 9 : mini ? 15 : 46;
  const head = nano ? 14 : mini ? 20 : 26;
  const gut  = nano ? 0 : mini ? 24 : 40;
  const bodyH = (end-start)*rowH;

  // blocks per day
  const blocksByDay = {};
  days.forEach(d=>blocksByDay[d]=[]);
  picks.forEach(p=>{
    p.meets.forEach(m=>{
      if(blocksByDay[m.d]) blocksByDay[m.d].push({ ...m, p });
    });
  });

  return (
    <div className="tt" style={{ '--head':head+'px', '--gut':gut+'px', '--bf':(mini?11:13)+'px' }}>
      {!nano && (
      <div className="tt-gutter">
        <div className="gh"></div>
        <div className="gt" style={{height:bodyH}}>
          {hours.map((h,i)=>(
            <span key={h} style={{top:(i*rowH-6)+'px'}}>{h}</span>
          ))}
        </div>
      </div>
      )}
      <div className="tt-cols">
        {days.map(d=>(
          <div className="tt-col" key={d}>
            <div className="ch">{nano?'':window.TT.DAYS[d]}</div>
            <div className="cbody" style={{height:bodyH}}>
              {!nano && hours.map((h,i)=> i>0 && <div className="hourline" key={h} style={{top:(i*rowH)+'px'}}></div>)}
              {blocksByDay[d].map((b,idx)=>{
                const top=(b.s-start*60)/60*rowH, hgt=(b.e-b.s)/60*rowH;
                const c=b.p.color;
                return (
                  <div className="tt-block" key={idx}
                    style={{top:top+'px', height:(hgt-(nano?1:2))+'px', background:c.fill, borderColor:c.bd, color:c.tx}}>
                    {!nano && <div className="b-name">{b.p.name}</div>}
                    {!mini && !nano && hgt>34 && <div className="b-meta">{window.TT.fmt(b.s)}–{window.TT.fmt(b.e)}{b.room?' · '+b.room:''}</div>}
                    {onBlockRemove && <button className="b-x" onClick={(e)=>{e.stopPropagation(); onBlockRemove(b.p);}}><Icon name="x" size={12}/></button>}
                  </div>
                );
              })}
              {ghost && ghost.meets && ghost.meets.filter(m=>m.d===d).map((m,gi)=>{
                const top=(m.s-start*60)/60*rowH, hgt=(m.e-m.s)/60*rowH;
                const c=ghost.color;
                return (
                  <div className="tt-block tt-ghost" key={'g'+gi}
                    style={{top:top+'px', height:(hgt-(nano?1:2))+'px',
                      borderColor:c?c.bd:'var(--accent)', color:c?c.tx:'var(--accent)',
                      background:c?c.fill:'var(--fill)'}}>
                    {!nano && <div className="b-name">{ghost.name}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- single result card ----------
function ResultCard({ item, rank, onOpen, onPick }){
  const s = item;
  return (
    <div className="tcard" onClick={()=>onOpen(item)}>
      <div className="tcard-head">
        <div className="rank">#{rank} <span>/ {item.credit}학점</span></div>
      </div>
      <div className="tcard-stats">
        <span className={"stat"+(s.emptyDays>0?" hl":"")}>공강 {s.emptyDays}일</span>
        <span className="stat">9시 {s.early}개</span>
        {s.gap===0 && <span className="stat">빈시간 없음</span>}
      </div>
      <Timetable picks={item.picks} mini />
      <div className="tcard-foot">
        <button onClick={(e)=>{e.stopPropagation(); onPick(item);}}>이 시간표 쓰기</button>
        <button onClick={(e)=>{e.stopPropagation(); onOpen(item);}} style={{color:'var(--label2)',flex:'0 0 auto',padding:'12px 18px'}}>크게</button>
      </div>
    </div>
  );
}

// ---------- detail overlay ----------
function DetailOverlay({ item, onClose, onPick }){
  const [show,setShow]=useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setShow(true),20); return ()=>clearTimeout(t); },[]);
  if(!item) return null;
  return (
    <div className={"detail"+(show?" show":"")} onClick={onClose}>
      <div className="detail-card" onClick={e=>e.stopPropagation()}>
        <div className="detail-head">
          <h3>시간표 미리보기</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="detail-body">
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
            <span className="stat hl">공강 {item.emptyDays}일</span>
            <span className="stat">{item.credit}학점</span>
            <span className="stat">9시 {item.early}개</span>
          </div>
          <div className="card" style={{overflow:'hidden',borderRadius:14}}>
            <Timetable picks={item.picks} />
          </div>
          <div style={{marginTop:6}}>
            {item.picks.map((p,i)=>(
              <div className="course-line" key={i}>
                <span className="swatch" style={{background:p.color.fill,borderColor:p.color.bd}}></span>
                <div className="cl-main">
                  <div className="cl-title">{p.name} <span style={{fontWeight:400,color:'var(--label3)',fontSize:13}}>{p.code}</span></div>
                  <div className="cl-sub">{p.prof} · {window.TT.summarizeMeets(p.meets)} · {p.sec}분반</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="detail-foot">
          <button className="btn btn-gray" style={{flex:'0 0 auto'}} onClick={onClose}>닫기</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={()=>onPick(item)}>이 시간표 쓰기</button>
        </div>
      </div>
    </div>
  );
}

// ---------- results screen (thumbnail rail + large timetable) ----------
function ResultsScreen({ data, visible, onBack, onPick }){
  const sorted = useMemo(()=>[...data.list].sort(window.TT.SORTS.empty), [data]);
  const [sel,setSel]=useState(0);
  useEffect(()=>{ setSel(0); },[data]);
  const cur = sorted[sel];

  return (
    <div className={"results-screen"+(visible?" show":"")}>
      <div className="results-nav">
        <div className="results-nav-inner">
          <button className="back-btn" onClick={onBack}><Icon name="chevL"/> 마법사</button>
          <div className="rn-title">결과 보기</div>
          <div className="rn-spacer"></div>
        </div>
      </div>

      {data.list.length===0 ? (
        <div className="empty-state">
          <div className="es-emoji"><Icon name="search" size={40}/></div>
          <h2>조건에 맞는 시간표가 없어요</h2>
          <p>그룹의 후보를 늘려 보세요. 그룹마다 후보가 많을수록 만들 수 있는 시간표가 늘어납니다.</p>
          <button className="btn btn-tint" onClick={onBack}>← 마법사로 돌아가기</button>
        </div>
      ) : (
        <div className="results-wrap">
          <div className="results-head">
            <h1>유효한 시간표 <b>{data.list.length}{data.capped?'+':''}</b>개</h1>
            <p>{data.cartesian.toLocaleString()}개의 경우의 수 중에서 만든 시간표예요. 마음에 드는 시간표를 골라 저장하세요.</p>
          </div>

          <div className="thumb-rail">
            {sorted.map((item,i)=>(
              <button key={i} className={"thumb"+(i===sel?" sel":"")} onClick={()=>setSel(i)}>
                <span className="thumb-num">{i+1}</span>
                <Timetable picks={item.picks} nano range={[9,17]}/>
              </button>
            ))}
          </div>

          {cur && (
            <div className="result-main">
              <div className="result-main-head">
                <div className="rm-stats">
                  <span className="stat hl">공강 {cur.emptyDays}일</span>
                  <span className="stat">{cur.credit}학점</span>
                  <span className="stat">9시 {cur.early}개</span>
                  {cur.gap===0 && <span className="stat">빈 시간 없음</span>}
                </div>
                <button className="btn btn-primary" onClick={()=>onPick(cur)}>이 시간표 쓰기</button>
              </div>
              <div className="card" style={{overflow:'hidden'}}>
                <Timetable picks={cur.picks} range={[9,18]}/>
              </div>
              <div className="course-list-flat">
                {cur.picks.map((p,i)=>(
                  <div className="course-line" key={i}>
                    <span className="swatch" style={{background:p.color.fill,borderColor:p.color.bd}}></span>
                    <div className="cl-main">
                      <div className="cl-title">{p.name} <span style={{fontWeight:400,color:'var(--label3)',fontSize:13}}>{p.code}</span></div>
                      <div className="cl-sub">{p.prof} · {window.TT.summarizeMeets(p.meets)} · {p.sec}분반</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Timetable, ResultCard, DetailOverlay, ResultsScreen });
