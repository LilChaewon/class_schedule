// 최근 에러 로그를 Supabase 에서 읽어 Claude 로 원인 분석 → 요약을 다시 Supabase 에 저장하고
// stdout(=GitHub Actions 잡 요약)으로도 출력합니다. 의존성 없음 (Node 18+ fetch 사용).
//
// 필요한 환경변수:
//   SUPABASE_URL                프로젝트 URL
//   SUPABASE_SERVICE_ROLE_KEY   service_role 키 (읽기·쓰기). CI Secret 으로만 보관.
//   ANTHROPIC_API_KEY           Claude API 키
// 선택:
//   LOOKBACK_HOURS              분석 구간(기본 24)
//   ANTHROPIC_MODEL             기본 claude-opus-4-8

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const LOOKBACK_HOURS = Number(process.env.LOOKBACK_HOURS || 24);
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

function die(msg) { console.error("✗ " + msg); process.exit(1); }
if (!SUPABASE_URL || !SERVICE_KEY) die("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");

const sinceIso = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();

async function fetchErrors() {
  const u = new URL(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/error_logs");
  u.searchParams.set("select", "*");
  u.searchParams.set("created_at", "gte." + sinceIso);
  u.searchParams.set("order", "created_at.desc");
  u.searchParams.set("limit", "500");
  const r = await fetch(u, {
    headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY }
  });
  if (!r.ok) die(`error_logs 조회 실패: ${r.status} ${await r.text()}`);
  return r.json();
}

// fingerprint 별로 묶어 토큰을 아끼고 빈도를 보여줌
function groupByFingerprint(rows) {
  const m = new Map();
  for (const e of rows) {
    const k = e.fingerprint || e.message;
    if (!m.has(k)) m.set(k, { count: 0, sample: e });
    m.get(k).count++;
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

async function analyzeWithClaude(groups, total) {
  if (!ANTHROPIC_API_KEY) {
    return "(ANTHROPIC_API_KEY 미설정 — 빈도 집계만 표시합니다.)";
  }
  const digest = groups.slice(0, 30).map((g, i) => {
    const s = g.sample;
    return `#${i + 1} (${g.count}회) [${s.kind}] ${s.message}\n  source: ${s.source || "-"}:${s.line || "-"}\n  release: ${s.release || "-"} env: ${s.app_env || "-"}\n  stack: ${(s.stack || "").split("\n").slice(0, 4).join(" | ").slice(0, 400)}`;
  }).join("\n\n");

  const prompt = `다음은 "시간표 마법사" 웹앱에서 최근 ${LOOKBACK_HOURS}시간 동안 수집된 브라우저 런타임 오류입니다. ` +
    `총 ${total}건, 지문 기준 ${groups.length}종류입니다.\n\n${digest}\n\n` +
    `한국어로 간결하게: (1) 가장 시급한 오류 Top 3 와 추정 원인, (2) 코드에서 살펴볼 위치/수정 방향, ` +
    `(3) 무시해도 되는 노이즈 구분. 마크다운으로 작성하세요.`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!r.ok) { console.error("Claude API 오류:", r.status, await r.text()); return "(Claude 분석 실패 — 집계만 표시)"; }
  const j = await r.json();
  return (j.content || []).map(b => b.text || "").join("\n");
}

async function saveReport(total, summary) {
  const r = await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/error_reports", {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json", Prefer: "return=minimal"
    },
    body: JSON.stringify([{
      window_from: sinceIso, window_to: new Date().toISOString(),
      error_count: total, summary, model: MODEL
    }])
  });
  if (!r.ok) console.error("error_reports 저장 실패(무시):", r.status, await r.text());
}

const rows = await fetchErrors();
const groups = groupByFingerprint(rows);

let out = `# 🔎 에러 로그 분석 (최근 ${LOOKBACK_HOURS}시간)\n\n`;
out += `- 총 오류: **${rows.length}건**, 종류: **${groups.length}종**\n`;
out += `- 구간: ${sinceIso} ~ now\n\n`;

if (rows.length === 0) {
  out += "✅ 수집된 오류가 없습니다.\n";
  console.log(out);
} else {
  out += "## 빈도 Top 10\n\n| 횟수 | 종류 | 메시지 |\n|---:|---|---|\n";
  for (const g of groups.slice(0, 10)) {
    const s = g.sample;
    out += `| ${g.count} | ${s.kind} | ${String(s.message).replace(/\|/g, "\\|").slice(0, 80)} |\n`;
  }
  out += "\n## 분석\n\n";
  out += await analyzeWithClaude(groups, rows.length);
  out += "\n";
  await saveReport(rows.length, out);
  console.log(out);
}

// GitHub Actions 잡 요약에 기록
if (process.env.GITHUB_STEP_SUMMARY) {
  const fs = await import("node:fs");
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, out);
}
