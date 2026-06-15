/* ===== 강의 시간표 CSV → window.COURSES 형식 파서 (브라우저·Node 공용) =====
 * 이 학교(자연캠퍼스) 공식 시간표 CSV 형식 전용.
 * 출력 한 과목: {id,n,co,cr,dp,cg,cat,ar,gr,s:[{sec,p,cap,m:[[day,start,end,room]]}]}
 */
(function (root) {
  var DAY = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };

  // 학과(dept) → 단과대학(college). 기존 데이터에서 추출한 매핑.
  var DEPT_COLLEGE = {
    "건축대학": "건축대학", "건축학부": "건축대학", "건축학부 건축학전공": "건축대학",
    "건축학부 전통건축학전공": "건축대학", "공간디자인학과": "건축대학",
    "공연예술학부": "스포츠예술대학", "공연예술학부 뮤지컬공연전공": "스포츠예술대학",
    "공연예술학부 연극·영화전공": "스포츠예술대학",
    "기계시스템공학부": "스마트시스템공과대학", "기계시스템공학부 기계공학전공": "스마트시스템공과대학",
    "기계시스템공학부 로봇공학전공": "스마트시스템공과대학",
    "디자인학부": "예술체육대학", "멀티미디어콘텐츠크리에이션": "융합전공",
    "물리학과": "자연과학대학", "바둑학과": "예술체육대학",
    "반도체·ICT대학": "반도체·ICT대학", "반도체공학부": "반도체·ICT대학",
    "반도체시스템공학과": "반도체·ICT대학", "산업경영공학과": "반도체·ICT대학",
    "수학과": "자연과학대학", "스마트사회인프라유지관리학과": "스마트시스템공과대학",
    "스마트시스템공과대학": "스마트시스템공과대학",
    "스마트인프라공학부 건설환경공학전공": "스마트시스템공과대학",
    "스마트인프라공학부 글로벌스마트인프라공학전공": "스마트시스템공과대학",
    "스마트인프라공학부 스마트모빌리티공학전공": "스마트시스템공과대학",
    "스마트인프라공학부 환경시스템공학전공": "스마트시스템공과대학",
    "스포츠학부 스포츠지도학전공": "스포츠예술대학",
    "스포츠학부(체육학전공, 스포츠산업학전공)": "스포츠예술대학",
    "아트앤멀티미디어음악학부": "예술체육대학", "아트앤멀티미디어음악학부 건반음악전공": "예술체육대학",
    "아트앤멀티미디어음악학부 보컬뮤직전공": "예술체육대학", "아트앤멀티미디어음악학부 작곡전공": "예술체육대학",
    "융합바이오학부 시스템생명과학전공": "화학·생명과학대학", "융합바이오학부 식품영양학전공": "화학·생명과학대학",
    "자연캠퍼스": "교양",
    "전기전자공학부": "반도체·ICT대학", "전기전자공학부 전기공학전공": "반도체·ICT대학",
    "전기전자공학부 전자공학전공": "반도체·ICT대학",
    "제약바이오": "융합전공",
    "컴퓨터정보통신공학부": "반도체·ICT대학", "컴퓨터정보통신공학부 정보통신공학전공": "반도체·ICT대학",
    "컴퓨터정보통신공학부 컴퓨터공학전공": "반도체·ICT대학",
    "화공신소재공학부 신소재공학전공": "스마트시스템공과대학", "화공신소재공학부 화학공학전공": "스마트시스템공과대학",
    "화학·에너지융합학부 융합에너지학전공": "화학·생명과학대학", "화학·에너지융합학부 화학나노학전공": "화학·생명과학대학"
  };

  // 한 CSV 라인 → 필드 배열 (따옴표 안 콤마 처리)
  function parseLine(line) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) {
        if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else {
        if (ch === '"') q = true;
        else if (ch === ',') { out.push(cur); cur = ''; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  // 핵심교양(교선) 4개 영역 — 학수번호 기준 매핑
  var HAEK_SUB = {
    '교선110':'역사와 철학','교선111':'역사와 철학','교선112':'역사와 철학','교선158':'역사와 철학','교선166':'역사와 철학','교선150':'역사와 철학',
    '교선113':'사회와 공동체','교선114':'사회와 공동체','교선142':'사회와 공동체','교선163':'사회와 공동체','교선167':'사회와 공동체','교선168':'사회와 공동체','교선169':'사회와 공동체',
    '교선128':'문화와 예술','교선130':'문화와 예술','교선132':'문화와 예술','교선152':'문화와 예술','교선156':'문화와 예술','교선159':'문화와 예술','교선164':'문화와 예술',
    '교선120':'과학기술과 정보','교선135':'과학기술과 정보','교선162':'과학기술과 정보','교선165':'과학기술과 정보','교선170':'과학기술과 정보','교선172':'과학기술과 정보'
  };

  function classify(code) {
    code = code || '';
    if (code.indexOf('교필') === 0) return { cat: '교양', ar: '공통교양' };
    if (code.indexOf('교선') === 0) return { cat: '교양', ar: '핵심교양', ar2: HAEK_SUB[code] || null };
    if (code.indexOf('균') === 0) return { cat: '교양', ar: '일반교양' };
    return { cat: '전공', ar: null };
  }

  // "월13:00-14:50 (Y117)" → {d,s,e,room}  (없으면 null)
  function parseMeet(cell) {
    if (!cell) return null;
    var m = cell.match(/([월화수목금토일])\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(?:\(([^)]*)\))?/);
    if (!m) return null;
    return {
      d: DAY[m[1]],
      s: (+m[2]) * 60 + (+m[3]),
      e: (+m[4]) * 60 + (+m[5]),
      room: (m[6] || '').trim()
    };
  }

  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  function parseCatalog(text) {
    var lines = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '').split('\n');
    var courses = [], cur = null, sec = null;
    var dept = '', grade = '전학년', cid = 0;

    function pushSection(s) { if (cur) cur.s.push(s); }

    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      if (!line || !line.replace(/,/g, '').trim()) continue;          // 빈 줄
      var f = parseLine(line);
      var col0 = clean(f[0]);

      // 블록 헤더: "2026 학년도 1 학기   <학과/대학>"
      var hm = col0.match(/학기\s+(.+)$/);
      if (hm) { dept = clean(hm[1]); continue; }
      if (col0 === '학년') continue;                                  // 컬럼 헤더
      if (col0.indexOf('강') === 0 && col0.indexOf('의') >= 0) continue; // 제목줄

      var name = clean(f[2]);
      var secNo = clean(f[10]);
      var meetCell = f[12];

      if (col0 && DAY[col0[0]] === undefined && /\d/.test(col0)) grade = col0; // 학년 carry
      else if (col0) grade = col0;

      if (name) {
        // 새 과목
        var code = clean(f[3]);
        var cl = classify(code);
        // 단과대학: 교양은 '교양', 자연캠퍼스 블록의 전공은 '자연캠퍼스', 그 외는 매핑.
        var cg = cl.cat === '교양' ? '교양'
               : (dept === '자연캠퍼스' ? '자연캠퍼스' : (DEPT_COLLEGE[dept] || dept));
        cur = {
          id: 'c' + (cid++), n: name, co: code,
          cr: parseInt(clean(f[6]), 10) || 0,
          dp: dept, cg: cg,
          cat: cl.cat, ar: cl.ar, ar2: cl.ar2 || null, gr: grade, s: []
        };
        courses.push(cur);
        sec = null;
      }

      if (secNo) {
        // 새 분반
        var meet = parseMeet(meetCell);
        sec = {
          sec: secNo, p: clean(f[8]) || (sec && sec.p) || '미정',
          cap: parseInt(clean(f[11]), 10) || 0,
          m: meet ? [[meet.d, meet.s, meet.e, meet.room]] : []
        };
        pushSection(sec);
      } else if (sec && meetCell) {
        // 직전 분반의 추가 교시
        var mt = parseMeet(meetCell);
        if (mt) sec.m.push([mt.d, mt.s, mt.e, mt.room]);
      }
    }
    // 교시 없는 분반(시간 '미입력' 등) 제거 → 분반 0개 과목 제거 → id 재부여
    courses.forEach(function (c) { c.s = c.s.filter(function (s) { return s.m.length > 0; }); });
    courses = courses.filter(function (c) { return c.s.length > 0; });
    courses.forEach(function (c, i) { c.id = 'c' + i; });
    return courses;
  }

  root.parseCatalog = parseCatalog;
  if (typeof module !== 'undefined' && module.exports) module.exports = { parseCatalog: parseCatalog };
})(typeof window !== 'undefined' ? window : globalThis);
