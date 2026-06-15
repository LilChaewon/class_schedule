/* ===== 관리자 페이지 로직 — 비번 확인 / CSV 파싱·미리보기 / 저장 ===== */
(function () {
  var ENV = window.__ENV__ || {};
  var URL_ = (ENV.SUPABASE_URL || '').replace(/\/$/, '');
  var KEY = ENV.SUPABASE_ANON_KEY || '';
  var pw = '';            // 로그인 성공 시 보관 (저장 RPC 재사용)
  var parsed = null;      // 파싱된 카탈로그

  var $ = function (id) { return document.getElementById(id); };
  function show(el) { el.classList.remove('hide'); }
  function hide(el) { el.classList.add('hide'); }
  function msg(el, text, kind) { el.className = 'msg ' + (kind || ''); el.textContent = text; }
  function clearMsg(el) { el.className = ''; el.textContent = ''; }

  function rpc(fn, body) {
    return fetch(URL_ + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
      body: JSON.stringify(body)
    });
  }

  if (!URL_ || !KEY) {
    msg($('login-msg'), 'Supabase 가 설정되지 않았습니다. 배포 환경변수(SUPABASE_URL/ANON_KEY)를 확인하세요.', 'err');
    $('login-btn').disabled = true;
  }

  // ---- 로그인 ----
  function login() {
    var val = $('pw').value;
    if (!val) return;
    clearMsg($('login-msg'));
    $('login-btn').disabled = true;
    rpc('check_admin', { p_password: val })
      .then(function (r) { return r.json(); })
      .then(function (ok) {
        $('login-btn').disabled = false;
        if (ok === true) {
          pw = val;
          hide($('login-card'));
          show($('current-card'));
          show($('upload-card'));
          loadCurrent();
        } else {
          msg($('login-msg'), '비밀번호가 틀렸어요.', 'err');
        }
      })
      .catch(function () {
        $('login-btn').disabled = false;
        msg($('login-msg'), '확인 중 오류가 발생했어요.', 'err');
      });
  }
  $('login-btn').addEventListener('click', login);
  $('pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });

  // ---- 현재 카탈로그 ----
  function loadCurrent() {
    fetch(URL_ + '/rest/v1/course_catalog?select=label,course_count,created_at&active=eq.true&limit=1',
      { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (rows && rows[0]) {
          var c = rows[0];
          $('current-info').innerHTML = '<b>' + c.label + '</b> · ' + (c.course_count || '?') +
            '과목 · ' + new Date(c.created_at).toLocaleString('ko-KR');
        } else {
          $('current-info').textContent = '아직 업로드된 카탈로그가 없어요. (앱은 기본 내장 데이터 사용 중)';
        }
      })
      .catch(function () { $('current-info').textContent = '불러오기 실패'; });
  }

  // ---- 파일 선택/드롭 ----
  var drop = $('file-drop'), fileInput = $('file');
  drop.addEventListener('click', function () { fileInput.click(); });
  drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; });
  drop.addEventListener('dragleave', function () { drop.style.borderColor = ''; });
  drop.addEventListener('drop', function (e) {
    e.preventDefault(); drop.style.borderColor = '';
    if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', function () { if (fileInput.files[0]) readFile(fileInput.files[0]); });

  function readFile(file) {
    clearMsg($('parse-msg'));
    var reader = new FileReader();
    reader.onload = function () {
      try {
        parsed = window.parseCatalog(reader.result);
        if (!parsed.length) { msg($('parse-msg'), '파싱 결과가 비어 있어요. CSV 형식을 확인하세요.', 'err'); return; }
        renderPreview(file.name);
      } catch (err) {
        msg($('parse-msg'), '파싱 실패: ' + err.message, 'err');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function renderPreview(fname) {
    var sec = 0, major = 0, ge = 0, depts = {};
    parsed.forEach(function (c) {
      sec += c.s.length;
      if (c.cat === '교양') ge++; else major++;
      depts[c.dp] = (depts[c.dp] || 0) + 1;
    });
    $('s-course').textContent = parsed.length;
    $('s-sec').textContent = sec;
    $('s-major').textContent = major;
    $('s-ge').textContent = ge;
    var keys = Object.keys(depts).sort();
    $('dept-list').innerHTML = '<b>학과 ' + keys.length + '개</b>' +
      keys.map(function (d) { return '<div>' + d + ' · ' + depts[d] + '과목</div>'; }).join('');
    msg($('parse-msg'), fname + ' 파싱 완료 — 아래 미리보기 확인 후 저장하세요.', 'ok');
    show($('preview'));
  }

  // ---- 저장 ----
  $('save-btn').addEventListener('click', function () {
    if (!parsed) return;
    var label = ($('label').value || '').trim() || 'untitled';
    clearMsg($('save-msg'));
    $('save-btn').disabled = true;
    rpc('save_catalog', { p_password: pw, p_label: label, p_data: parsed, p_count: parsed.length })
      .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, t: t }; }); })
      .then(function (res) {
        $('save-btn').disabled = false;
        if (res.ok) {
          msg($('save-msg'), '저장 완료! 앱을 새로고침하면 새 데이터가 보여요. (id ' + res.t + ')', 'ok');
          loadCurrent();
        } else {
          msg($('save-msg'), '저장 실패: ' + res.t, 'err');
        }
      })
      .catch(function () { $('save-btn').disabled = false; msg($('save-msg'), '저장 중 오류가 발생했어요.', 'err'); });
  });

  $('reset-btn').addEventListener('click', function () {
    parsed = null; fileInput.value = ''; hide($('preview')); clearMsg($('parse-msg')); clearMsg($('save-msg'));
  });
})();
