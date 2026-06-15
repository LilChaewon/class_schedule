/* ===== 전역 에러 리포터 — 브라우저 런타임 오류를 Supabase(error_logs)로 전송 =====
 * - SUPABASE_URL / SUPABASE_ANON_KEY 가 없으면 콘솔에만 남기고 조용히 비활성화됩니다.
 * - PostgREST 로 직접 INSERT (의존성 없음). RLS 정책은 anon 의 INSERT 만 허용.
 * - GitHub Actions 의 "오류로그 자동 분석" 워크플로가 이 테이블을 읽어 요약합니다.
 */
(function () {
  var ENV = window.__ENV__ || {};
  var URL_ = ENV.SUPABASE_URL || "";
  var KEY = ENV.SUPABASE_ANON_KEY || "";
  var ENABLED = !!(URL_ && KEY);

  // 동일 오류 폭주 방지: 같은 지문은 세션 내 한 번만, 전체도 상한.
  var seen = {};
  var sent = 0;
  var MAX_PER_SESSION = 50;

  function fingerprint(p) {
    return [p.kind, p.message, p.source, p.line].join("|").slice(0, 300);
  }

  function post(payload) {
    if (!ENABLED) {
      console.warn("[error-reporter] disabled (Supabase 미설정):", payload);
      return;
    }
    if (sent >= MAX_PER_SESSION) return;
    var fp = fingerprint(payload);
    if (seen[fp]) return;
    seen[fp] = true;
    sent++;

    var body = JSON.stringify([{
      kind: payload.kind,
      message: payload.message,
      stack: payload.stack || null,
      source: payload.source || null,
      line: payload.line || null,
      col: payload.col || null,
      url: location.href,
      user_agent: navigator.userAgent,
      app_env: ENV.APP_ENV || "unknown",
      release: ENV.RELEASE || "unknown",
      fingerprint: fp
    }]);

    // keepalive: 페이지 언로드 중에도 전송 시도
    fetch(URL_.replace(/\/$/, "") + "/rest/v1/error_logs", {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        "apikey": KEY,
        "Authorization": "Bearer " + KEY,
        "Prefer": "return=minimal"
      },
      body: body
    }).catch(function (e) {
      console.warn("[error-reporter] 전송 실패:", e);
    });
  }

  window.addEventListener("error", function (e) {
    // 리소스 로드 에러(img/script)와 JS 에러를 구분
    if (e.error || e.message) {
      post({
        kind: "error",
        message: (e.message || "Unknown error"),
        stack: e.error && e.error.stack ? String(e.error.stack) : null,
        source: e.filename || null,
        line: e.lineno || null,
        col: e.colno || null
      });
    }
  });

  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    post({
      kind: "unhandledrejection",
      message: (r && r.message) ? r.message : String(r),
      stack: (r && r.stack) ? String(r.stack) : null
    });
  });

  // 수동 리포팅 훅 (예: 조합 엔진에서 try/catch 후 호출)
  window.reportError = function (err, ctx) {
    post({
      kind: "manual",
      message: (err && err.message) ? err.message : String(err),
      stack: (err && err.stack) ? String(err.stack) : null,
      source: ctx || null
    });
  };

  console.info("[error-reporter] " + (ENABLED ? "활성 (Supabase 연결됨)" : "비활성 (로컬 모드)"));
})();
