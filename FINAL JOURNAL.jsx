import { useState, useEffect } from "react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI"];
const OBP_COMPONENTS = [
  { name: "Model Validity",   max: 3, key: "mv" },
  { name: "Entry Quality",    max: 2, key: "eq" },
  { name: "Risk Discipline",  max: 2, key: "rd" },
  { name: "Trade Management", max: 2, key: "tm" },
  { name: "Emotional Control",max: 1, key: "ec" },
];

const SYSTEM_PROMPT = `You are a strict but supportive NQ futures prop firm risk manager reviewing a trader's daily journal entry. The trader trades ONLY NQ futures on a Tradiefy $25,000 instant funded account.

OBP EXECUTION SCORING SYSTEM (NON-NEGOTIABLE):
- Model Validity: max 3 pts (did trade align with their ATM Model?)
- Entry Quality: max 2 pts (clean entry? hesitation? fear? chasing?)
- Risk Discipline: max 2 pts (within daily loss limit? proper position size?)
- Trade Management: max 2 pts (managed well? premature exit? moved SL?)
- Emotional Control: max 1 pt (calm? revenge? FOMO? payout pressure?)
TOTAL: max 10 pts

CRITICAL OBP RULES:
- Loss + OBP >= 8 = GOOD TRADE
- Win + OBP <= 6 = BAD TRADE
- OBP measures DISCIPLINE not profit
- Daily loss limit: $200 | Account profit target: $26,500 | Max drawdown: $1,500

Your tone: Direct, honest, strict. Reference their exact words.`;

function getISOWeek(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil((((dt - ys) / 86400000) + 1) / 7);
}
function getCurrentWeek() {
  const t = new Date(), mon = new Date(t);
  mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  const w = getISOWeek(mon);
  return `${mon.getFullYear()}-W${w < 10 ? "0" + w : w}`;
}

// ── Color system ──
const C = {
  bg:       "#09080f",
  surface:  "#0f0d1a",
  border:   "#1a2030",
  borderMd: "#1a2030",
  text:     "#e8eaf0",
  muted:    "#3a4a40",
  dim:      "#0a0f0d",
  silver:   "#00c896",
  blue:     "#00a87a",
  amber:    "#e6a817",
  red:      "#e05252",
  slate:    "#4a9e82",
};

const scoreColor = (v, max) => {
  const pct = v / max;
  if (pct >= 0.85) return "#00c896";
  if (pct >= 0.6)  return "#00a87a";
  if (pct >= 0.35) return "#e6a817";
  return "#e05252";
};
const obpBig = (v) => v >= 8 ? "#00c896" : v >= 6 ? "#00a87a" : v >= 4 ? C.amber : C.red;
const gradeC  = (g) => !g || g === "—" ? C.muted : g.startsWith("A") ? "#00c896" : g.startsWith("B") ? "#00a87a" : g === "C" ? C.amber : C.red;
const healthC = (h) => h === "GREEN" ? "#00c896" : h === "AMBER" ? C.amber : C.red;
const pnlC    = (v) => v >= 0 ? "#00c896" : C.red;
const outC    = (o) => o === "Win" ? "#00c896" : o === "Loss" ? C.red : C.amber;

const mono = { fontFamily: "'Space Mono','Courier New',monospace" };
const sans = { fontFamily: "'Inter',system-ui,sans-serif" };

const card = {
  background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 12, padding: "1.25rem", marginBottom: "1rem",
};
const metricCard = {
  background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 10, padding: "0.875rem",
};
const pill = (color) => ({
  ...mono, fontSize: 10, padding: "3px 9px", borderRadius: 20,
  background: color + "18", border: `1px solid ${color}40`,
  color, fontWeight: 700, letterSpacing: "0.05em", display: "inline-block",
});
const secLabel = {
  ...mono, fontSize: 10, color: "#00c896", letterSpacing: "0.1em",
  marginBottom: 10, display: "flex", alignItems: "center", gap: 8,
};
const secLine = { flex: 1, height: 1, background: "#1a2030" };

function fallbackCopy(text) {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
  document.body.appendChild(el);
  el.focus(); el.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(el);
}

// ── OBP Table component ──
function OBPTable({ obpData }) {
  if (!obpData) return null;
  const rows = [
    { name: "Model Validity",    max: 3, score: obpData.mv, note: obpData.mvNote },
    { name: "Entry Quality",     max: 2, score: obpData.eq, note: obpData.eqNote },
    { name: "Risk Discipline",   max: 2, score: obpData.rd, note: obpData.rdNote },
    { name: "Trade Management",  max: 2, score: obpData.tm, note: obpData.tmNote },
    { name: "Emotional Control", max: 1, score: obpData.ec, note: obpData.ecNote },
  ];
  const total = rows.reduce((s, r) => s + (r.score || 0), 0);
  const tColor = obpBig(total);
  const tLabel = total >= 9 ? "ELITE" : total >= 7 ? "GOOD" : total >= 5 ? "AVERAGE" : "POOR";

  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ ...secLabel, marginBottom: 8 }}>OBP EXECUTION SCORE<div style={secLine} /></div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "160px 50px 50px 1fr", background: C.bg, padding: "7px 12px", borderBottom: `1px solid ${C.border}` }}>
          {["Component","Max","Score","Notes"].map(h => (
            <div key={h} style={{ ...mono, fontSize: 9, color: "#5a7080", letterSpacing: "0.07em" }}>{h}</div>
          ))}
        </div>
        {/* Rows */}
        {rows.map((r, i) => {
          const sc = r.score ?? "—";
          const sc_num = typeof sc === "number" ? sc : 0;
          const col = typeof sc === "number" ? scoreColor(sc, r.max) : C.muted;
          const barW = typeof sc === "number" ? Math.round(sc / r.max * 100) : 0;
          return (
            <div key={r.name} style={{ display: "grid", gridTemplateColumns: "160px 50px 50px 1fr", padding: "9px 12px", borderBottom: i < 4 ? `1px solid ${C.border}` : "none", alignItems: "center", background: i % 2 === 0 ? "transparent" : C.bg + "60" }}>
              <div style={{ ...sans, fontSize: 12, color: "#dde1ea" }}>{r.name}</div>
              <div style={{ ...mono, fontSize: 11, color: "#5a6a7a" }}>{r.max}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: col, minWidth: 24 }}>{sc}</div>
                <div style={{ width: 28, height: 3, background: C.dim, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${barW}%`, height: "100%", background: col, borderRadius: 2 }} />
                </div>
              </div>
              <div style={{ ...sans, fontSize: 11, color: "#8fa8b8", lineHeight: 1.4 }}>{r.note || "—"}</div>
            </div>
          );
        })}
        {/* Total row */}
        <div style={{ display: "grid", gridTemplateColumns: "160px 50px 50px 1fr", padding: "10px 12px", background: C.dim, alignItems: "center" }}>
          <div style={{ ...mono, fontSize: 11, fontWeight: 700, color: C.text }}>TOTAL OBP</div>
          <div style={{ ...mono, fontSize: 11, color: C.muted }}>10</div>
          <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: tColor }}>{total}</div>
          <div style={{ ...mono, fontSize: 10, fontWeight: 700, color: tColor, letterSpacing: "0.06em" }}>{tLabel} EXECUTION</div>
        </div>
      </div>
    </div>
  );
}

// ── Parse Trade Breakdown from report text ──
function parseTrade(text) {
  const get = (label) => {
    const m = text.match(new RegExp("\\|\\s*" + label + "\\s*\\|\\s*([^|\\n]+)", "i"));
    return m ? m[1].trim().replace(/\*\*/g, "").replace(/`/g, "") : null;
  };
  return {
    model:      get("Model Used"),
    result:     get("Result"),
    pnl:        get("Net P&L"),
    rrAvail:    get("R:R Available"),
    rrGot:      get("R:R Captured"),
    ptsAvail:   get("Model Pts Available"),
    ptsGot:     get("Pts Extracted"),
    extraction: get("Extraction Efficiency"),
    balance:    get("Account Balance"),
    dailyRule:  get("Daily Loss Rule"),
  };
}

// ── Strip Trade Breakdown table from raw text ──
function stripTradeTable(text) {
  return text
    .replace(/━+\s*\n📈 TRADE BREAKDOWN\s*\n━+[\s\S]*?(?=━━━|$)/i, "")
    .replace(/\| Field \|[\s\S]*?\| Daily Loss Rule \|[^\n]*\n?/i, "")
    .trim();
}

// ── Trade Breakdown Table component ──
function TradeTable({ tradeData }) {
  if (!tradeData) return null;
  const resultColor = (r) => r === "Win" ? C.silver : r === "Loss" ? C.red : r === "BE" ? C.amber : C.slate;
  const ruleColor   = (r) => r && r.includes("SAFE") ? C.silver : C.red;
  const dirColor    = (d) => d === "Long" ? C.silver : d === "Short" ? C.red : C.slate;

  const rows = [
    { label: "Model Used",          value: tradeData.model,      color: tradeData.model?.includes("No Model") ? C.red : C.silver },
    { label: "Result",              value: tradeData.result,     color: resultColor(tradeData.result) },
    { label: "Net P&L",             value: tradeData.pnl,        color: tradeData.pnl?.includes("-") ? C.red : C.silver },
    { label: "R:R Available",       value: tradeData.rrAvail,    color: C.slate },
    { label: "R:R Captured",        value: tradeData.rrGot,      color: C.blue },
    { label: "Model Pts Available", value: tradeData.ptsAvail,   color: C.slate },
    { label: "Pts Extracted",       value: tradeData.ptsGot,     color: C.blue },
    { label: "Extraction Eff",      value: tradeData.extraction, color: (() => { const n = parseFloat(tradeData.extraction); return n >= 70 ? C.silver : n >= 40 ? C.amber : C.red; })() },
    { label: "Account Balance",     value: tradeData.balance,    color: C.slate },
    { label: "Daily Rule",          value: tradeData.dailyRule,  color: ruleColor(tradeData.dailyRule) },
  ].filter(r => r.value);

  if (!rows.length) return null;

  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ ...secLabel, marginBottom: 8 }}>TRADE BREAKDOWN<div style={secLine} /></div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: C.bg, padding: "7px 12px", borderBottom: `1px solid ${C.border}` }}>
          {["Field", "Value"].map(h => (
            <div key={h} style={{ ...mono, fontSize: 9, color: "#5a7080", letterSpacing: "0.07em" }}>{h}</div>
          ))}
        </div>
        {/* Rows */}
        {rows.map((r, i) => (
          <div key={r.label} style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            padding: "8px 12px",
            borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none",
            alignItems: "center",
            background: i % 2 === 0 ? "transparent" : C.bg + "60",
          }}>
            <div style={{ ...sans, fontSize: 12, color: "#7a8fa8" }}>{r.label}</div>
            <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: r.color }}>{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Btn components ──
function Btn({ primary, onClick, disabled, children, small }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...mono, padding: small ? "5px 12px" : "9px 22px",
      fontSize: small ? 10 : 11, cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 700, letterSpacing: "0.05em", borderRadius: 8,
      border: primary ? "none" : `1px solid ${C.borderMd}`,
      background: primary ? (disabled ? C.dim : "#00c896") : "none",
      color: primary ? (disabled ? C.muted : C.bg) : "#2a3a32",
      transition: "all 0.15s", opacity: disabled ? 0.5 : 1,
    }}>{children}</button>
  );
}

function CopyBtn({ text, label = "COPY FOR NOTION" }) {
  const [c, setC] = useState(false);
  return (
    <button onClick={() => { fallbackCopy(text); setC(true); setTimeout(() => setC(false), 2000); }}
      style={{ ...mono, padding: "9px 16px", borderRadius: 8, fontSize: 11, cursor: "pointer",
        fontWeight: 700, letterSpacing: "0.04em",
        background: c ? C.silver + "18" : C.blue + "12",
        border: `1px solid ${c ? C.silver + "40" : C.blue + "40"}`,
        color: c ? C.silver : C.blue, transition: "all 0.15s" }}>
      {c ? "✓ COPIED" : label}
    </button>
  );
}

// ── Parse OBP components from report text ──
function parseOBP(text) {
  const extract = (pattern) => {
    const m = text.match(pattern);
    return m ? parseFloat(m[1]) : null;
  };
  const extractNote = (label) => {
    const m = text.match(new RegExp(`\\|\\s*${label}\\s*\\|[^|]*\\|[^|]*\\|\\s*([^|\\n]+)`, "i"));
    return m ? m[1].trim().replace(/\*\*/g, "") : null;
  };
  return {
    mv:     extract(/Model Validity\s*\|\s*3\s*\|\s*\*?\*?([\d.]+)/i),
    eq:     extract(/Entry Quality\s*\|\s*2\s*\|\s*\*?\*?([\d.]+)/i),
    rd:     extract(/Risk Discipline\s*\|\s*2\s*\|\s*\*?\*?([\d.]+)/i),
    tm:     extract(/Trade Management\s*\|\s*2\s*\|\s*\*?\*?([\d.]+)/i),
    ec:     extract(/Emotional Control\s*\|\s*1\s*\|\s*\*?\*?([\d.]+)/i),
    mvNote: extractNote("Model Validity"),
    eqNote: extractNote("Entry Quality"),
    rdNote: extractNote("Risk Discipline"),
    tmNote: extractNote("Trade Management"),
    ecNote: extractNote("Emotional Control"),
  };
}

// ── Strip OBP table from raw text so it doesn't duplicate ──
function stripOBPTable(text) {
  return text
    .replace(/━+\s*\n📊 OBP EXECUTION SCORE\s*\n━+[\s\S]*?(?=━━━|$)/i, "")
    .replace(/\| Component \|[\s\S]*?\| \*\*TOTAL OBP\*\* \|[^\n]*\n?/i, "")
    .trim();
}



// ══════════════════════════════════════════════════════
// MNQ TRADING SYSTEM — BACKTESTED REFERENCE DATA
// ══════════════════════════════════════════════════════
const TRADING_SYSTEM = {
  stats: {
    modelPresence: 0.55,          // 55% of trading days
    setupsPerYear: 140,
    avgExpansionPts: 138,         // avg MNQ points per model day
    pointValue: 2,                // $2 per MNQ point
    extraction: {
      "20%": { pts: 3864, profit: 7728 },
      "30%": { pts: 5796, profit: 11592 },
      "40%": { pts: 7728, profit: 15456 },
      "50%": { pts: 9660, profit: 19320 },
    },
  },
  targets: {
    obp: 9,
    nonModelTrades: 0,
    extractionMin: 30,
    extractionMax: 50,
    modelDiscipline: 100,
    maxDailyLoss: 200,
    maxTradesPerDay: 3,
    thursdayMaxTrades: 2,
  },
  rules: [
    "Model trades ONLY — no setup = no trade",
    "No trades before the first FVG forms",
    "Never take non-model trades",
    "Real stop loss — never distort stop size",
    "Aim for structured move capture (~100 pts target)",
    "Stop trading after a clean model win",
    "Max 3 trades per day — close platform at 3",
    "Max daily loss $200 — stop immediately at -$200",
    "Thursday protocol: max 2 trades, 30min break after loss",
    "OBP ≥ 8 is the daily goal",
  ],
  mistakes: [
    {
      id: "non_model",
      title: "Non-Model Trade",
      trigger: (e) => e.outsideModel === "YES" || e.tradeData?.model?.includes("No Model"),
      what: "Taking trades outside the defined model. Most loss days come from these.",
      solution: "Only trade valid model setups. Before entry ask: 'Is this a model trade?' If NO → skip.",
      rule: "If the model is not present → NO TRADE DAY.",
    },
    {
      id: "forcing",
      title: "Forcing Trades for Targets/Payout",
      trigger: (e) => e.obp <= 6 && e.outcome === "Win",
      what: "Thinking about money targets during trading. Leads to forcing setups and emotional decisions.",
      solution: "Focus on OBP execution, not profit. Daily goal: OBP ≥ 8.",
      rule: "My job is execution, not profit.",
    },
    {
      id: "overtrading",
      title: "Overtrading After Loss",
      trigger: (e) => e.behaviorEntry?.mistake === "Overtrading" || e.behaviorEntry?.mistake === "Revenge Trade",
      what: "Loss leads to taking more trades trying to recover. Discipline drops.",
      solution: "Maximum 3 trades per day. If trade count reaches 3 → close platform.",
      rule: "Close platform after 3 trades — no exceptions.",
    },
    {
      id: "daily_loss",
      title: "Breaking Daily Loss Limit",
      trigger: (e) => e.pnl <= -200,
      what: "Continuing to trade after hitting max loss.",
      solution: "Maximum daily loss = $200. If PnL reaches -$200 → stop immediately.",
      rule: "Close platform and end the day at -$200.",
    },
    {
      id: "thursday",
      title: "Thursday Discipline Collapse",
      trigger: (e) => e.day === "Thursday" && (e.obp < 7 || e.outsideModel === "YES"),
      what: "Weekly pressure and fatigue affect decision making on Thursdays.",
      solution: "Thursday protocol: only model trades, max 2 trades, 30min break after first loss.",
      rule: "Thursday = extra discipline, not extra trades.",
    },
    {
      id: "chased_entry",
      title: "Chased Entry",
      trigger: (e) => e.behaviorEntry?.mistake === "Chased Entry" || e.behaviorEntry?.mistake === "FOMO Entry",
      what: "Entering after the move has already started, driven by fear of missing out.",
      solution: "Wait for the model setup. If you missed it, the next one is coming. Missing a trade costs nothing.",
      rule: "No FVG formed = no entry. Period.",
    },
    {
      id: "moved_stop",
      title: "Moving Stop Loss",
      trigger: (e) => e.behaviorEntry?.mistake === "Moved Stop",
      what: "Distorting stop size to avoid a loss. Breaks risk discipline completely.",
      solution: "Real stop loss always. If you move the stop, you are no longer trading the model.",
      rule: "Stop is set at entry. It does not move against you.",
    },
    {
      id: "forced_trade",
      title: "Forced Trade on No-Setup Day",
      trigger: (e) => e.behaviorEntry?.mistake === "Forced Trade",
      what: "Trying to trade even when no valid setup exists.",
      solution: "If no setup → no trade. The market decides when you trade.",
      rule: "Reminder: 55% of days have setups. 45% are rest days — use them.",
    },
  ],
  beliefs: [
    "My system has positive expectancy. It needs discipline, not perfection.",
    "Even at 1.5R average wins, my expectancy is strongly positive.",
    "One loss means nothing statistically. Two losses do not invalidate my model.",
    "My edge is WAITING, not predicting.",
    "Consistency > Excitement. Protect big months — do not give them back.",
    "My best months came AFTER a loss, not from avoiding losses.",
    "Losses come from breaking rules — not from the system failing.",
    "Today I trade process — not PnL.",
  ],
  identity: "I am a rule-based trader. I trust data, not feelings. My job is execution, not prediction. Losses do not scare me. Discipline makes me profitable.",
  sessionQuestions: [
    "Is the market clear or choppy?",
    "Am I trading my time window only?",
    "Does this trade match my exact model?",
    "Am I calm, or am I trying to make money fast?",
  ],
  // ── 2025 Backtested Model Presence Data ──
  modelPresenceData: {
    summary: "Selective signal-based system. Fires on ~55% of trading days. Strongest Q3/Q4. Weakest May-June.",
    strengths: ["Nov 70% — best month", "Sep 68% — strong Q3", "Jul 65% — good summer momentum"],
    concerns: ["May 40% — weakest month (choppy markets)", "Jun/Jan ~50% — below average", "Oct W2: 0/5 days — complete blackout week"],
    insight: "Model performs best in directional Q3/Q4 conditions. May-June chop = fewer valid setups. This is by design, not failure.",
    monthly: [
      { month: "Jan", presence: 50, days: "~11/22", note: "Below avg — early year chop" },
      { month: "Feb", presence: 58, days: "~11/19", note: "Recovering" },
      { month: "Mar", presence: 60, days: "~13/21", note: "Solid" },
      { month: "Apr", presence: 55, days: "~11/20", note: "Average" },
      { month: "May", presence: 40, days: "~9/22", note: "Weakest month — low volatility" },
      { month: "Jun", presence: 50, days: "~11/21", note: "Below avg" },
      { month: "Jul", presence: 65, days: "~13/20", note: "Strong Q3 start" },
      { month: "Aug", presence: 60, days: "~13/21", note: "Consistent" },
      { month: "Sep", presence: 68, days: "~14/21", note: "2nd best month" },
      { month: "Oct", presence: 55, days: "~11/20", note: "W2 blackout — investigate" },
      { month: "Nov", presence: 70, days: "~14/20", note: "Best month of year" },
      { month: "Dec", presence: 58, days: "~10/17", note: "Holiday-shortened" },
    ],
    weeklyAlerts: {
      "Oct-W2": { presence: 0, days: "0/5", alert: "Complete signal blackout — check for data gap or market event" },
      "Nov-W3": { presence: 44, days: "4/9", alert: "Possible holiday week or data entry quirk — verify" },
    },
  },
};

// Detect which mistakes are present in an entry
function detectMistakes(entry) {
  return TRADING_SYSTEM.mistakes.filter(m => {
    try { return m.trigger(entry); } catch(e) { return false; }
  });
}

// Get a random belief for the pre-session reminder
function getDailyBelief() {
  const b = TRADING_SYSTEM.beliefs;
  return b[new Date().getDay() % b.length];
}

// ── Equity Curve + Drawdown Chart ──
function Charts({ entries }) {
  // ── ALL HOOKS FIRST — no early returns before hooks ──
  const [hov, setHov] = useState(null);

  const W = 560, EH = 180, DH = 100, PAD = { t:20, r:20, b:30, l:60 };
  const iW = W - PAD.l - PAD.r;

  // Build chronological balance series from all entries
  const sorted = [...entries].sort((a, b) => {
    if (a.week !== b.week) return a.week < b.week ? -1 : 1;
    return a.dayIdx - b.dayIdx;
  });

  // Build equity points: start at 25000
  const startBal = entries.length ? (entries[0].startBalance || 25378) : 25378;
  const points = [{ label:"Start", bal:startBal, pnl:0, dd:0 }];
  let runBal = startBal, peak = startBal;
  sorted.forEach(e => {
    runBal += (e.pnl || 0);
    if (runBal > peak) peak = runBal;
    const dd = ((peak - runBal) / peak) * 100;
    points.push({ label: e.day.slice(0,3).toUpperCase() + " W" + e.week.slice(6), bal: runBal, pnl: e.pnl || 0, dd, week: e.week, dayIdx: e.dayIdx });
  });

  const bals = points.map(p => p.bal);
  const dds  = points.map(p => p.dd);
  const minBal = Math.min(...bals, 24800);
  const maxBal = Math.max(...bals, 25100);
  const maxDD  = Math.max(...dds, 1);

  const eX = (i) => PAD.l + (i / (points.length - 1 || 1)) * iW;
  const eY = (v) => PAD.t + EH - ((v - minBal) / (maxBal - minBal || 1)) * EH;
  const dY = (v) => PAD.t + ((v / (maxDD || 1)) * DH);

  const eLine = points.map((p, i) => `${eX(i).toFixed(1)},${eY(p.bal).toFixed(1)}`).join(" ");
  const eFill = `${eX(0).toFixed(1)},${(PAD.t + EH).toFixed(1)} ` + eLine + ` ${eX(points.length-1).toFixed(1)},${(PAD.t + EH).toFixed(1)}`;
  const dLine = points.map((p, i) => `${eX(i).toFixed(1)},${dY(p.dd).toFixed(1)}`).join(" ");
  const dFill = `${eX(0).toFixed(1)},${PAD.t.toFixed(1)} ` + dLine + ` ${eX(points.length-1).toFixed(1)},${PAD.t.toFixed(1)}`;

  const eTicks = Array.from({length:5},(_,i) => minBal + (maxBal-minBal)*(i/4));
  const dTicks = [0, maxDD*0.5, maxDD];
  const targetY = eY(26500);
  const maxDDVal = Math.max(...dds);
  const limitY   = dY(6);

  // ── Early return AFTER all hooks ──
  if (!sorted.length) return (
    <div style={{ textAlign:"center", padding:"3rem", color:C.muted, ...mono, fontSize:11, letterSpacing:"0.05em" }}>
      NO TRADE DATA YET<br/><span style={{fontSize:9,marginTop:6,display:"block"}}>SAVE ENTRIES TO SEE YOUR EQUITY CURVE</span>
    </div>
  );

  return (
    <div>
      {/* Summary stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:"1rem"}}>
        {[
          { label:"CURRENT BALANCE", val:`$${(points[points.length-1].bal).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`, color: pnlC(points[points.length-1].bal - startBal) },
          { label:"PEAK BALANCE",    val:`$${peak.toLocaleString("en-US",{minimumFractionDigits:2})}`, color:"#00c896" },
          { label:"MAX DRAWDOWN",    val:`${maxDDVal.toFixed(2)}%`, color: maxDDVal>=6?C.red:maxDDVal>=3?C.amber:"#00c896" },
          { label:"TO TARGET",       val:`$${Math.max(0,26500-(points[points.length-1].bal)).toFixed(0)}`, color:C.slate },
        ].map(({label,val,color})=>(
          <div key={label} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"0.875rem"}}>
            <div style={{...mono,fontSize:9,color:C.muted,letterSpacing:"0.08em",marginBottom:5}}>{label}</div>
            <div style={{...mono,fontSize:16,fontWeight:700,color}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Equity Curve */}
      <div style={{...card,marginBottom:"1rem",padding:"1.25rem"}}>
        <div style={{...secLabel,marginBottom:12}}>EQUITY CURVE<div style={secLine}/></div>
        <svg width="100%" viewBox={`0 0 ${W} ${PAD.t + EH + PAD.b}`} style={{overflow:"visible",display:"block"}}>
          <defs>
            <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00c896" stopOpacity="0.25"/>
              <stop offset="100%" stopColor="#00c896" stopOpacity="0.02"/>
            </linearGradient>
            <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e05252" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#e05252" stopOpacity="0.02"/>
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {eTicks.map((v,i) => (
            <line key={i} x1={PAD.l} y1={eY(v).toFixed(1)} x2={W-PAD.r} y2={eY(v).toFixed(1)} stroke="#1a2030" strokeWidth="1"/>
          ))}

          {/* Target line at $26,500 */}
          {targetY > PAD.t && targetY < PAD.t + EH && (
            <>
              <line x1={PAD.l} y1={targetY.toFixed(1)} x2={W-PAD.r} y2={targetY.toFixed(1)} stroke="#00c896" strokeWidth="1" strokeDasharray="4,4" opacity="0.5"/>
              <text x={W-PAD.r+4} y={(targetY+4).toFixed(1)} fill="#00c896" fontSize="8" fontFamily="monospace" opacity="0.7">TARGET</text>
            </>
          )}

          {/* Fill */}
          <polygon points={eFill} fill="url(#eg)"/>
          {/* Line */}
          <polyline points={eLine} fill="none" stroke="#00c896" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>

          {/* Y axis labels */}
          {eTicks.map((v,i) => (
            <text key={i} x={PAD.l-6} y={(eY(v)+4).toFixed(1)} textAnchor="end" fill="#2a3a32" fontSize="9" fontFamily="monospace">
              ${(v/1000).toFixed(1)}k
            </text>
          ))}

          {/* X axis labels — show every N points */}
          {points.map((p,i) => {
            if (i === 0 || i === points.length-1 || (points.length <= 10) || i % Math.ceil(points.length/6) === 0) {
              return (
                <text key={i} x={eX(i).toFixed(1)} y={(PAD.t+EH+18).toFixed(1)} textAnchor="middle" fill="#2a3a32" fontSize="8" fontFamily="monospace">
                  {p.label}
                </text>
              );
            }
            return null;
          })}

          {/* Hover dots */}
          {points.map((p,i) => (
            <circle key={i} cx={eX(i).toFixed(1)} cy={eY(p.bal).toFixed(1)} r="4"
              fill={p.pnl >= 0 ? "#00c896" : "#e05252"} stroke={C.bg} strokeWidth="2"
              style={{cursor:"pointer"}} opacity={hov===i?1:0.6}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
            />
          ))}

          {/* Tooltip */}
          {hov !== null && (() => {
            const p = points[hov];
            const tx = Math.min(eX(hov), W - 130);
            const ty = Math.max(PAD.t + 2, eY(p.bal) - 60);
            return (
              <g>
                <rect x={tx} y={ty} width="120" height="44" rx="6" fill={C.surface} stroke={C.border} strokeWidth="1"/>
                <text x={tx+8} y={ty+14} fill={C.text} fontSize="9" fontFamily="monospace" fontWeight="700">{p.label}</text>
                <text x={tx+8} y={ty+26} fill={pnlC(p.pnl)} fontSize="9" fontFamily="monospace">PnL: {p.pnl>=0?"+":""}${p.pnl}</text>
                <text x={tx+8} y={ty+38} fill="#00c896" fontSize="9" fontFamily="monospace">Bal: ${p.bal.toLocaleString()}</text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Drawdown Chart */}
      <div style={{...card,padding:"1.25rem"}}>
        <div style={{...secLabel,marginBottom:12}}>DRAWDOWN TRACKER<div style={secLine}/></div>
        <svg width="100%" viewBox={`0 0 ${W} ${PAD.t + DH + PAD.b}`} style={{overflow:"visible",display:"block"}}>
          {/* Grid */}
          {dTicks.map((v,i)=>(
            <line key={i} x1={PAD.l} y1={dY(v).toFixed(1)} x2={W-PAD.r} y2={dY(v).toFixed(1)} stroke="#1a2030" strokeWidth="1"/>
          ))}

          {/* Max drawdown limit line — Tradiefy 6% */}
          <line x1={PAD.l} y1={limitY.toFixed(1)} x2={W-PAD.r} y2={limitY.toFixed(1)} stroke="#e05252" strokeWidth="1" strokeDasharray="4,3" opacity="0.7"/>
          <text x={W-PAD.r+4} y={(limitY+4).toFixed(1)} fill="#e05252" fontSize="8" fontFamily="monospace" opacity="0.8">6% LIMIT</text>

          {/* Fill */}
          <polygon points={dFill} fill="url(#dg)"/>
          {/* Line */}
          <polyline points={dLine} fill="none" stroke="#e05252" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>

          {/* Y axis */}
          {dTicks.map((v,i)=>(
            <text key={i} x={PAD.l-6} y={(dY(v)+4).toFixed(1)} textAnchor="end" fill="#2a3a32" fontSize="9" fontFamily="monospace">
              {v.toFixed(1)}%
            </text>
          ))}

          {/* X labels */}
          {points.map((p,i) => {
            if (i === 0 || i === points.length-1 || points.length <= 10 || i % Math.ceil(points.length/6) === 0) {
              return (
                <text key={i} x={eX(i).toFixed(1)} y={(PAD.t+DH+18).toFixed(1)} textAnchor="middle" fill="#2a3a32" fontSize="8" fontFamily="monospace">
                  {p.label}
                </text>
              );
            }
            return null;
          })}

          {/* Dots */}
          {points.map((p,i) => (
            <circle key={i} cx={eX(i).toFixed(1)} cy={dY(p.dd).toFixed(1)} r="3.5"
              fill={p.dd >= 4 ? "#e05252" : p.dd >= 2 ? C.amber : "#00c896"}
              stroke={C.bg} strokeWidth="2" opacity="0.8"
            />
          ))}
        </svg>

        {/* DD legend */}
        <div style={{display:"flex",gap:16,marginTop:8,paddingLeft:PAD.l}}>
          {[
            {color:"#00c896",label:"< 2% — Safe"},
            {color:C.amber,label:"2–4% — Caution"},
            {color:C.red,label:"> 4% — Danger"},
          ].map(({color,label})=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
              <span style={{...mono,fontSize:9,color:C.muted}}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ── Weekly Report UI Component ──
function WeeklyReportUI({ data, week, weekEntries, weekNet, balance, startBalance, toTarget }) {
  if (!data) return null;
  if (data.error) return <div style={{...mono,fontSize:12,color:C.red,padding:"1rem"}}>{data.error}</div>;

  const wins = weekEntries.filter(e=>e.outcome==="Win").length;
  const losses = weekEntries.filter(e=>e.outcome==="Loss").length;
  const totalAvail = weekEntries.reduce((s,e)=>s+(e.ptsAvail||0),0);
  const totalGot   = weekEntries.reduce((s,e)=>s+(e.ptsGot||0),0);
  const avgExt = totalAvail > 0 ? Math.round(totalGot/totalAvail*100) : null;
  const avgObp = weekEntries.length ? (weekEntries.reduce((s,e)=>s+(e.obp||0),0)/weekEntries.length).toFixed(1) : "—";
  const highObp = weekEntries.filter(e=>e.obp>=8).length;
  const expectancy = weekEntries.length ? weekEntries.reduce((s,e)=>s+(e.pnl||0),0)/weekEntries.length : 0;

  const gradeColor = (g) => !g ? C.muted : g.startsWith("A") ? "#00c896" : g.startsWith("B") ? "#00a87a" : g==="C" ? C.amber : C.red;
  const statusColor = (s) => s==="GREEN" ? "#00c896" : s==="AMBER" ? C.amber : C.red;
  const approvalColor = (a) => a==="FULL APPROVAL" ? "#00c896" : a==="REDUCED SIZE" ? C.amber : C.red;

  const TRow = ({label, val, valColor, sub}) => (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",padding:"8px 12px",borderBottom:`1px solid ${C.border}`,alignItems:"center"}}>
      <div style={{...sans,fontSize:12,color:C.muted}}>{label}</div>
      <div>
        <div style={{...mono,fontSize:13,fontWeight:700,color:valColor||C.text}}>{val}</div>
        {sub && <div style={{...mono,fontSize:9,color:C.muted,marginTop:2}}>{sub}</div>}
      </div>
    </div>
  );

  const SectionLabel = ({children}) => (
    <div style={{...secLabel,marginBottom:10}}>{children}<div style={secLine}/></div>
  );

  return (
    <div>
      {/* ── Row 1: Grade + Status + Clearance big pills ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}}>
        <div style={{background:gradeColor(data.weekGrade)+"12",border:`1px solid ${gradeColor(data.weekGrade)}30`,borderRadius:12,padding:"1rem",textAlign:"center"}}>
          <div style={{...mono,fontSize:9,color:C.muted,letterSpacing:"0.08em",marginBottom:6}}>WEEK GRADE</div>
          <div style={{...mono,fontSize:32,fontWeight:700,color:gradeColor(data.weekGrade),lineHeight:1}}>{data.weekGrade}</div>
        </div>
        <div style={{background:statusColor(data.accountStatus)+"12",border:`1px solid ${statusColor(data.accountStatus)}30`,borderRadius:12,padding:"1rem",textAlign:"center"}}>
          <div style={{...mono,fontSize:9,color:C.muted,letterSpacing:"0.08em",marginBottom:6}}>ACCOUNT STATUS</div>
          <div style={{...mono,fontSize:20,fontWeight:700,color:statusColor(data.accountStatus),lineHeight:1}}>{data.accountStatus}</div>
        </div>
        <div style={{background:approvalColor(data.nextWeek)+"12",border:`1px solid ${approvalColor(data.nextWeek)}30`,borderRadius:12,padding:"1rem",textAlign:"center"}}>
          <div style={{...mono,fontSize:9,color:C.muted,letterSpacing:"0.08em",marginBottom:6}}>NEXT WEEK</div>
          <div style={{...mono,fontSize:13,fontWeight:700,color:approvalColor(data.nextWeek),lineHeight:1.2}}>{data.nextWeek}</div>
        </div>
      </div>

      {/* ── Row 2: Two tables side by side ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>

        {/* Left: Weekly Performance Stats */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"1rem"}}>
          <SectionLabel>PERFORMANCE STATS</SectionLabel>
          <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
            <TRow label="Win Rate" val={`${Math.round(wins/(weekEntries.length||1)*100)}%`} valColor={wins>=losses?"#00c896":C.red} sub={`${wins}W · ${losses}L · ${weekEntries.length} days`}/>
            <TRow label="Avg OBP Score" val={`${avgObp}/10`} valColor={obpBig(parseFloat(avgObp))} sub={`${highObp}/${weekEntries.length} high execution days`}/>
            <TRow label="Extraction Eff" val={avgExt!==null?`${avgExt}%`:"—"} valColor={avgExt>=70?"#00c896":avgExt>=40?C.amber:C.red} sub={`${totalGot} / ${totalAvail} pts`}/>
            <TRow label="Net P&L" val={`${weekNet>=0?"+":""}$${weekNet.toFixed(0)}`} valColor={pnlC(weekNet)} sub={`$${balance.toLocaleString()} balance`}/>
            <TRow label="Expectancy" val={`${expectancy>=0?"+":""}$${expectancy.toFixed(0)}`} valColor={pnlC(expectancy)} sub="avg per trading day"/>
            <TRow label="Good Trades" val={`${data.goodTrades||0}`} valColor="#00c896" sub="loss + OBP ≥ 8"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",padding:"8px 12px",alignItems:"center"}}>
              <div style={{...sans,fontSize:12,color:C.muted}}>Bad Trades</div>
              <div><div style={{...mono,fontSize:13,fontWeight:700,color:data.badTrades>0?C.red:"#00c896"}}>{data.badTrades||0}</div><div style={{...mono,fontSize:9,color:C.muted,marginTop:2}}>win + OBP ≤ 6</div></div>
            </div>
          </div>
        </div>

        {/* Right: Day Snapshot */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"1rem"}}>
          <SectionLabel>DAY SNAPSHOT</SectionLabel>
          <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
            {/* Header */}
            <div style={{display:"grid",gridTemplateColumns:"80px 60px 55px 55px 55px",background:C.bg,padding:"6px 10px",borderBottom:`1px solid ${C.border}`}}>
              {["DAY","P&L","OBP","EXT","RESULT"].map(h=><div key={h} style={{...mono,fontSize:8,color:C.muted,letterSpacing:"0.06em"}}>{h}</div>)}
            </div>
            {weekEntries.map((e,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"80px 60px 55px 55px 55px",padding:"7px 10px",borderBottom:i<weekEntries.length-1?`1px solid ${C.border}`:"none",alignItems:"center",background:i%2===0?"transparent":C.bg+"60"}}>
                <div style={{...sans,fontSize:12,color:C.text,fontWeight:500}}>{e.day.slice(0,3)}</div>
                <div style={{...mono,fontSize:11,fontWeight:700,color:pnlC(e.pnl)}}>{e.pnl>=0?"+":""}${e.pnl}</div>
                <div style={{...mono,fontSize:11,fontWeight:700,color:obpBig(e.obp)}}>{e.obp}</div>
                <div style={{...mono,fontSize:11,color:e.extraction>=70?"#00c896":e.extraction>=40?C.amber:C.red}}>{e.extraction?e.extraction+"%":"—"}</div>
                <div><span style={{...mono,fontSize:9,padding:"2px 6px",borderRadius:10,fontWeight:700,background:e.outcome==="Win"?"#00c89618":e.outcome==="Loss"?"#e0525218":"#e6a81718",color:e.outcome==="Win"?"#00c896":e.outcome==="Loss"?C.red:C.amber}}>{e.outcome||"—"}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Best day + Weakest day ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div style={{background:C.surface,border:`1px solid #00c89630`,borderRadius:12,padding:"1rem"}}>
          <SectionLabel>BEST EXECUTION DAY</SectionLabel>
          <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
            <TRow label="Day" val={data.bestDay} valColor="#00c896"/>
            <TRow label="OBP Score" val={`${data.bestDayOBP}/10`} valColor="#00c896"/>
            <div style={{padding:"8px 12px"}}>
              <div style={{...sans,fontSize:12,color:C.muted,marginBottom:4}}>Why</div>
              <div style={{...sans,fontSize:12,color:C.text,lineHeight:1.5}}>{data.bestDayReason}</div>
            </div>
          </div>
        </div>
        <div style={{background:C.surface,border:`1px solid #e0525230`,borderRadius:12,padding:"1rem"}}>
          <SectionLabel>WEAKEST DAY</SectionLabel>
          <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
            <TRow label="Day" val={data.weakestDay} valColor={C.red}/>
            <TRow label="OBP Score" val={`${data.weakestDayOBP}/10`} valColor={C.red}/>
            <div style={{padding:"8px 12px"}}>
              <div style={{...sans,fontSize:12,color:C.muted,marginBottom:4}}>Root cause</div>
              <div style={{...sans,fontSize:12,color:C.text,lineHeight:1.5}}>{data.weakestDayReason}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 4: Psych Pattern + Extraction Analysis ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"1rem"}}>
          <SectionLabel>PSYCHOLOGICAL PATTERN</SectionLabel>
          <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
            <TRow label="Pattern" val={data.psychPattern} valColor={C.amber}/>
            <TRow label="Trigger" val={data.psychTrigger}/>
            <div style={{padding:"8px 12px"}}>
              <div style={{...sans,fontSize:12,color:C.muted,marginBottom:4}}>Fix</div>
              <div style={{...sans,fontSize:12,color:"#00c896",lineHeight:1.5}}>{data.psychFix}</div>
            </div>
          </div>
        </div>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"1rem"}}>
          <SectionLabel>EXTRACTION ANALYSIS</SectionLabel>
          <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
            <TRow label="This week avg" val={avgExt!==null?`${avgExt}%`:"—"} valColor={avgExt>=70?"#00c896":avgExt>=40?C.amber:C.red}/>
            <TRow label="Target next week" val={`${data.extractionTarget}%`} valColor="#00c896"/>
            <TRow label="Pts left on table" val={`${totalAvail-totalGot}`} valColor={C.red} sub={`of ${totalAvail} available`}/>
            <div style={{padding:"8px 12px"}}>
              <div style={{...sans,fontSize:12,color:C.muted,marginBottom:4}}>Why pts left</div>
              <div style={{...sans,fontSize:12,color:C.text,lineHeight:1.5}}>{data.ptsLeftReason}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 5: Focus Points ── */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"1rem",marginBottom:12}}>
        <SectionLabel>TOP 3 FOCUS POINTS NEXT WEEK</SectionLabel>
        <div style={{border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
          {[data.focus1,data.focus2,data.focus3].map((f,i)=>(
            <div key={i} style={{display:"flex",gap:12,padding:"10px 12px",borderBottom:i<2?`1px solid ${C.border}`:"none",alignItems:"flex-start",background:i%2===0?"transparent":C.bg+"60"}}>
              <div style={{...mono,fontSize:11,fontWeight:700,color:"#00c896",minWidth:20}}>{i+1}</div>
              <div style={{...sans,fontSize:12,color:C.text,lineHeight:1.5}}>{f}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Risk Manager Message — data-driven ── */}
      {(() => {
        const bStats = calculateWeeklyStats(weekEntries);
        const dynamicAdvice = generateAdvice(bStats, weekEntries);
        const msg = data.riskManagerMessage || dynamicAdvice;
        return (
          <div style={{borderLeft:`3px solid #00c896`,padding:"12px 16px",background:"#00c89608",borderRadius:"0 10px 10px 0"}}>
            <div style={{...mono,fontSize:9,color:"#00a87a",letterSpacing:"0.08em",marginBottom:6}}>RISK MANAGER SAYS</div>
            <div style={{...sans,fontSize:13,color:C.text,lineHeight:1.6,fontStyle:"italic"}}>"{msg}"</div>
            {bStats?.stability && (
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
                <span style={{...mono,fontSize:9,color:"#3a5060",letterSpacing:"0.06em"}}>OBP STABILITY</span>
                <span style={{...mono,fontSize:11,fontWeight:700,color:parseFloat(bStats.stability)<=1?"#00c896":parseFloat(bStats.stability)<=2?"#e6a817":"#e05252"}}>{bStats.stability}</span>
                <span style={{...sans,fontSize:10,color:"#3a5060"}}>{parseFloat(bStats.stability)<=1?"consistent":"needs improvement"}</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}


// ── Tradovate Analyser — Win Rate + Avg Loss ──
function TradovateTab({ dayIdx, week, entries, persist, setEntries }) {
  const [rawData, setRawData] = useState("");
  const [result, setResult]   = useState(null);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    const entry = entries.find(e => e.week === week && e.dayIdx === dayIdx);
    if (entry?.tradovateRaw) setRawData(entry.tradovateRaw);
    if (entry?.tradovateParsed) setResult(entry.tradovateParsed);
  }, [dayIdx, week, entries]);

  // IST → NY time conversion (IST = UTC+5:30, NY = UTC-5 or UTC-4 DST)
  // IST is 10h30m ahead of EST, 9h30m ahead of EDT
  function istToNY(timeStr) {
    if (!timeStr) return "";
    // Match HH:MM:SS or HH:MM
    const m = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return timeStr;
    let h = parseInt(m[1]), min = parseInt(m[2]);
    // Subtract 10h30m for EST (standard), 9h30m for EDT (summer)
    // Detect DST: roughly Mar second Sun – Nov first Sun
    const now = new Date();
    const mo = now.getMonth() + 1; // 1-12
    const isDST = mo >= 3 && mo <= 11; // approximate
    const offsetMins = isDST ? (9 * 60 + 30) : (10 * 60 + 30);
    let totalMins = h * 60 + min - offsetMins;
    // Handle negative (crosses midnight)
    if (totalMins < 0) totalMins += 24 * 60;
    const nyH = Math.floor(totalMins / 60) % 24;
    const nyM = totalMins % 60;
    const suffix = nyH >= 12 ? "PM" : "AM";
    const h12 = nyH % 12 || 12;
    return `${h12}:${String(nyM).padStart(2,"0")} ${suffix} NY`;
  }

  function analyse(raw) {
    if (!raw.trim()) return null;
    const lines = raw.trim().split("\n").map(l => l.trim()).filter(Boolean);
    const pnls = [];
    const trades = [];
    let headers = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/[\t,]/).map(p => p.trim().replace(/^"|"$/g, ""));
      if (i === 0 && parts.some(p => /time|date|symbol|side|pnl|p.l|profit|fill/i.test(p))) {
        headers = parts.map(p => p.toLowerCase().replace(/[^a-z0-9]/g, ""));
        continue;
      }
      if (parts.length >= 2) {
        let pnlVal = null;
        let timeIST = "";
        let side = "";
        if (headers.length) {
          const obj = {};
          headers.forEach((h, idx) => { obj[h] = parts[idx] || ""; });
          const r = obj.pl || obj.pnl || obj.profit || obj.realizedpnl || obj.netpnl || obj.tradepnl || "";
          if (r) pnlVal = parseFloat(r.replace(/[$,()]/g,"").replace(/^\(/,"-"));
          timeIST = obj.time || obj.datetime || obj.timestamp || obj.filltime || "";
          side = (obj.side || obj.buysell || obj.action || obj.direction || "").toUpperCase();
        } else {
          for (const p of parts) {
            const n = parseFloat(p.replace(/[$,()]/g,"").replace(/^\(/,"-"));
            if (!isNaN(n) && n !== 0 && Math.abs(n) < 50000) { pnlVal = n; break; }
          }
          // Try to find a time pattern in raw parts
          const tp = parts.find(p => /^\d{1,2}:\d{2}/.test(p));
          if (tp) timeIST = tp;
        }
        if (pnlVal !== null && !isNaN(pnlVal) && pnlVal !== 0) {
          pnls.push(pnlVal);
          trades.push({ pnl: pnlVal, timeIST, timeNY: istToNY(timeIST), side });
        }
      }
    }
    if (!pnls.length) return { error: true };
    const wins   = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);
    const total  = pnls.length;
    const winRate    = Math.round(wins.length / total * 100);
    const lossRate   = 100 - winRate;
    const avgWin     = wins.length   ? wins.reduce((s,v)=>s+v,0)/wins.length   : 0;
    const avgLoss    = losses.length ? losses.reduce((s,v)=>s+v,0)/losses.length : 0;
    const netPnl     = pnls.reduce((s,v)=>s+v,0);
    const pf         = losses.length && wins.length ? Math.abs((avgWin*wins.length)/(avgLoss*losses.length)) : 0;
    const expectancy = (winRate/100)*avgWin + (lossRate/100)*avgLoss;
    return { wins:wins.length, losses:losses.length, total, winRate, lossRate, avgWin, avgLoss, netPnl, pf, expectancy, trades };
  }

  function handleAnalyse() { setResult(analyse(rawData)); }

  function saveData() {
    const r = analyse(rawData);
    setResult(r);
    const updated = entries.map(e =>
      e.week === week && e.dayIdx === dayIdx ? { ...e, tradovateRaw: rawData, tradovateParsed: r } : e
    );
    setEntries(updated);
    persist(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const DAY = ["MON","TUE","WED","THU","FRI"][dayIdx];

  return (
    <div>
      <div style={card}>
        <div style={secLabel}>TRADOVATE DATA — {DAY}<div style={secLine}/></div>
        <div style={{...sans, fontSize:11, color:"#7a8fa8", marginBottom:10, lineHeight:1.6}}>
          Paste your fills or P&L export from Tradovate. The analyser will extract your win rate and average loss automatically.
        </div>
        <textarea value={rawData} onChange={e => setRawData(e.target.value)}
          style={{...sans, fontFamily:"monospace", fontSize:12, width:"100%", border:`1px solid ${C.border}`,
            borderRadius:8, padding:"10px 12px", background:C.bg, color:"#dde1ea",
            lineHeight:1.6, resize:"vertical", minHeight:120, outline:"none"}}
          placeholder={"Paste Tradovate fills here — CSV or tab-separated.\n\nExample:\nTime,Side,Qty,Fill Price,P&L\n09:31,BUY,1,18240.00,\n09:35,SELL,1,18265.00,312.50\n09:48,BUY,1,18270.00,\n09:52,SELL,1,18255.00,-187.50"}
        />
        <div style={{display:"flex", gap:8, marginTop:10, alignItems:"center", flexWrap:"wrap"}}>
          <Btn primary onClick={handleAnalyse} disabled={!rawData.trim()}>ANALYSE ↗</Btn>
          {result && !result.error && <Btn onClick={saveData}>SAVE</Btn>}
          <Btn onClick={() => { setRawData(""); setResult(null); }}>CLEAR</Btn>
          {saved && <span style={{...mono, fontSize:10, color:"#00c896", letterSpacing:"0.06em"}}>✓ SAVED</span>}
        </div>
      </div>

      {result?.error && (
        <div style={{...card, textAlign:"center", color:C.red, fontSize:12, padding:"1.25rem"}}>
          Could not find P&L values. Make sure the data includes a P&L or profit column.
        </div>
      )}

      {result && !result.error && (
        <div>
          {/* 2 big hero stats */}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
            <div style={{background:"#111820", border:"1px solid #1e2a38", borderRadius:14, padding:"1.5rem", textAlign:"center"}}>
              <div style={{...mono, fontSize:9, color:"#5a7080", letterSpacing:"0.1em", marginBottom:8}}>WIN RATE</div>
              <div style={{...mono, fontSize:52, fontWeight:700, lineHeight:1, color:result.winRate>=50?"#00c896":C.red}}>
                {result.winRate}%
              </div>
              <div style={{...mono, fontSize:11, color:"#3a4a50", marginTop:8}}>
                {result.wins}W · {result.losses}L · {result.total} trades
              </div>
              <div style={{height:4, background:"#1e2a38", borderRadius:2, marginTop:12, overflow:"hidden"}}>
                <div style={{width:`${result.winRate}%`, height:"100%", background:"#00c896", borderRadius:2}}/>
              </div>
            </div>
            <div style={{background:"#111820", border:"1px solid #1e2a38", borderRadius:14, padding:"1.5rem", textAlign:"center"}}>
              <div style={{...mono, fontSize:9, color:"#5a7080", letterSpacing:"0.1em", marginBottom:8}}>AVG LOSS</div>
              <div style={{...mono, fontSize:52, fontWeight:700, lineHeight:1, color:C.red}}>
                ${Math.abs(result.avgLoss).toFixed(0)}
              </div>
              <div style={{...mono, fontSize:11, color:"#3a4a50", marginTop:8}}>
                avg win ${result.avgWin.toFixed(0)} · ratio {result.avgLoss!==0?Math.abs(result.avgWin/result.avgLoss).toFixed(2):"—"}
              </div>
              <div style={{height:4, background:"#1e2a38", borderRadius:2, marginTop:12, overflow:"hidden"}}>
                <div style={{width:`${Math.min(100,Math.round(Math.abs(result.avgWin)/(Math.abs(result.avgWin)+Math.abs(result.avgLoss)||1)*100))}%`, height:"100%", background:"#00c896", borderRadius:2}}/>
              </div>
            </div>
          </div>

          {/* Supporting stats */}
          <div style={{background:"#111820", border:"1px solid #1e2a38", borderRadius:12, overflow:"hidden", marginBottom:12}}>
            <div style={{background:"#0a0c10", padding:"7px 14px", borderBottom:"1px solid #1e2a38"}}>
              <div style={{...mono, fontSize:9, color:"#5a7080", letterSpacing:"0.08em"}}>BREAKDOWN</div>
            </div>
            {[
              {label:"Net P&L",       val:`${result.netPnl>=0?"+":""}$${result.netPnl.toFixed(2)}`,        color:pnlC(result.netPnl)},
              {label:"Profit Factor", val:result.pf>0?result.pf.toFixed(2):"—",                            color:result.pf>=1.5?"#00c896":result.pf>=1?C.amber:C.red},
              {label:"Expectancy",    val:`${result.expectancy>=0?"+":""}$${result.expectancy.toFixed(2)}`, color:pnlC(result.expectancy)},
              {label:"Loss Rate",     val:`${result.lossRate}%`,                                            color:result.lossRate<=40?"#00a87a":C.red},
            ].map((r,i,arr)=>(
              <div key={r.label} style={{display:"grid", gridTemplateColumns:"1fr 1fr", padding:"9px 14px",
                borderBottom:i<arr.length-1?"1px solid #1e2a38":"none",
                background:i%2===0?"transparent":"#0a0c1060", alignItems:"center"}}>
                <div style={{...sans, fontSize:12, color:"#7a8fa8"}}>{r.label}</div>
                <div style={{...mono, fontSize:13, fontWeight:700, color:r.color}}>{r.val}</div>
              </div>
            ))}
          </div>

          <div style={{borderLeft:`3px solid ${C.amber}`, padding:"10px 14px", background:C.amber+"0a", borderRadius:"0 8px 8px 0"}}>
            <div style={{...mono, fontSize:9, color:C.amber, letterSpacing:"0.08em", marginBottom:4}}>REMEMBER</div>
            <div style={{...sans, fontSize:12, color:"#8fa8b8", lineHeight:1.5}}>
              Win rate is just a number. A loss with OBP ≥ 8 is a good trade.
              A win with OBP ≤ 6 is a bad trade. Compare with your Debrief OBP score for the full picture.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Banner Component ──
function JournalBanner() {
  return (
    <svg width="100%" viewBox="0 0 680 200" xmlns="http://www.w3.org/2000/svg"
      style={{display:"block", marginBottom:"1.5rem", borderRadius:12, overflow:"hidden"}}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#050810"/>
          <stop offset="100%" stopColor="#080c14"/>
        </linearGradient>
        <linearGradient id="pitchg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1a0c"/>
          <stop offset="100%" stopColor="#060e08"/>
        </linearGradient>
        <linearGradient id="fogL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#050810" stopOpacity="0.95"/>
          <stop offset="40%" stopColor="#050810" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#050810" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="fogR" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#050810" stopOpacity="0"/>
          <stop offset="60%" stopColor="#050810" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#050810" stopOpacity="0.95"/>
        </linearGradient>
        <linearGradient id="floodL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="floodR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="glowline" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00c896" stopOpacity="0"/>
          <stop offset="50%" stopColor="#00c896" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#00c896" stopOpacity="0"/>
        </linearGradient>
        <radialGradient id="spotL" cx="25%" cy="0%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.07"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="spotR" cx="75%" cy="0%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.05"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
        <clipPath id="bannerClip"><rect width="680" height="200"/></clipPath>
      </defs>

      <g clipPath="url(#bannerClip)">
        {/* Sky background */}
        <rect width="680" height="200" fill="url(#sky)"/>

        {/* Stadium crowd silhouette — left stand */}
        <path d="M0,0 L0,85 Q20,78 35,82 Q50,76 65,80 Q80,72 95,77 Q110,68 130,74 Q150,62 170,70 Q190,58 210,65 Q230,52 250,60 Q270,48 290,55 Q310,45 340,50 L340,0 Z"
          fill="#0a0f1a"/>
        {/* crowd texture dots left */}
        {[20,45,70,95,120,145,170,195,220,250,280,310].map((x,i)=>(
          <g key={i}>
            <circle cx={x} cy={60+(i%3)*5} r="1.5" fill="#1a2535" opacity="0.8"/>
            <circle cx={x+12} cy={55+(i%4)*4} r="1" fill="#151e2e" opacity="0.6"/>
            <circle cx={x+6} cy={65+(i%3)*4} r="1.5" fill="#1a2535" opacity="0.7"/>
          </g>
        ))}

        {/* Stadium crowd silhouette — right stand */}
        <path d="M340,0 L340,50 Q370,45 400,48 Q430,42 460,46 Q490,38 520,44 Q550,35 580,42 Q610,30 640,38 Q660,28 680,34 L680,0 Z"
          fill="#0a0f1a"/>
        {/* crowd texture dots right */}
        {[350,375,400,425,450,475,500,525,550,575,605,635].map((x,i)=>(
          <g key={i}>
            <circle cx={x} cy={28+(i%3)*5} r="1.5" fill="#1a2535" opacity="0.8"/>
            <circle cx={x+10} cy={22+(i%4)*4} r="1" fill="#151e2e" opacity="0.6"/>
            <circle cx={x+5} cy={35+(i%3)*3} r="1.5" fill="#1a2535" opacity="0.7"/>
          </g>
        ))}

        {/* Spotlight glow from floodlights */}
        <rect width="680" height="200" fill="url(#spotL)"/>
        <rect width="680" height="200" fill="url(#spotR)"/>

        {/* Floodlight poles — left */}
        <rect x="58" y="0" width="3" height="55" fill="#0d1520" opacity="0.9"/>
        <rect x="56" y="0" width="7" height="4" rx="1" fill="#1a2535"/>
        <ellipse cx="59" cy="2" rx="10" ry="4" fill="#ffffff" opacity="0.55"/>
        <line x1="59" y1="4" x2="59" y2="88" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="40"/>

        <rect x="132" y="0" width="2.5" height="42" fill="#0d1520" opacity="0.8"/>
        <ellipse cx="133" cy="1" rx="7" ry="3" fill="#ffffff" opacity="0.4"/>
        <line x1="133" y1="3" x2="133" y2="88" stroke="#ffffff" strokeOpacity="0.03" strokeWidth="30"/>

        {/* Floodlight poles — right */}
        <rect x="555" y="0" width="2.5" height="48" fill="#0d1520" opacity="0.8"/>
        <ellipse cx="556" cy="1" rx="8" ry="3" fill="#ffffff" opacity="0.45"/>
        <line x1="556" y1="3" x2="556" y2="88" stroke="#ffffff" strokeOpacity="0.03" strokeWidth="35"/>

        <rect x="620" y="0" width="3" height="38" fill="#0d1520" opacity="0.9"/>
        <ellipse cx="621" cy="1" rx="9" ry="3.5" fill="#ffffff" opacity="0.5"/>
        <line x1="621" y1="3" x2="621" y2="88" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="30"/>

        {/* Pitch — perspective */}
        <path d="M0,88 L680,88 L680,200 L0,200 Z" fill="url(#pitchg)"/>

        {/* Pitch lines — perspective stripes */}
        {[0,1,2,3,4,5,6].map((i)=>{
          const y1=88, y2=200;
          const x = 340 + (i-3)*95;
          const xb = 340 + (i-3)*180;
          return <line key={i} x1={x} y1={y1} x2={xb} y2={y2} stroke="#0f2010" strokeWidth="1.2" opacity="0.7"/>;
        })}
        {/* Horizontal lines — distance perspective */}
        {[0.15,0.3,0.5,0.72,1].map((t,i)=>{
          const y = 88 + t*112;
          const shrink = t*0.3;
          return <line key={i} x1={shrink*680*0.2} y1={y} x2={680-shrink*680*0.2} y2={y} stroke="#0f2010" strokeWidth="0.8" opacity="0.6"/>;
        })}

        {/* Centre circle */}
        <ellipse cx="340" cy="180" rx="55" ry="12" fill="none" stroke="#0f2010" strokeWidth="1" opacity="0.5"/>
        {/* Centre spot */}
        <circle cx="340" cy="180" r="2.5" fill="#0f2010" opacity="0.6"/>
        {/* Halfway line */}
        <line x1="0" y1="88" x2="680" y2="88" stroke="#0f2010" strokeWidth="1" opacity="0.4"/>

        {/* Fog overlay */}
        <rect width="680" height="200" fill="url(#fogL)"/>
        <rect width="680" height="200" fill="url(#fogR)"/>

        {/* Atmosphere haze over pitch */}
        <rect x="0" y="88" width="680" height="60" fill="#050810" opacity="0.35"/>

        {/* Teal accent floor line */}
        <line x1="0" y1="89" x2="680" y2="89" stroke="url(#glowline)" strokeWidth="1.5"/>

        {/* ── MAIN TEXT ── */}
        {/* TRUST THE PROCESS — big */}
        <text x="340" y="138"
          fontFamily="'Space Mono',monospace"
          fontSize="30" fontWeight="700"
          textAnchor="middle"
          letterSpacing="0.14em"
          fill="#ffffff" opacity="0.92">
          TRUST THE PROCESS
        </text>

        {/* Teal underline accent */}
        <rect x="220" y="146" width="240" height="1.5" fill="#00c896" opacity="0.7"/>
        <rect x="290" y="149" width="100" height="1" fill="#00c896" opacity="0.35"/>

        {/* Subtext */}
        <text x="340" y="166"
          fontFamily="'Space Mono',monospace"
          fontSize="9"
          textAnchor="middle"
          letterSpacing="0.18em"
          fill="#00c896" opacity="0.6">
          DISCIPLINE · EXECUTION · PATIENCE · CONSISTENCY
        </text>

        {/* Top badge */}
        <rect x="270" y="12" width="140" height="18" rx="3"
          fill="#00c896" fillOpacity="0.06"
          stroke="#00c896" strokeOpacity="0.2" strokeWidth="0.5"/>
        <text x="340" y="24"
          fontFamily="'Space Mono',monospace"
          fontSize="8" fontWeight="700"
          textAnchor="middle"
          letterSpacing="0.12em"
          fill="#00c896" opacity="0.65">
          NQ RISK MANAGER JOURNAL
        </text>

        {/* Corner label left */}
        <text x="24" y="185"
          fontFamily="'Space Mono',monospace"
          fontSize="8"
          letterSpacing="0.1em"
          fill="#1e3020" opacity="0.9">
          TRADIEFY · MNQ · $25K
        </text>

        {/* Corner label right */}
        <text x="656" y="185"
          fontFamily="'Space Mono',monospace"
          fontSize="8"
          textAnchor="end"
          letterSpacing="0.08em"
          fill="#1e3020" opacity="0.9">
          ATM MODEL · OBP SYSTEM
        </text>

        {/* Top/bottom border */}
        <line x1="0" y1="0" x2="680" y2="0" stroke="#00c896" strokeOpacity="0.1" strokeWidth="1"/>
        <line x1="0" y1="199" x2="680" y2="199" stroke="#00c896" strokeOpacity="0.06" strokeWidth="1"/>

      </g>
    </svg>
  );
}







// ── Behavior utility functions ──
function classifyOBP(obp) {
  const n = Number(obp);
  if (n >= 8) return { label: "High Discipline",       color: "#00c896" };
  if (n >= 6) return { label: "Acceptable Execution",  color: "#00a87a" };
  if (n >= 4) return { label: "Multiple Mistakes",     color: "#e6a817" };
  return              { label: "Emotional Trading",     color: "#e05252" };
}

function checkNonModelTrade(entry) {
  if (entry.modelPresent === "NO" && entry.outsideModel === "YES")
    return "⚠ Non-model trade detected — no setup, no trade";
  if (entry.modelPresent === "YES" && entry.outsideModel === "YES")
    return "⚠ Model present but traded outside it — rule breach";
  return "";
}

function calculateStability(obpList) {
  if (!obpList.length) return "—";
  const avg = obpList.reduce((a, b) => a + b, 0) / obpList.length;
  const variance = obpList.reduce((sum, val) => sum + (val - avg) ** 2, 0) / obpList.length;
  return Math.sqrt(variance).toFixed(2);
}

function generateAdvice(stats, weekEntries) {
  if (!stats) return "Log more entries to generate advice.";
  const avgO = parseFloat(stats.avgOBP);
  const nonModel = weekEntries.filter(e => e.behaviorEntry?.outsideModel === "YES" || e.tradeData?.model?.includes("No Model")).length;
  const totalAvail = weekEntries.reduce((s, e) => s + (e.ptsAvail || 0), 0);
  const totalGot   = weekEntries.reduce((s, e) => s + (e.ptsGot  || 0), 0);
  const extraction = totalAvail > 0 ? Math.round(totalGot / totalAvail * 100) : null;

  if (nonModel > 0)
    return `Non-model trade detected this week. Zero tolerance — every non-model trade is a direct attack on your edge. Next week: no setup, no trade. Period.`;
  if (stats.topMistake === "Early Exit" || stats.topMistake === "Forced Trade" && extraction !== null && extraction < 35)
    return `Early exits are your biggest edge leak — you left ${totalAvail - totalGot} points on the table. Treat an early exit the same as a losing trade. Set your exit at entry and do not move it.`;
  if (stats.topMistake === "Revenge Trade" || stats.topMistake === "Overtrading")
    return `Overtrading is destroying your edge. Maximum 3 trades per day. After a loss, pause 30 minutes. Your system wins — your emotions do not.`;
  if (stats.topMistake === "Moved Stop")
    return `You moved your stop this week. This is the single most dangerous habit in your system. A stop that moves is not a stop — it is hope. Fix this before it becomes a pattern.`;
  if (avgO < 7)
    return `Execution discipline is slipping — avg OBP ${stats.avgOBP}/10. Reduce trade frequency, slow down your entries, and focus on quality over quantity next week.`;
  if (stats.modelDiscipline < 100)
    return `Model discipline at ${stats.modelDiscipline}% — not 100%. Every session that has no model setup is a rest day, not a trading day. Your edge lives in the model.`;
  if (extraction !== null && extraction < 35)
    return `Win rate is strong but extraction is only ${extraction}%. You are finding the right trades but leaving too early. One more R on each trade compounds into thousands over the year.`;
  if (stats.stability && parseFloat(stats.stability) > 2)
    return `OBP stability is ${stats.stability} — too much variation in execution quality. Pick one rule to focus on and apply it every single trade until it becomes automatic.`;
  if (avgO >= 9 && stats.modelDiscipline === 100)
    return `Elite week — avg OBP ${stats.avgOBP}, full model discipline, zero rule breaches. This is what your system looks like when you trust it. Replicate this process, not the result.`;
  return `Execution discipline strong this week. Avg OBP ${stats.avgOBP}/10, model discipline ${stats.modelDiscipline}%. Focus on extraction efficiency — that is where your next level of growth lives.`;
}

function calculateWeeklyStats(entries) {
  const valid = entries.filter(e => e.behaviorEntry && e.behaviorEntry.obp !== "");
  if (!valid.length) return null;
  let totalOBP = 0, highOBP = 0, lowOBP = 0, modelDiscipline = 0;
  const mistakes = {};
  const obpList = [];
  valid.forEach(e => {
    const b = e.behaviorEntry;
    const obp = Number(b.obp);
    totalOBP += obp;
    obpList.push(obp);
    if (obp >= 8) highOBP++;
    if (obp < 6)  lowOBP++;
    if (b.outsideModel === "NO") modelDiscipline++;
    if (b.mistake && b.mistake !== "None")
      mistakes[b.mistake] = (mistakes[b.mistake] || 0) + 1;
  });
  const avgOBP = (totalOBP / valid.length).toFixed(2);
  const topMistake = Object.keys(mistakes).length
    ? Object.keys(mistakes).reduce((a, b) => mistakes[a] > mistakes[b] ? a : b)
    : "None";
  const stability = calculateStability(obpList);
  return {
    avgOBP, highOBP, lowOBP, stability,
    modelDiscipline: Math.round((modelDiscipline / valid.length) * 100),
    topMistake, total: valid.length,
  };
}

// ── Behavior Insights helper ──
function BehaviorInsights({ entry }) {
  const classify = classifyOBP(entry.obp);
  const warning  = checkNonModelTrade(entry);

  const rows = [
    { label: "Behavior State",    val: classify.label,      color: classify.color },
    { label: "Model Present",     val: entry.modelPresent,  color: entry.modelPresent === "YES" ? "#00c896" : "#e05252" },
    { label: "Outside Model",     val: entry.outsideModel,  color: entry.outsideModel === "YES" ? "#e05252" : "#00c896" },
    { label: "Main Mistake",      val: entry.mistake,       color: entry.mistake === "None" ? "#00c896" : "#e6a817" },
  ];

  return (
    <div style={{ marginTop: 10 }}>
      {warning && (
        <div style={{ ...mono, fontSize: 11, color: "#e05252", background: "#e0525210", border: "1px solid #e0525240", borderRadius: 8, padding: "8px 12px", marginBottom: 8, letterSpacing: "0.02em" }}>
          {warning}
        </div>
      )}
      <div style={{ border: "1px solid #1e2a38", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ background: "#0a0c10", padding: "6px 12px", borderBottom: "1px solid #1e2a38" }}>
          <div style={{ ...mono, fontSize: 9, color: "#5a7080", letterSpacing: "0.07em" }}>BEHAVIOR ANALYSIS</div>
        </div>
        {rows.map((r, i) => (
          <div key={r.label} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "9px 12px", borderBottom: i < rows.length - 1 ? "1px solid #1e2a38" : "none", alignItems: "center", background: i % 2 === 0 ? "transparent" : "#0a0c1060" }}>
            <div style={{ ...sans, fontSize: 12, color: "#7a8fa8" }}>{r.label}</div>
            <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: r.color }}>{r.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Behavior Journal Entry Form ──
function BehaviorEntryForm({ dayIdx, week, entries, persist, setEntries }) {
  const DAY_LABELS = ["MON","TUE","WED","THU","FRI"];
  const [saved, setSaved] = useState(false);

  const existing = entries.find(e => e.week === week && e.dayIdx === dayIdx);
  const [entry, setEntry] = useState({
    obp: existing?.behaviorEntry?.obp || existing?.obp || "",
    modelPresent: existing?.behaviorEntry?.modelPresent || "YES",
    outsideModel: existing?.behaviorEntry?.outsideModel || "NO",
    mistake: existing?.behaviorEntry?.mistake || "None",
    notes: existing?.behaviorEntry?.notes || "",
  });

  useEffect(() => {
    const ex = entries.find(e => e.week === week && e.dayIdx === dayIdx);
    if (ex?.behaviorEntry) setEntry(ex.behaviorEntry);
    else if (ex?.obp) setEntry(prev => ({ ...prev, obp: ex.obp }));
  }, [dayIdx, week, entries]);

  function handleChange(e) {
    setEntry(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function save() {
    const updated = entries.map(e => {
      if (e.week === week && e.dayIdx === dayIdx) return { ...e, behaviorEntry: entry };
      return e;
    });
    setEntries(updated);
    persist(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const fieldStyle = {
    ...mono, fontSize: 12, width: "100%", background: "#0a0c10",
    border: "1px solid #1e2a38", borderRadius: 6, padding: "7px 10px",
    color: "#e8eaf0", outline: "none",
  };
  const selectStyle = { ...fieldStyle, cursor: "pointer", appearance: "none" };
  const labelStyle = { ...mono, fontSize: 9, color: "#5a7080", letterSpacing: "0.08em", marginBottom: 5, display: "block" };

  return (
    <div style={{ background: "#111820", border: "1px solid #1e2a38", borderRadius: 12, padding: "1.25rem", marginBottom: 12 }}>
      <div style={{ ...secLabel, marginBottom: 14 }}>
        BEHAVIOR ENTRY — {DAY_LABELS[dayIdx]}<div style={secLine} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 12 }}>
        {/* OBP */}
        <div>
          <label style={labelStyle}>OBP SCORE (0–10)</label>
          <input type="number" name="obp" min="0" max="10" value={entry.obp}
            onChange={handleChange} style={fieldStyle} placeholder="e.g. 7.5" />
        </div>

        {/* Model Present */}
        <div>
          <label style={labelStyle}>MODEL PRESENT</label>
          <select name="modelPresent" value={entry.modelPresent} onChange={handleChange} style={selectStyle}>
            <option>YES</option>
            <option>NO</option>
          </select>
        </div>

        {/* Outside Model */}
        <div>
          <label style={labelStyle}>TRADED OUTSIDE MODEL</label>
          <select name="outsideModel" value={entry.outsideModel} onChange={handleChange} style={selectStyle}>
            <option>NO</option>
            <option>YES</option>
          </select>
        </div>

        {/* Mistake */}
        <div>
          <label style={labelStyle}>MAIN MISTAKE</label>
          <select name="mistake" value={entry.mistake} onChange={handleChange} style={selectStyle}>
            <option>None</option>
            <option>Forced Trade</option>
            <option>Chased Entry</option>
            <option>Moved Stop</option>
            <option>Overtrading</option>
            <option>Revenge Trade</option>
            <option>Early Exit</option>
            <option>FOMO Entry</option>
            <option>Ignored Setup Rules</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>BEHAVIORAL NOTES</label>
        <textarea name="notes" value={entry.notes} onChange={handleChange}
          style={{ ...fieldStyle, resize: "vertical", minHeight: 70, lineHeight: 1.6, fontFamily: "'Inter',sans-serif", fontSize: 12 }}
          placeholder="What was your mental state? Any patterns you noticed today..." />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Btn primary onClick={save}>SAVE ENTRY</Btn>
        {saved && <span style={{ ...mono, fontSize: 10, color: "#00c896", letterSpacing: "0.06em" }}>✓ SAVED</span>}
      </div>

      {entry.obp !== "" && <BehaviorInsights entry={entry} />}
    </div>
  );
}

// ── Weekly Behavior Summary ──
function WeekBehaviorSummary({ weekEntries }) {
  const stats = calculateWeeklyStats(weekEntries);
  const withBehavior = weekEntries.filter(e => e.behaviorEntry);
  if (!stats || !withBehavior.length) return null;

  const outsideDays = withBehavior.filter(e => e.behaviorEntry.outsideModel === "YES").length;
  const mistakeCounts = withBehavior.reduce((acc, e) => {
    const m = e.behaviorEntry.mistake;
    if (m && m !== "None") acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});
  const classify = classifyOBP(stats.avgOBP);

  const Stat = ({ label, val, color, sub }) => (
    <div style={{ background: "#0a0c10", border: "1px solid #1e2a38", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ ...mono, fontSize: 9, color: "#5a7080", letterSpacing: "0.08em", marginBottom: 5 }}>{label}</div>
      <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: color || "#e8eaf0", lineHeight: 1 }}>{val}</div>
      {sub && <div style={{ ...mono, fontSize: 9, color: "#3a4a50", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ background: "#111820", border: "1px solid #1e2a38", borderRadius: 12, padding: "1.25rem", marginBottom: 12 }}>
      <div style={{ ...secLabel, marginBottom: 14 }}>WEEKLY BEHAVIOR METRICS<div style={secLine} /></div>

      {/* Row 1 — 4 stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 10 }}>
        <Stat label="AVERAGE OBP"       val={stats.avgOBP}                  color={classify.color}                                            sub={`${stats.total} days logged`} />
        <Stat label="HIGH OBP DAYS ≥8"  val={`${stats.highOBP}/${stats.total}`} color="#00c896"                                              sub="high discipline days" />
        <Stat label="LOW OBP DAYS <6"   val={`${stats.lowOBP}/${stats.total}`}  color={stats.lowOBP > 0 ? "#e05252" : "#00c896"}             sub="emotional/mistake days" />
        <Stat label="MODEL DISCIPLINE"  val={`${stats.modelDiscipline}%`}   color={stats.modelDiscipline === 100 ? "#00c896" : stats.modelDiscipline >= 80 ? "#00a87a" : "#e6a817"} sub="within rules" />
        <Stat label="OBP STABILITY" val={stats.stability||"—"} color={!stats.stability?"#3a5060":parseFloat(stats.stability)<=1?"#00c896":parseFloat(stats.stability)<=2?"#e6a817":"#e05252"} sub="lower = consistent" />
      </div>

      {/* Row 2 — 3 stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
        <Stat label="BEHAVIOR STATE"    val={classify.label}                color={classify.color}                                            sub="based on avg OBP" />
        <Stat label="OUTSIDE MODEL"     val={`${outsideDays}/${stats.total}`} color={outsideDays === 0 ? "#00c896" : "#e05252"}             sub="rule breach days" />
        <Stat label="TOP MISTAKE"       val={stats.topMistake}              color={stats.topMistake === "None" ? "#00c896" : "#e6a817"}       sub="most common this week" />
      </div>

      {/* Mistake frequency table */}
      {Object.keys(mistakeCounts).length > 0 && (
        <div style={{ border: "1px solid #1e2a38", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ background: "#0a0c10", padding: "7px 12px", borderBottom: "1px solid #1e2a38", display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ ...mono, fontSize: 9, color: "#5a7080", letterSpacing: "0.07em" }}>MISTAKE FREQUENCY</div>
            <div style={{ flex: 1, height: 1, background: "#1e2a38" }} />
          </div>
          {Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1]).map(([m, count], i, arr) => (
            <div key={m} style={{ display: "grid", gridTemplateColumns: "1fr 50px 140px", padding: "8px 12px", borderBottom: i < arr.length - 1 ? "1px solid #1e2a38" : "none", alignItems: "center", background: i % 2 === 0 ? "transparent" : "#0a0c1060" }}>
              <div style={{ ...sans, fontSize: 12, color: "#dde1ea" }}>{m}</div>
              <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: "#e6a817" }}>{count}x</div>
              <div style={{ height: 4, background: "#1e2a38", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${Math.round(count / stats.total * 100)}%`, height: "100%", background: "#e6a817", borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per-day notes */}
      {withBehavior.filter(e => e.behaviorEntry?.notes).length > 0 && (
        <div>
          <div style={{ ...mono, fontSize: 9, color: "#5a7080", letterSpacing: "0.08em", marginBottom: 8 }}>DAY NOTES</div>
          {withBehavior.filter(e => e.behaviorEntry?.notes).map(e => (
            <div key={e.dayIdx} style={{ borderLeft: "2px solid #1e2a38", paddingLeft: 10, marginBottom: 8 }}>
              <div style={{ ...mono, fontSize: 9, color: "#00c896", marginBottom: 3 }}>{e.day.toUpperCase()}</div>
              <div style={{ ...sans, fontSize: 12, color: "#7a8fa8", lineHeight: 1.5 }}>{e.behaviorEntry.notes}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Full Behavior Research Tab ──
function BehaviorResearch({ entries, week, weekEntries, persist, setEntries }) {
  const [activeDay, setActiveDay] = useState(0);

  const filledDays = weekEntries.filter(e => e.behaviorEntry && e.behaviorEntry.obp !== "").length;

  return (
    <div>
      {/* Header */}
      <div style={{ background: "#111820", border: "1px solid #1e2a38", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ ...mono, fontSize: 9, color: "#00c896", letterSpacing: "0.1em", marginBottom: 4 }}>BEHAVIOUR RESEARCH</div>
          <div style={{ ...sans, fontSize: 12, color: "#7a8fa8" }}>Fill in each trading day below. Your weekly behavior metrics will appear in the Weekly Report.</div>
        </div>
        <div style={{ background: filledDays === 5 ? "#00c89618" : "#1e2a38", border: `1px solid ${filledDays === 5 ? "#00c89640" : "#2a3a48"}`, borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
          <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: filledDays === 5 ? "#00c896" : "#7a8fa8" }}>{filledDays}/5</div>
          <div style={{ ...mono, fontSize: 8, color: "#3a4a50", marginTop: 2, letterSpacing: "0.06em" }}>DAYS FILLED</div>
        </div>
      </div>

      {/* Day selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {["MON","TUE","WED","THU","FRI"].map((d, i) => {
          const has = weekEntries.some(e => e.dayIdx === i && e.behaviorEntry);
          const act = activeDay === i;
          return (
            <button key={d} onClick={() => setActiveDay(i)} style={{
              ...mono, padding: "6px 16px", fontSize: 11, borderRadius: 6, cursor: "pointer",
              border: `1px solid ${act ? "#00c896" : has ? "#00c89640" : "#1e2a38"}`,
              background: act ? "#00c896" : "none",
              color: act ? "#0a0c10" : has ? "#00c896" : "#3a4a50",
              fontWeight: act ? 700 : 400, letterSpacing: "0.06em", transition: "all 0.12s",
            }}>{d}</button>
          );
        })}
      </div>

      {/* Day entry form */}
      <BehaviorEntryForm
        dayIdx={activeDay}
        week={week}
        entries={entries}
        persist={persist}
        setEntries={setEntries}
      />
    </div>
  );
}


// ── System Reference Component ──
function SystemReference({ entries, weekEntries }) {
  const [section, setSection] = useState("alert");

  // Detect current issues from this week's entries
  const weekMistakes = [];
  weekEntries.forEach(e => {
    detectMistakes(e).forEach(m => {
      if (!weekMistakes.find(x => x.id === m.id))
        weekMistakes.push({ ...m, day: e.day });
    });
  });

  const sys = TRADING_SYSTEM;
  const totalEntries = entries.length;
  const nonModelCount = entries.filter(e => e.tradeData?.model?.includes("No Model") || e.behaviorEntry?.outsideModel === "YES").length;
  const highObpCount  = entries.filter(e => e.obp >= 8).length;
  const avgObpAll     = totalEntries ? (entries.reduce((s,e)=>s+(e.obp||0),0)/totalEntries).toFixed(1) : "—";

  const sections = [
    ["alert",    "⚠ ALERTS"],
    ["rules",    "RULES"],
    ["stats",    "SYSTEM STATS"],
    ["presence", "MODEL DATA"],
    ["mindset",  "MINDSET"],
    ["session",  "PRE-SESSION"],
    ["mistakes", "MISTAKES"],
  ];

  const SecBtn = ({id, label}) => (
    <button onClick={() => setSection(id)} style={{
      ...mono, padding: "6px 14px", fontSize: 10, borderRadius: 6, cursor: "pointer",
      border: `1px solid ${section===id ? "#00c896" : "#1e2a38"}`,
      background: section===id ? "#00c896" : "none",
      color: section===id ? "#0a0c10" : "#3a5060",
      fontWeight: section===id ? 700 : 400, letterSpacing: "0.06em", transition: "all 0.12s",
    }}>{label}{id==="alert" && weekMistakes.length > 0 ? ` (${weekMistakes.length})` : ""}</button>
  );

  const Card = ({children, accent}) => (
    <div style={{ background: "#111820", border: `1px solid ${accent||"#1e2a38"}`, borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 10 }}>
      {children}
    </div>
  );

  const Row = ({label, val, color}) => (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", padding:"8px 12px", borderBottom:"1px solid #1e2a38", alignItems:"center" }}>
      <div style={{...sans, fontSize:12, color:"#7a8fa8"}}>{label}</div>
      <div style={{...mono, fontSize:12, fontWeight:700, color:color||"#e8eaf0"}}>{val}</div>
    </div>
  );

  return (
    <div>
      {/* Section nav */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {sections.map(([id,label]) => <SecBtn key={id} id={id} label={label}/>)}
      </div>

      {/* ── ALERTS ── */}
      {section === "alert" && (
        <div>
          {weekMistakes.length === 0 ? (
            <Card accent="#00c89630">
              <div style={{...mono, fontSize:11, color:"#00c896", letterSpacing:"0.06em", marginBottom:6}}>✓ NO VIOLATIONS THIS WEEK</div>
              <div style={{...sans, fontSize:12, color:"#3a5060"}}>All entries this week comply with your trading rules. Keep executing with discipline.</div>
            </Card>
          ) : (
            weekMistakes.map(m => (
              <Card key={m.id} accent="#e0525230">
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{...mono, fontSize:11, fontWeight:700, color:"#e05252", letterSpacing:"0.04em"}}>⚠ {m.title.toUpperCase()}</div>
                  <span style={{...mono, fontSize:9, color:"#3a5060", background:"#1e2a38", padding:"2px 8px", borderRadius:10}}>{m.day}</span>
                </div>
                <div style={{...sans, fontSize:12, color:"#7a8fa8", marginBottom:8, lineHeight:1.5}}>{m.what}</div>
                <div style={{ borderLeft:"3px solid #00c896", paddingLeft:10 }}>
                  <div style={{...mono, fontSize:9, color:"#00c896", letterSpacing:"0.06em", marginBottom:3}}>SOLUTION</div>
                  <div style={{...sans, fontSize:12, color:"#dde1ea", lineHeight:1.5}}>{m.solution}</div>
                </div>
                <div style={{ marginTop:8, ...mono, fontSize:10, color:"#e6a817", fontStyle:"italic" }}>"{m.rule}"</div>
              </Card>
            ))
          )}

          {/* Your stats vs targets */}
          <Card>
            <div style={{...secLabel, marginBottom:10}}>YOUR STATS vs SYSTEM TARGETS<div style={secLine}/></div>
            <div style={{ border:"1px solid #1e2a38", borderRadius:8, overflow:"hidden" }}>
              <Row label="Avg OBP (all time)"       val={`${avgObpAll}/10`}  color={parseFloat(avgObpAll)>=9?"#00c896":parseFloat(avgObpAll)>=7?"#00a87a":"#e6a817"}/>
              <Row label="OBP Target"               val="9/10"               color="#3a5060"/>
              <Row label="High OBP Days (≥8)"       val={`${highObpCount}/${totalEntries}`} color={highObpCount/totalEntries>=0.8?"#00c896":"#e6a817"}/>
              <Row label="Non-Model Trades"         val={`${nonModelCount}`} color={nonModelCount===0?"#00c896":"#e05252"}/>
              <Row label="Non-Model Target"         val="0"                  color="#3a5060"/>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", padding:"8px 12px", alignItems:"center" }}>
                <div style={{...sans, fontSize:12, color:"#7a8fa8"}}>Identity</div>
                <div style={{...sans, fontSize:11, color:"#4a9e82", fontStyle:"italic", lineHeight:1.4}}>Patient model sniper</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── RULES ── */}
      {section === "rules" && (
        <div>
          <Card>
            <div style={{...secLabel, marginBottom:10}}>DAILY TRADING RULES<div style={secLine}/></div>
            <div style={{ border:"1px solid #1e2a38", borderRadius:8, overflow:"hidden" }}>
              {sys.rules.map((r, i) => (
                <div key={i} style={{ display:"flex", gap:12, padding:"10px 12px", borderBottom:i<sys.rules.length-1?"1px solid #1e2a38":"none", alignItems:"flex-start", background:i%2===0?"transparent":"#0a0c1060" }}>
                  <div style={{...mono, fontSize:11, fontWeight:700, color:"#00c896", minWidth:20, marginTop:1}}>{i+1}</div>
                  <div style={{...sans, fontSize:12, color:"#dde1ea", lineHeight:1.5}}>{r}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card accent="#e6a81730">
            <div style={{...mono, fontSize:9, color:"#e6a817", letterSpacing:"0.08em", marginBottom:8}}>IDENTITY REMINDER</div>
            <div style={{...sans, fontSize:13, color:"#e8eaf0", lineHeight:1.7, fontStyle:"italic"}}>"{sys.identity}"</div>
          </Card>
        </div>
      )}

      {/* ── SYSTEM STATS ── */}
      {section === "stats" && (
        <div>
          <Card>
            <div style={{...secLabel, marginBottom:10}}>CORE SYSTEM STATISTICS<div style={secLine}/></div>
            <div style={{ border:"1px solid #1e2a38", borderRadius:8, overflow:"hidden" }}>
              <Row label="Model Presence"        val="~55% of trading days"  color="#00c896"/>
              <Row label="Setups Per Year"        val="~140 setups"           color="#00a87a"/>
              <Row label="Avg Expansion/Day"      val="138 MNQ points"        color="#00c896"/>
              <Row label="Point Value (MNQ)"      val="$2 per point"          color="#e8eaf0"/>
              <Row label="Max Daily Loss"         val="$200"                  color="#e05252"/>
              <Row label="Max Trades/Day"         val="3 trades"              color="#e6a817"/>
              <Row label="Thursday Max Trades"    val="2 trades"              color="#e6a817"/>
              <Row label="Target Extraction"      val="30–50%"                color="#00c896"/>
            </div>
          </Card>
          <Card>
            <div style={{...secLabel, marginBottom:10}}>YEARLY PROFIT PROJECTIONS (1 MNQ)<div style={secLine}/></div>
            <div style={{ border:"1px solid #1e2a38", borderRadius:8, overflow:"hidden" }}>
              {Object.entries(sys.stats.extraction).map(([pct, data], i, arr) => (
                <div key={pct} style={{ display:"grid", gridTemplateColumns:"80px 1fr 1fr", padding:"9px 12px", borderBottom:i<arr.length-1?"1px solid #1e2a38":"none", alignItems:"center", background:i%2===0?"transparent":"#0a0c1060" }}>
                  <div style={{...mono, fontSize:13, fontWeight:700, color:"#00c896"}}>{pct}</div>
                  <div style={{...sans, fontSize:12, color:"#7a8fa8"}}>{data.pts.toLocaleString()} pts/yr</div>
                  <div style={{...mono, fontSize:13, fontWeight:700, color:"#e8eaf0"}}>${data.profit.toLocaleString()}/yr</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:10, ...mono, fontSize:9, color:"#3a5060", letterSpacing:"0.06em" }}>Your growth comes from discipline + improved extraction, not more trades.</div>
          </Card>
        </div>
      )}

      {/* ── MINDSET ── */}
      {section === "mindset" && (
        <div>
          <Card accent="#00c89618">
            <div style={{...mono, fontSize:9, color:"#00c896", letterSpacing:"0.08em", marginBottom:10}}>TODAY'S BELIEF</div>
            <div style={{...sans, fontSize:14, color:"#e8eaf0", lineHeight:1.7, fontStyle:"italic", marginBottom:10}}>"{getDailyBelief()}"</div>
          </Card>
          <Card>
            <div style={{...secLabel, marginBottom:10}}>SYSTEM BELIEFS<div style={secLine}/></div>
            {sys.beliefs.map((b, i) => (
              <div key={i} style={{ display:"flex", gap:10, padding:"9px 0", borderBottom:i<sys.beliefs.length-1?"1px solid #1e2a38":"none", alignItems:"flex-start" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#00c896", marginTop:5, flexShrink:0 }}/>
                <div style={{...sans, fontSize:12, color:"#8fa8b8", lineHeight:1.6}}>{b}</div>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{...secLabel, marginBottom:10}}>MATHEMATICAL TRUTH<div style={secLine}/></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                {label:"Historical Win Rate", val:"75–94%",   color:"#00c896"},
                {label:"Jan 2024",            val:"12W / 4L", color:"#00c896"},
                {label:"Feb 2024",            val:"15W / 1L", color:"#00c896"},
                {label:"Avg Win",             val:"≥ 1.5R",   color:"#00c896"},
                {label:"Avg Loss",            val:"≈ -1R",    color:"#e05252"},
                {label:"Expectancy",          val:"Positive", color:"#00c896"},
              ].map(({label,val,color}) => (
                <div key={label} style={{ background:"#0a0c10", border:"1px solid #1e2a38", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{...mono, fontSize:9, color:"#3a5060", letterSpacing:"0.06em", marginBottom:4}}>{label}</div>
                  <div style={{...mono, fontSize:14, fontWeight:700, color}}>{val}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── PRE-SESSION ── */}
      {section === "session" && (
        <div>
          <Card accent="#00c89618">
            <div style={{...mono, fontSize:9, color:"#00c896", letterSpacing:"0.08em", marginBottom:10}}>READ BEFORE EVERY SESSION</div>
            <div style={{...sans, fontSize:13, color:"#e8eaf0", lineHeight:1.8, marginBottom:12}}>{sys.identity}</div>
            <div style={{ borderTop:"1px solid #1e2a38", paddingTop:12 }}>
              <div style={{...mono, fontSize:9, color:"#e6a817", letterSpacing:"0.08em", marginBottom:10}}>IF ANY ANSWER IS NO → DO NOT TRADE</div>
              {sys.sessionQuestions.map((q, i) => (
                <div key={i} style={{ display:"flex", gap:12, padding:"8px 0", borderBottom:i<sys.sessionQuestions.length-1?"1px solid #1e2a38":"none", alignItems:"center" }}>
                  <div style={{...mono, fontSize:11, fontWeight:700, color:"#e6a817", minWidth:22}}>{i+1}.</div>
                  <div style={{...sans, fontSize:12, color:"#dde1ea", lineHeight:1.5}}>{q}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{...secLabel, marginBottom:10}}>PRE-SESSION MINDSET<div style={secLine}/></div>
            {["I do not need to trade every day.",
              "My edge appears in ~55% of sessions.",
              "I wait for the model, not for action.",
              "I get paid for discipline, not activity.",
              "My goal is extraction efficiency, not win rate."].map((m,i,arr) => (
              <div key={i} style={{ display:"flex", gap:10, padding:"8px 0", borderBottom:i<arr.length-1?"1px solid #1e2a38":"none", alignItems:"flex-start" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#00c896", marginTop:5, flexShrink:0 }}/>
                <div style={{...sans, fontSize:12, color:"#8fa8b8", lineHeight:1.5}}>{m}</div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── MODEL PRESENCE DATA ── */}
      {section === "presence" && (
        <div>
          {/* Summary card */}
          <div style={{background:"#111820",border:"1px solid #1e2a38",borderRadius:12,padding:"1rem 1.25rem",marginBottom:10}}>
            <div style={{...secLabel,marginBottom:10}}>2025 BACKTESTED MODEL PRESENCE<div style={secLine}/></div>
            <div style={{...sans,fontSize:12,color:"#8fa8b8",lineHeight:1.6,marginBottom:12}}>{sys.modelPresenceData.summary}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div style={{background:"#00c89610",border:"1px solid #00c89630",borderRadius:10,padding:"12px 14px"}}>
                <div style={{...mono,fontSize:9,color:"#00c896",letterSpacing:"0.08em",marginBottom:8}}>STRENGTHS</div>
                {sys.modelPresenceData.strengths.map((s,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:5,alignItems:"flex-start"}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:"#00c896",marginTop:4,flexShrink:0}}/>
                    <div style={{...sans,fontSize:11,color:"#dde1ea"}}>{s}</div>
                  </div>
                ))}
              </div>
              <div style={{background:"#e0525210",border:"1px solid #e0525230",borderRadius:10,padding:"12px 14px"}}>
                <div style={{...mono,fontSize:9,color:"#e05252",letterSpacing:"0.08em",marginBottom:8}}>CONCERNS</div>
                {sys.modelPresenceData.concerns.map((c,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:5,alignItems:"flex-start"}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:"#e05252",marginTop:4,flexShrink:0}}/>
                    <div style={{...sans,fontSize:11,color:"#dde1ea"}}>{c}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{borderLeft:"3px solid #e6a817",padding:"8px 12px",background:"#e6a81710",borderRadius:"0 8px 8px 0"}}>
              <div style={{...mono,fontSize:9,color:"#e6a817",letterSpacing:"0.06em",marginBottom:3}}>KEY INSIGHT</div>
              <div style={{...sans,fontSize:12,color:"#dde1ea",lineHeight:1.5}}>{sys.modelPresenceData.insight}</div>
            </div>
          </div>

          {/* Monthly bar chart */}
          <div style={{background:"#111820",border:"1px solid #1e2a38",borderRadius:12,padding:"1rem 1.25rem",marginBottom:10}}>
            <div style={{...secLabel,marginBottom:12}}>MONTHLY SIGNAL RATE — 2025<div style={secLine}/></div>
            {sys.modelPresenceData.monthly.map((m,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"38px 1fr 44px",gap:8,alignItems:"center",marginBottom:7}}>
                <div style={{...mono,fontSize:9,color:"#5a7080",letterSpacing:"0.04em"}}>{m.month.toUpperCase()}</div>
                <div style={{position:"relative",height:14,background:"#0a0c10",borderRadius:3,overflow:"hidden"}}>
                  <div style={{
                    width:`${m.presence}%`,height:"100%",borderRadius:3,
                    background: m.presence>=65?"#00c896":m.presence>=55?"#00a87a":m.presence>=48?"#e6a817":"#e05252",
                    transition:"width 0.4s ease"
                  }}/>
                  <div style={{position:"absolute",left:6,top:0,height:"100%",display:"flex",alignItems:"center"}}>
                    <span style={{...mono,fontSize:9,color:m.presence>=50?"#0a0c10":"#8fa8b8",fontWeight:700}}>{m.days}</span>
                  </div>
                </div>
                <div style={{...mono,fontSize:10,fontWeight:700,color:m.presence>=65?"#00c896":m.presence>=55?"#00a87a":m.presence>=48?"#e6a817":"#e05252",textAlign:"right"}}>{m.presence}%</div>
              </div>
            ))}
            {/* Legend */}
            <div style={{display:"flex",gap:14,marginTop:10,paddingTop:8,borderTop:"1px solid #1e2a38",flexWrap:"wrap"}}>
              {[["#00c896","≥65% Strong"],["#00a87a","55-64% Good"],["#e6a817","48-54% Average"],["#e05252","<48% Weak"]].map(([c,l])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:8,height:8,borderRadius:2,background:c}}/>
                  <span style={{...mono,fontSize:9,color:"#3a5060"}}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly alerts */}
          <div style={{background:"#111820",border:"1px solid #e0525230",borderRadius:12,padding:"1rem 1.25rem",marginBottom:10}}>
            <div style={{...secLabel,marginBottom:10,color:"#e05252"}}>ANOMALY WEEKS — INVESTIGATE<div style={secLine}/></div>
            {Object.entries(sys.modelPresenceData.weeklyAlerts).map(([week,data])=>(
              <div key={week} style={{display:"flex",gap:12,padding:"10px 12px",background:"#0a0c10",borderRadius:8,marginBottom:8,alignItems:"flex-start"}}>
                <div style={{...mono,fontSize:11,fontWeight:700,color:"#e05252",minWidth:60}}>{week}</div>
                <div>
                  <div style={{...mono,fontSize:12,fontWeight:700,color:"#e8eaf0",marginBottom:3}}>Signal rate: {data.days} ({data.presence}%)</div>
                  <div style={{...sans,fontSize:11,color:"#7a8fa8",lineHeight:1.5}}>{data.alert}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Current week context */}
          {(() => {
            const now = new Date();
            const mo = now.toLocaleString("en-GB",{month:"short"});
            const monthData = sys.modelPresenceData.monthly.find(m => m.month.toLowerCase() === mo.toLowerCase());
            if (!monthData) return null;
            return (
              <div style={{borderLeft:"3px solid #00c896",padding:"10px 14px",background:"#00c89608",borderRadius:"0 8px 8px 0"}}>
                <div style={{...mono,fontSize:9,color:"#00c896",letterSpacing:"0.08em",marginBottom:4}}>THIS MONTH HISTORICALLY ({monthData.month.toUpperCase()})</div>
                <div style={{...sans,fontSize:12,color:"#dde1ea",lineHeight:1.5}}>
                  Expected signal rate: <span style={{...mono,fontWeight:700,color:monthData.presence>=60?"#00c896":"#e6a817"}}>{monthData.presence}%</span> — {monthData.note}.
                  If no setup appears today, that is consistent with your model. <span style={{color:"#00c896",fontWeight:500}}>No trade is the right trade.</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── MISTAKES ── */}
      {section === "mistakes" && (
        <div>
          {sys.mistakes.map((m, i) => (
            <Card key={m.id}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{...mono, fontSize:9, background:"#e0525218", border:"1px solid #e0525240", color:"#e05252", padding:"2px 8px", borderRadius:10, fontWeight:700}}>MISTAKE {i+1}</div>
                <div style={{...mono, fontSize:12, fontWeight:700, color:"#e8eaf0"}}>{m.title}</div>
              </div>
              <div style={{ marginBottom:10 }}>
                <div style={{...mono, fontSize:9, color:"#5a7080", letterSpacing:"0.07em", marginBottom:4}}>WHAT HAPPENS</div>
                <div style={{...sans, fontSize:12, color:"#7a8fa8", lineHeight:1.5}}>{m.what}</div>
              </div>
              <div style={{ borderLeft:"3px solid #00c896", paddingLeft:10, marginBottom:8 }}>
                <div style={{...mono, fontSize:9, color:"#00c896", letterSpacing:"0.06em", marginBottom:3}}>SOLUTION</div>
                <div style={{...sans, fontSize:12, color:"#dde1ea", lineHeight:1.5}}>{m.solution}</div>
              </div>
              <div style={{...mono, fontSize:10, color:"#e6a817"}}>{m.rule}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tab, setTab]               = useState("entry");
  const [activeDay, setActiveDay]   = useState(0);
  const [week, setWeek]             = useState(getCurrentWeek());
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [report, setReport]         = useState(null);
  const [entries, setEntries]       = useState([]);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [saved, setSaved]           = useState(false);
  const [loadTick, setLoadTick]     = useState(0);
  const [innerTab, setInnerTab]     = useState("debrief");
  const [startBalance, setStartBalance] = useState(25378);
  const [editingBal, setEditingBal]     = useState(false);
  const [balInput, setBalInput]         = useState("25378");
  const [exporting, setExporting]       = useState(false);

  const MSGS = ["Reviewing your debrief...", "Scoring OBP components...", "Running psych analysis...", "Writing risk verdict..."];

  useEffect(() => {
    async function load() {
      // Try window.storage (artifact) first, fall back to localStorage
      try {
        const res = await window.storage.get("nq_entries");
        if (res && res.value) { setEntries(JSON.parse(res.value)); }
        else {
          const s = localStorage.getItem("nq_entries");
          if (s) setEntries(JSON.parse(s));
        }
      } catch(e) {
        try {
          const s = localStorage.getItem("nq_entries");
          if (s) setEntries(JSON.parse(s));
        } catch(e2) {}
      }
      try {
        const res2 = await window.storage.get("nq_startbal");
        if (res2 && res2.value) { setStartBalance(parseFloat(res2.value)); setBalInput(res2.value); }
        else {
          const sb = localStorage.getItem("nq_startbal");
          if (sb) { setStartBalance(parseFloat(sb)); setBalInput(sb); }
        }
      } catch(e) {
        try {
          const sb = localStorage.getItem("nq_startbal");
          if (sb) { setStartBalance(parseFloat(sb)); setBalInput(sb); }
        } catch(e2) {}
      }
    }
    load();
  }, []);
  useEffect(() => { let t; if (loading) t = setInterval(() => setLoadTick(m => (m+1)%4), 1800); return () => clearInterval(t); }, [loading]);

  const persist = (e) => {
    const data = JSON.stringify(e);
    try { window.storage.set("nq_entries", data); } catch(err) {}
    try { localStorage.setItem("nq_entries", data); } catch(err) {}
  };
  const balance  = startBalance + entries.reduce((s, e) => s + (e.pnl || 0), 0);
  const toTarget = Math.max(0, 26500 - balance);
  const targetPct = Math.min(100, Math.max(0, ((balance - 25000) / 1500) * 100));
  const weekEntries = entries.filter(e => e.week === week).sort((a, b) => a.dayIdx - b.dayIdx);
  const weekNet  = weekEntries.reduce((s, e) => s + (e.pnl || 0), 0);
  const avgObpWeek = weekEntries.length ? weekEntries.reduce((s, e) => s + (e.obp||0), 0) / weekEntries.length : null;

  async function generate() {
    if (!input.trim()) return;
    setLoading(true); setReport(null); setLoadTick(0);
    const weekCtx = weekEntries.length
      ? weekEntries.map(e => `${e.day}: P&L $${e.pnl>=0?"+":""}${e.pnl} | OBP ${e.obp}/10 | Grade ${e.grade}`).join("\n")
      : "First entry this week.";

    const prompt = `Trader's debrief for ${DAYS[activeDay]} (Week ${week}):
"${input}"

Current account balance: $${balance.toLocaleString()}
Week so far: ${weekCtx}

Generate the complete journal entry in EXACTLY this format. Be crisp and bullet-driven. No long paragraphs:

📅 Trading Journal — ${DAYS[activeDay]}, Week ${week}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 OBP EXECUTION SCORE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Component | Max | Score | Notes |
|---|---|---|---|
| Model Validity | 3 | [score] | [one sharp honest note] |
| Entry Quality | 2 | [score] | [one sharp honest note] |
| Risk Discipline | 2 | [score] | [one sharp honest note] |
| Trade Management | 2 | [score] | [one sharp honest note] |
| Emotional Control | 1 | [score] | [one sharp honest note] |
| **TOTAL OBP** | **10** | **[total]** | **[Elite/Good/Average/Poor Execution]** |

⚖️ VERDICT — [Win/Loss] + OBP [total]/10 = [one punchy verdict line]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 TRADE BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Field | Value |
|---|---|
| Model Used | [ATM Model / No Model] |
| Result | [Win / Loss / BE] |
| Net P&L | $[amount] |
| R:R Available | [X]R |
| R:R Captured | [X]R |
| Model Pts Available | [X] pts |
| Pts Extracted | [X] pts |
| Extraction Efficiency | [X]% |
| Account Balance | $[updated balance] |
| Daily Loss Rule | SAFE / BREACHED |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 PSYCHOLOGICAL ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• State before  : [one word — Calm / Fearful / Greedy / Focused etc]
• Trigger       : [what drove decisions — use their exact words]
• Pattern       : [what mental pattern showed up]
• Carryover     : [Yes — affected by previous / No — clean slate]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ WHAT YOU DID WELL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• [Specific — reference actual decision they made]
• [Specific point 2]
• [Specific point 3 if warranted]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ HONEST OBSERVATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• [The one real thing that needs to change — no softening]
• [Second point if critical]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 KEY LESSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Rule for tomorrow : [one clear actionable rule]
• Why it matters   : [one sentence on cost of ignoring it]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 RISK MANAGER RATING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Execution Grade  : [A+ / A / B+ / B / C / D / F]
• Account Health   : [GREEN / AMBER / RED]
• Tomorrow         : [FULL APPROVAL / REDUCE SIZE / REVIEW RULES FIRST]
• Risk Manager     : "[One direct memorable sentence]"

CRITICAL — last line only, no extra text:
ENTRY_DATA:{"pnl":[net pnl number],"obp":[TOTAL OBP number],"grade":"[grade]","health":"[GREEN/AMBER/RED]","clearance":"[text]","verdict":"[short]","ptsAvail":[number],"ptsGot":[number],"extraction":[0-100],"outcome":"[Win/Loss/BE]"}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-ipc": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1400, system: SYSTEM_PROMPT, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      let text = data.content.map(c => c.text || "").join("");
      let parsed = { pnl: 0, obp: 0, grade: "—", health: "GREEN", clearance: "—", verdict: "", ptsAvail: 0, ptsGot: 0, extraction: 0, outcome: "" };

      const jm = text.match(/ENTRY_DATA:(\{[^\n]+\})/);
      if (jm) { try { parsed = { ...parsed, ...JSON.parse(jm[1]) }; } catch (e) {} text = text.replace(/ENTRY_DATA:\{[^\n]+\}/, "").trimEnd(); }

      // Robust fallbacks
      if (!parsed.obp) { const m = text.match(/TOTAL OBP[^|]*\|[^|]*\|\s*\*?\*?([\d.]+)/i) || text.match(/TOTAL OBP[^\d]*([\d.]+)\s*\/\s*10/i); if (m) parsed.obp = parseFloat(m[1]); }
      if (!parsed.pnl) { const m = text.match(/Net P&L\s*:?\s*\$?([-+]?[\d,]+)/i); if (m) parsed.pnl = parseFloat(m[1].replace(/[$,]/g,"")); }
      if (parsed.grade === "—") { const m = text.match(/Execution Grade\s*:?\s*([A-F][+-]?)/i); if (m) parsed.grade = m[1]; }
      const hm = text.match(/Account Health\s*:?\s*(GREEN|AMBER|RED)/i); if (hm) parsed.health = hm[1];
      if (!parsed.extraction) { const m = text.match(/Extraction Eff\s*:?\s*([\d.]+)%/i); if (m) parsed.extraction = parseFloat(m[1]); }
      if (!parsed.outcome) { const m = text.match(/Result\s*:?\s*(Win|Loss|BE)/i); if (m) parsed.outcome = m[1]; }

      const obpData   = parseOBP(text);
      const tradeData = parseTrade(text);
      // If parseOBP got the total, prefer that
      const obpTotal = [obpData.mv, obpData.eq, obpData.rd, obpData.tm, obpData.ec].every(v => v !== null)
        ? [obpData.mv, obpData.eq, obpData.rd, obpData.tm, obpData.ec].reduce((s, v) => s + v, 0)
        : parsed.obp;
      parsed.obp = obpTotal;

      const cleanText = stripTradeTable(stripOBPTable(text));
      setReport({ text: cleanText, rawText: text, parsed, obpData, tradeData, rawInput: input, day: DAYS[activeDay], dayIdx: activeDay, week });
    } catch (err) {
      setReport({ text: "Connection error. Please try again.", parsed: null, obpData: null, rawInput: input, day: DAYS[activeDay], dayIdx: activeDay, week });
    }
    setLoading(false);
  }

  function saveEntry() {
    if (!report) return;
    const e = { id: Date.now(), ...report.parsed, obpData: report.obpData, tradeData: report.tradeData, text: report.rawText || report.text, rawInput: report.rawInput, day: report.day, dayIdx: report.dayIdx, week: report.week, startBalance, date: new Date().toLocaleDateString("en-GB", {day:"2-digit",month:"short",year:"numeric"}) };
    const updated = [...entries.filter(x => !(x.week === e.week && x.dayIdx === e.dayIdx)), e];
    setEntries(updated);
    persist(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function deleteEntry(wk, dayIdx) {
    const updated = entries.filter(e => !(e.week === wk && e.dayIdx === dayIdx));
    setEntries(updated);
    persist(updated);
  }

  async function generateWeekly() {
    if (!weekEntries.length) return;
    setWeeklyLoading(true); setWeeklyReport(null);
    const avgO = avgObpWeek !== null ? avgObpWeek.toFixed(1) : "0";
    const totalAvail = weekEntries.reduce((s, e) => s + (e.ptsAvail||0), 0);
    const totalGot   = weekEntries.reduce((s, e) => s + (e.ptsGot||0), 0);
    const wins = weekEntries.filter(e => e.outcome === "Win").length;
    const losses = weekEntries.filter(e => e.outcome === "Loss").length;
    const winRate = weekEntries.length ? Math.round(wins/weekEntries.length*100) : 0;
    const avgExt = totalAvail > 0 ? Math.round(totalGot/totalAvail*100) : 0;
    const highObpDays = weekEntries.filter(e => e.obp >= 8).length;
    const expectancy = weekEntries.length ? weekEntries.reduce((s,e)=>s+(e.pnl||0),0)/weekEntries.length : 0;

    // Include behavior data if available
    const behaviorDays = weekEntries.filter(e => e.behaviorEntry && e.behaviorEntry.obp !== "");
    const behaviorStats = calculateWeeklyStats(weekEntries);
    const behaviorContext = behaviorDays.length > 0
      ? `\nBEHAVIOR DATA:\n${behaviorDays.map(e => `${e.day}: BehaviorOBP=${e.behaviorEntry.obp} | ModelPresent=${e.behaviorEntry.modelPresent} | OutsideModel=${e.behaviorEntry.outsideModel} | Mistake=${e.behaviorEntry.mistake} | Notes="${e.behaviorEntry.notes||""}"`).join("\n")}\nBehavior Stats: AvgOBP=${behaviorStats?.avgOBP||"?"} | HighDiscipline=${behaviorStats?.highOBP||0}/${behaviorDays.length} | ModelDiscipline=${behaviorStats?.modelDiscipline||"?"}% | TopMistake=${behaviorStats?.topMistake||"None"}`
      : "";

    const prompt = `You are a strict NQ futures prop firm risk manager. Analyse this week and respond ONLY with a valid JSON object — no extra text, no markdown, no explanation.

WEEK ${week} DATA:
${weekEntries.map(e => `${e.day}: P&L=$${e.pnl} | OBP=${e.obp}/10 | Grade=${e.grade} | Outcome=${e.outcome||"?"} | Extraction=${e.extraction||0}% | Debrief:"${e.rawInput}"`).join("\n")}${behaviorContext}

Stats: WinRate=${winRate}% | AvgOBP=${avgO} | Extraction=${avgExt}% | NetPnL=$${weekNet} | Account=$${balance}

OBP RULES: Loss+OBP>=8=GOOD TRADE. Win+OBP<=6=BAD TRADE. OBP=discipline not profit.

Respond with ONLY this JSON (fill every field, keep values short — max 8 words each):
{
  "weekGrade": "A+",
  "accountStatus": "GREEN",
  "nextWeek": "FULL APPROVAL",
  "bestDay": "${weekEntries[0]?.day||'Monday'}",
  "bestDayOBP": 8.5,
  "bestDayReason": "one sentence why",
  "weakestDay": "${weekEntries[0]?.day||'Monday'}",
  "weakestDayOBP": 5,
  "weakestDayReason": "one sentence root cause",
  "psychPattern": "Pattern name (e.g. Payout Greed Loop)",
  "psychTrigger": "what triggered it",
  "psychFix": "one rule to fix it",
  "extractionTarget": 75,
  "ptsLeftReason": "why pts were left — early exit? fear?",
  "focus1": "short actionable rule",
  "focus2": "short actionable rule",
  "focus3": "short actionable rule",
  "goodTrades": ${weekEntries.filter(e=>e.outcome==='Loss'&&e.obp>=8).length},
  "badTrades": ${weekEntries.filter(e=>e.outcome==='Win'&&e.obp<=6).length},
  "riskManagerMessage": "one direct sentence — the thing they read before bed"
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-ipc": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 600, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      let text = data.content.map(c => c.text || "").join("").trim();
      // Strip markdown fences robustly
      text = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      // Find JSON object in response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) text = jsonMatch[0];
      try {
        const parsed = JSON.parse(text);
        setWeeklyReport(parsed);
      } catch(e) {
        // Show raw text as fallback so user sees something
        setWeeklyReport({ error: "Parse error — raw: " + text.slice(0, 200) });
      }
    } catch { setWeeklyReport({ error: "Connection error. Try again." }); }
    setWeeklyLoading(false);
  }

  // ── PDF EXPORT ──
  async function exportWeeklyPDF() {
    if (!weekEntries.length) return;
    setExporting(true);

    const wins   = weekEntries.filter(e=>e.outcome==="Win").length;
    const losses = weekEntries.filter(e=>e.outcome==="Loss").length;
    const total  = weekEntries.length;
    const winRate   = total ? Math.round(wins/total*100) : 0;
    const avgO      = total ? (weekEntries.reduce((s,e)=>s+(e.obp||0),0)/total).toFixed(1) : "—";
    const totalAvail= weekEntries.reduce((s,e)=>s+(e.ptsAvail||0),0);
    const totalGot  = weekEntries.reduce((s,e)=>s+(e.ptsGot||0),0);
    const avgExt    = totalAvail>0?Math.round(totalGot/totalAvail*100):null;
    const highObp   = weekEntries.filter(e=>e.obp>=8).length;
    const expectancy= total ? weekEntries.reduce((s,e)=>s+(e.pnl||0),0)/total : 0;
    const modelDays = weekEntries.filter(e=>e.tradeData?.model&&!e.tradeData.model.includes("No Model")).length;
    const modelPct  = total ? Math.round(modelDays/total*100) : 0;
    const bStats    = calculateWeeklyStats(weekEntries);

    // colour helpers (inline JS inside template)
    const pC  = v => v>=0?"#00c896":"#e05252";
    const oC  = v => v>=8?"#00c896":v>=6?"#00a87a":v>=4?"#e6a817":"#e05252";
    const gC  = g => !g||g==="—"?"#3a5060":g.startsWith("A")?"#00c896":g.startsWith("B")?"#00a87a":"#e6a817";
    const eC  = v => v>=70?"#00c896":v>=40?"#e6a817":"#e05252";
    const pill= (txt,c) => `<span style="font-family:'Space Mono',monospace;font-size:10px;padding:2px 9px;border-radius:10px;font-weight:700;background:${c}18;border:1px solid ${c}40;color:${c}">${txt}</span>`;
    const bar = (v,max) => {
      const pct=Math.round(v/max*100);
      const c=v/max>=0.85?"#00c896":v/max>=0.6?"#00a87a":v/max>=0.35?"#e6a817":"#e05252";
      return `<div style="display:flex;align-items:center;gap:6px"><span style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:${c};min-width:22px">${v}</span><div style="width:50px;height:3px;background:#1e2a38;border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${c};border-radius:2px"></div></div><span style="font-family:'Space Mono',monospace;font-size:9px;color:#3a5060">${max}</span></div>`;
    };
    const row2=(label,val,vc,sub)=>`<div style="display:grid;grid-template-columns:1fr 1fr;padding:8px 12px;border-bottom:1px solid #1e2a38;align-items:center"><span style="font-family:'Inter',sans-serif;font-size:12px;color:#7a8fa8">${label}</span><div><span style="font-family:'Space Mono',monospace;font-size:12px;font-weight:700;color:${vc||"#e8eaf0"}">${val}</span>${sub?`<span style="font-family:'Space Mono',monospace;font-size:9px;color:#3a5060;margin-left:6px">${sub}</span>`:""}</div></div>`;
    const sec=(title)=>`<div style="font-family:'Space Mono',monospace;font-size:9px;color:#00c896;letter-spacing:.1em;margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid #1e2a38">${title}</div>`;
    const card=(content,border)=>`<div style="background:#111820;border:1px solid ${border||"#1e2a38"};border-radius:12px;padding:16px;margin-bottom:12px">${content}</div>`;

    const wr = weeklyReport && typeof weeklyReport==="object" ? weeklyReport : null;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>NQ Journal — Week ${week}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#09080f!important}
body{font-family:'Inter',sans-serif;background:#09080f;color:#e8eaf0;padding:32px 36px;font-size:13px;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.metric{background:#0a0c10;border:1px solid #1e2a38;border-radius:10px;padding:12px}
.m-label{font-family:'Space Mono',monospace;font-size:9px;color:#3a5060;letter-spacing:.08em;margin-bottom:5px}
.m-val{font-family:'Space Mono',monospace;font-size:17px;font-weight:700;line-height:1}
.m-sub{font-family:'Space Mono',monospace;font-size:9px;color:#2a3a48;margin-top:4px}
table{width:100%;border-collapse:collapse}
th{font-family:'Space Mono',monospace;font-size:8px;color:#3a5060;text-align:left;padding:6px 10px;border-bottom:1px solid #1e2a38;letter-spacing:.06em;background:#0a0c10}
td{padding:7px 10px;border-bottom:1px solid #1e2a38;color:#8fa8b8;font-size:12px;vertical-align:middle}
tr:nth-child(even) td{background:#0a0c1050}
.page-break{page-break-before:always;padding-top:24px}
.focus-row{display:flex;gap:12px;padding:9px 12px;border-bottom:1px solid #1e2a38;align-items:flex-start}
.rm-box{border-left:3px solid #00c896;padding:12px 14px;background:#00c89608;border-radius:0 10px 10px 0;margin-top:12px}
.obp-total td{background:#131a14!important;font-family:'Space Mono',monospace;font-weight:700}
.report-pre{white-space:pre-wrap;font-size:11px;line-height:1.75;color:#4a9e82;background:#0a0c10;border:1px solid #1e2a38;border-radius:8px;padding:14px;margin-top:10px}
@media print{
  html,body{background:#09080f!important}
  @page{margin:18mm;background:#09080f}
}
</style></head><body>

<!-- HEADER -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #1e2a38">
  <div>
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#00c896;letter-spacing:.14em;margin-bottom:6px">TRADIEFY · NQ FUTURES · $25K FUNDED · ATM MODEL</div>
    <div style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:#e8eaf0;line-height:1.1">Risk Manager <span style="color:#00c896">Journal</span></div>
    <div style="font-size:11px;color:#3a5060;margin-top:4px">Weekly Performance Report — ${week}</div>
  </div>
  <div style="text-align:right">
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#3a5060;letter-spacing:.08em;margin-bottom:4px">ACCOUNT BALANCE</div>
    <div style="font-family:'Space Mono',monospace;font-size:26px;font-weight:700;color:${pC(balance-startBalance)}">$${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#3a5060;margin-top:3px">TARGET $26,500 · $${toTarget.toFixed(0)} REMAINING</div>
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#3a5060;margin-top:6px">${new Date().toLocaleDateString("en-GB",{weekday:"long",day:"2-digit",month:"short",year:"numeric"})}</div>
  </div>
</div>

<!-- GRADE / STATUS / APPROVAL PILLS -->
${wr ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
  <div style="background:${gC(wr.weekGrade)}12;border:1px solid ${gC(wr.weekGrade)}30;border-radius:12px;padding:14px;text-align:center">
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#3a5060;letter-spacing:.08em;margin-bottom:6px">WEEK GRADE</div>
    <div style="font-family:'Space Mono',monospace;font-size:34px;font-weight:700;color:${gC(wr.weekGrade)};line-height:1">${wr.weekGrade}</div>
  </div>
  <div style="background:${wr.accountStatus==="GREEN"?"#00c896":"#e05252"}12;border:1px solid ${wr.accountStatus==="GREEN"?"#00c896":"#e05252"}30;border-radius:12px;padding:14px;text-align:center">
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#3a5060;letter-spacing:.08em;margin-bottom:6px">ACCOUNT STATUS</div>
    <div style="font-family:'Space Mono',monospace;font-size:20px;font-weight:700;color:${wr.accountStatus==="GREEN"?"#00c896":"#e05252"};line-height:1">${wr.accountStatus}</div>
  </div>
  <div style="background:${wr.nextWeek==="FULL APPROVAL"?"#00c896":"#e6a817"}12;border:1px solid ${wr.nextWeek==="FULL APPROVAL"?"#00c896":"#e6a817"}30;border-radius:12px;padding:14px;text-align:center">
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#3a5060;letter-spacing:.08em;margin-bottom:6px">NEXT WEEK</div>
    <div style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:${wr.nextWeek==="FULL APPROVAL"?"#00c896":"#e6a817"};line-height:1.2">${wr.nextWeek}</div>
  </div>
</div>` : ""}

<!-- PERFORMANCE STATS + DAY SNAPSHOT -->
<div class="grid2">
  <div style="background:#111820;border:1px solid #1e2a38;border-radius:12px;padding:14px">
    ${sec("PERFORMANCE STATS")}
    <div style="border:1px solid #1e2a38;border-radius:8px;overflow:hidden">
      ${row2("Win Rate",`${winRate}%`,winRate>=50?"#00c896":"#e05252",`${wins}W · ${losses}L · ${total} days`)}
      ${row2("Avg OBP Score",`${avgO}/10`,oC(parseFloat(avgO)),`${highObp}/${total} high execution days`)}
      ${row2("Extraction Eff",avgExt!==null?`${avgExt}%`:"—",avgExt!==null?eC(avgExt):"#3a5060",totalAvail>0?`${totalGot} / ${totalAvail} pts`:"")}
      ${row2("Net P&L",`${weekNet>=0?"+":""}$${weekNet.toFixed(0)}`,pC(weekNet),`$${balance.toLocaleString()} balance`)}
      ${row2("Expectancy",`${expectancy>=0?"+":""}$${expectancy.toFixed(0)}`,pC(expectancy),"avg per trading day")}
      ${row2("Model Presence",`${modelPct}%`,modelPct>=80?"#00c896":modelPct>=50?"#e6a817":"#e05252",`${modelDays}/${total} days ATM model`)}
      ${row2("Good Trades",`${wr?.goodTrades||0}`,"#00c896","loss + OBP ≥ 8")}
      <div style="display:grid;grid-template-columns:1fr 1fr;padding:8px 12px;align-items:center">
        <span style="font-family:'Inter',sans-serif;font-size:12px;color:#7a8fa8">Bad Trades</span>
        <span style="font-family:'Space Mono',monospace;font-size:12px;font-weight:700;color:${(wr?.badTrades||0)>0?"#e05252":"#00c896"}">${wr?.badTrades||0}</span>
      </div>
    </div>
  </div>
  <div style="background:#111820;border:1px solid #1e2a38;border-radius:12px;padding:14px">
    ${sec("DAY SNAPSHOT")}
    <table>
      <thead><tr><th>DAY</th><th>P&L</th><th>OBP</th><th>EXT</th><th>RESULT</th><th>GRADE</th></tr></thead>
      <tbody>
        ${weekEntries.map((e,i)=>`<tr style="${i%2===0?'':'background:#0a0c1050'}">
          <td style="color:#e8eaf0;font-weight:500">${e.day.slice(0,3).toUpperCase()}${e.date?` <span style="font-size:9px;color:#3a5060">${e.date}</span>`:""}</td>
          <td style="font-family:'Space Mono',monospace;font-weight:700;color:${pC(e.pnl)}">${e.pnl>=0?"+":""}$${e.pnl}</td>
          <td><div style="display:flex;align-items:center;gap:5px"><span style="font-family:'Space Mono',monospace;font-weight:700;color:${oC(e.obp)}">${e.obp}</span><div style="width:30px;height:3px;background:#1e2a38;border-radius:2px"><div style="width:${Math.round(e.obp/10*100)}%;height:100%;background:${oC(e.obp)};border-radius:2px"></div></div></div></td>
          <td style="font-family:'Space Mono',monospace;color:${e.extraction?eC(e.extraction):"#3a5060"}">${e.extraction?e.extraction+"%":"—"}</td>
          <td>${pill(e.outcome||"—",e.outcome==="Win"?"#00c896":e.outcome==="Loss"?"#e05252":"#e6a817")}</td>
          <td style="font-family:'Space Mono',monospace;font-weight:700;color:${gC(e.grade)}">${e.grade||"—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>
</div>

<!-- BEST DAY / WEAKEST DAY -->
${wr ? `<div class="grid2">
  <div style="background:#111820;border:1px solid #00c89630;border-radius:12px;padding:14px">
    ${sec("BEST EXECUTION DAY")}
    <div style="border:1px solid #1e2a38;border-radius:8px;overflow:hidden">
      ${row2("Day",wr.bestDay,"#00c896")}
      ${row2("OBP Score",`${wr.bestDayOBP}/10`,"#00c896")}
      <div style="padding:8px 12px"><div style="font-size:11px;color:#7a8fa8;margin-bottom:3px">Why</div><div style="font-size:12px;color:#dde1ea;line-height:1.5">${wr.bestDayReason}</div></div>
    </div>
  </div>
  <div style="background:#111820;border:1px solid #e0525230;border-radius:12px;padding:14px">
    ${sec("WEAKEST DAY")}
    <div style="border:1px solid #1e2a38;border-radius:8px;overflow:hidden">
      ${row2("Day",wr.weakestDay,"#e05252")}
      ${row2("OBP Score",`${wr.weakestDayOBP}/10`,"#e05252")}
      <div style="padding:8px 12px"><div style="font-size:11px;color:#7a8fa8;margin-bottom:3px">Root cause</div><div style="font-size:12px;color:#dde1ea;line-height:1.5">${wr.weakestDayReason}</div></div>
    </div>
  </div>
</div>` : ""}

<!-- PSYCH + EXTRACTION -->
${wr ? `<div class="grid2">
  <div style="background:#111820;border:1px solid #1e2a38;border-radius:12px;padding:14px">
    ${sec("PSYCHOLOGICAL PATTERN")}
    <div style="border:1px solid #1e2a38;border-radius:8px;overflow:hidden">
      ${row2("Pattern",wr.psychPattern,"#e6a817")}
      ${row2("Trigger",wr.psychTrigger)}
      <div style="padding:8px 12px"><div style="font-size:11px;color:#7a8fa8;margin-bottom:3px">Fix</div><div style="font-size:12px;color:#00c896;line-height:1.5">${wr.psychFix}</div></div>
    </div>
  </div>
  <div style="background:#111820;border:1px solid #1e2a38;border-radius:12px;padding:14px">
    ${sec("EXTRACTION ANALYSIS")}
    <div style="border:1px solid #1e2a38;border-radius:8px;overflow:hidden">
      ${row2("This week avg",avgExt!==null?`${avgExt}%`:"—",avgExt!==null?eC(avgExt):"#3a5060")}
      ${row2("Target next week",`${wr.extractionTarget}%`,"#00c896")}
      ${row2("Pts left on table",`${totalAvail-totalGot}`,"#e05252",`of ${totalAvail} available`)}
      <div style="padding:8px 12px"><div style="font-size:11px;color:#7a8fa8;margin-bottom:3px">Why pts left</div><div style="font-size:12px;color:#dde1ea;line-height:1.5">${wr.ptsLeftReason}</div></div>
    </div>
  </div>
</div>` : ""}

<!-- FOCUS POINTS -->
${wr ? `<div style="background:#111820;border:1px solid #1e2a38;border-radius:12px;padding:14px;margin-bottom:12px">
  ${sec("TOP 3 FOCUS POINTS NEXT WEEK")}
  <div style="border:1px solid #1e2a38;border-radius:8px;overflow:hidden">
    <div class="focus-row"><span style="font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:#00c896;min-width:18px">1</span><span style="font-size:12px;color:#dde1ea;line-height:1.5">${wr.focus1}</span></div>
    <div class="focus-row"><span style="font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:#00c896;min-width:18px">2</span><span style="font-size:12px;color:#dde1ea;line-height:1.5">${wr.focus2}</span></div>
    <div class="focus-row" style="border-bottom:none"><span style="font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:#00c896;min-width:18px">3</span><span style="font-size:12px;color:#dde1ea;line-height:1.5">${wr.focus3}</span></div>
  </div>
</div>` : ""}

<!-- BEHAVIOR METRICS -->
${bStats ? `<div style="background:#111820;border:1px solid #1e2a38;border-radius:12px;padding:14px;margin-bottom:12px">
  ${sec("WEEKLY BEHAVIOR METRICS")}
  <div class="grid4">
    <div class="metric"><div class="m-label">AVG OBP</div><div class="m-val" style="color:${oC(parseFloat(bStats.avgOBP))}">${bStats.avgOBP}</div><div class="m-sub">${bStats.total} days</div></div>
    <div class="metric"><div class="m-label">HIGH DISCIPLINE</div><div class="m-val" style="color:#00c896">${bStats.highOBP}/${bStats.total}</div><div class="m-sub">OBP ≥ 8 days</div></div>
    <div class="metric"><div class="m-label">MODEL DISCIPLINE</div><div class="m-val" style="color:${bStats.modelDiscipline===100?"#00c896":"#e6a817"}">${bStats.modelDiscipline}%</div><div class="m-sub">within rules</div></div>
    <div class="metric"><div class="m-label">TOP MISTAKE</div><div class="m-val" style="font-size:13px;color:#e6a817">${bStats.topMistake}</div><div class="m-sub">most common</div></div>
  </div>
</div>` : ""}

<!-- RISK MANAGER MESSAGE -->
${wr?.riskManagerMessage ? `<div class="rm-box" style="margin-bottom:14px">
  <div style="font-family:'Space Mono',monospace;font-size:9px;color:#00a87a;letter-spacing:.08em;margin-bottom:6px">RISK MANAGER SAYS</div>
  <div style="font-size:13px;color:#e8eaf0;line-height:1.7;font-style:italic">"${wr.riskManagerMessage}"</div>
</div>` : ""}

<!-- PAGE 2: DAILY ENTRIES -->
<div class="page-break">
  <div style="font-family:'Space Mono',monospace;font-size:9px;color:#00c896;letter-spacing:.1em;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #1e2a38">DAILY TRADE ENTRIES — FULL BREAKDOWN</div>

  ${weekEntries.map((e,di)=>{
    const obpTotal = e.obpData?(e.obpData.mv||0)+(e.obpData.eq||0)+(e.obpData.rd||0)+(e.obpData.tm||0)+(e.obpData.ec||0):e.obp;
    const obpRows  = e.obpData?[["Model Validity",3,e.obpData.mv,e.obpData.mvNote],["Entry Quality",2,e.obpData.eq,e.obpData.eqNote],["Risk Discipline",2,e.obpData.rd,e.obpData.rdNote],["Trade Management",2,e.obpData.tm,e.obpData.tmNote],["Emotional Control",1,e.obpData.ec,e.obpData.ecNote]]:[];
    const tradeRows= e.tradeData?Object.entries({"Model Used":e.tradeData.model,"Result":e.tradeData.result,"Net P&L":e.tradeData.pnl,"R:R Available":e.tradeData.rrAvail,"R:R Captured":e.tradeData.rrGot,"Pts Available":e.tradeData.ptsAvail,"Pts Extracted":e.tradeData.ptsGot,"Extraction Eff":e.tradeData.extraction,"Daily Rule":e.tradeData.dailyRule}).filter(([,v])=>v):[];
    return `<div style="background:#111820;border:1px solid #1e2a38;border-radius:12px;padding:18px;margin-bottom:14px;page-break-inside:avoid">
      <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid #1e2a38;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span style="font-family:'Space Mono',monospace;font-size:15px;font-weight:700;color:#e8eaf0">${e.day.toUpperCase()}</span>
          ${e.date?`<span style="font-family:'Space Mono',monospace;font-size:10px;color:#3a5060">${e.date}</span>`:""}
          <span style="font-family:'Space Mono',monospace;font-size:14px;font-weight:700;color:${pC(e.pnl)}">${e.pnl>=0?"+":""}$${e.pnl}</span>
          ${pill(e.outcome||"—",e.outcome==="Win"?"#00c896":e.outcome==="Loss"?"#e05252":"#e6a817")}
          ${e.grade&&e.grade!=="—"?pill("GRADE "+e.grade,gC(e.grade)):""}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="background:${oC(obpTotal)}10;border:1px solid ${oC(obpTotal)}40;border-radius:10px;padding:8px 14px;text-align:center">
            <div style="font-family:'Space Mono',monospace;font-size:20px;font-weight:700;color:${oC(obpTotal)};line-height:1">${obpTotal}</div>
            <div style="font-family:'Space Mono',monospace;font-size:8px;color:${oC(obpTotal)};opacity:.7;margin-top:2px;letter-spacing:.06em">OBP/10</div>
          </div>
          ${e.health?`<div style="background:${e.health==="GREEN"?"#00c89610":e.health==="AMBER"?"#e6a81710":"#e0525210"};border:1px solid ${e.health==="GREEN"?"#00c89640":e.health==="AMBER"?"#e6a81740":"#e0525240"};border-radius:8px;padding:8px 12px;text-align:center"><div style="font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:${e.health==="GREEN"?"#00c896":e.health==="AMBER"?"#e6a817":"#e05252"}">${e.health}</div><div style="font-family:'Space Mono',monospace;font-size:8px;color:#3a5060;margin-top:1px">HEALTH</div></div>`:""}
        </div>
      </div>
      <div style="font-size:11px;color:#2a3a48;font-style:italic;border-left:2px solid #1e2a38;padding:6px 10px;margin-bottom:12px;line-height:1.6">"${(e.rawInput||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}"</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:9px;color:#00c896;letter-spacing:.08em;margin-bottom:6px">OBP EXECUTION SCORE</div>
          <div style="border:1px solid #1e2a38;border-radius:8px;overflow:hidden">
            <table><thead><tr><th style="width:45%">COMPONENT</th><th style="width:15%">MAX</th><th>SCORE</th></tr></thead>
            <tbody>
              ${obpRows.map(([n,m,s],ri)=>`<tr style="${ri%2===0?'':'background:#0a0c1060'}"><td style="color:#dde1ea">${n}</td><td style="font-family:'Space Mono',monospace;color:#3a5060;font-size:11px">${m}</td><td>${s!==null&&s!==undefined?bar(s,m):'<span style="color:#3a5060">—</span>'}</td></tr>`).join("")}
              <tr class="obp-total"><td style="color:#e8eaf0;font-size:12px">TOTAL OBP</td><td style="color:#3a5060;font-size:11px">10</td><td><div style="display:flex;align-items:center;gap:8px"><span style="font-family:'Space Mono',monospace;font-size:16px;font-weight:700;color:${oC(obpTotal)}">${obpTotal}</span><span style="font-family:'Space Mono',monospace;font-size:9px;color:${oC(obpTotal)};letter-spacing:.06em">${obpTotal>=9?"ELITE":obpTotal>=7?"GOOD":obpTotal>=5?"AVERAGE":"POOR"}</span></div></td></tr>
            </tbody></table>
          </div>
        </div>
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:9px;color:#00c896;letter-spacing:.08em;margin-bottom:6px">TRADE BREAKDOWN</div>
          <div style="border:1px solid #1e2a38;border-radius:8px;overflow:hidden">
            <table><thead><tr><th>FIELD</th><th>VALUE</th></tr></thead>
            <tbody>
              ${tradeRows.map(([k,v],ri)=>`<tr style="${ri%2===0?'':'background:#0a0c1060'}"><td style="color:#7a8fa8">${k}</td><td style="font-family:'Space Mono',monospace;font-weight:700;color:${k==="Daily Rule"?(v.includes("SAFE")?"#00c896":"#e05252"):k==="Result"?(v==="Win"?"#00c896":v==="Loss"?"#e05252":"#e6a817"):k==="Net P&L"?(v.includes("-")?"#e05252":"#00c896"):"#e8eaf0"}">${v}</td></tr>`).join("")}
            </tbody></table>
          </div>
        </div>
      </div>
      ${e.text?`<div style="margin-top:12px"><div style="font-family:'Space Mono',monospace;font-size:9px;color:#00c896;letter-spacing:.08em;margin-bottom:6px">RISK MANAGER ANALYSIS</div><div class="report-pre">${e.text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div></div>`:""}
    </div>`;
  }).join("")}
</div>

<!-- FOOTER -->
<div style="margin-top:32px;padding-top:14px;border-top:1px solid #1e2a38;font-family:'Space Mono',monospace;font-size:9px;color:#1e2a38;display:flex;justify-content:space-between">
  <span>NQ RISK MANAGER JOURNAL · TRADIEFY · ATM MODEL · OBP SYSTEM</span>
  <span>WEEK ${week} · ${new Date().toLocaleDateString("en-GB",{year:"numeric",month:"short",day:"numeric"}).toUpperCase()}</span>
</div>

</body></html>`;

    try {
      const blob = new Blob([html], { type:"text/html;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `NQ-Journal-Week-${week}.html`;
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{ URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
    } catch(err) {
      const a = document.createElement("a");
      a.href = "data:text/html;charset=utf-8," + encodeURIComponent(html);
      a.download = `NQ-Journal-Week-${week}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    setExporting(false);
  }


  // ── Export Single Day Report ──
  function exportDailyReport(e) {
    const obpTotal = e.obpData
      ? (e.obpData.mv||0)+(e.obpData.eq||0)+(e.obpData.rd||0)+(e.obpData.tm||0)+(e.obpData.ec||0)
      : e.obp;
    const obpRows = e.obpData ? [
      ["Model Validity",3,e.obpData.mv,e.obpData.mvNote],
      ["Entry Quality",2,e.obpData.eq,e.obpData.eqNote],
      ["Risk Discipline",2,e.obpData.rd,e.obpData.rdNote],
      ["Trade Management",2,e.obpData.tm,e.obpData.tmNote],
      ["Emotional Control",1,e.obpData.ec,e.obpData.ecNote],
    ] : [];
    const tradeRows = e.tradeData ? Object.entries({
      "Model Used":e.tradeData.model,"Result":e.tradeData.result,
      "Net P&L":e.tradeData.pnl,"R:R Available":e.tradeData.rrAvail,
      "R:R Captured":e.tradeData.rrGot,"Pts Available":e.tradeData.ptsAvail,
      "Pts Extracted":e.tradeData.ptsGot,"Extraction Eff":e.tradeData.extraction,
      "Account Balance":e.tradeData.balance,"Daily Rule":e.tradeData.dailyRule,
    }).filter(([,v])=>v) : [];

    const pC  = v => v>=0?"#00c896":"#e05252";
    const oC  = v => v>=8?"#00c896":v>=6?"#00a87a":v>=4?"#e6a817":"#e05252";
    const gC  = g => !g||g==="—"?"#3a5060":g.startsWith("A")?"#00c896":g.startsWith("B")?"#00a87a":"#e6a817";
    const bar = (v,max) => {
      const pct=Math.round(v/max*100);
      const c=v/max>=0.85?"#00c896":v/max>=0.6?"#00a87a":v/max>=0.35?"#e6a817":"#e05252";
      return `<div style="display:flex;align-items:center;gap:6px"><span style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:${c};min-width:22px">${v}</span><div style="width:50px;height:3px;background:#1e2a38;border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${c};border-radius:2px"></div></div><span style="font-family:'Space Mono',monospace;font-size:9px;color:#3a5060">${max}</span></div>`;
    };
    const pill=(txt,c)=>`<span style="font-family:'Space Mono',monospace;font-size:10px;padding:2px 9px;border-radius:10px;font-weight:700;background:${c}18;border:1px solid ${c}40;color:${c}">${txt}</span>`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>NQ Journal — ${e.day} ${e.week}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#09080f!important}
body{font-family:'Inter',sans-serif;background:#09080f;color:#e8eaf0;padding:32px 36px;font-size:13px;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
table{width:100%;border-collapse:collapse}
th{font-family:'Space Mono',monospace;font-size:8px;color:#3a5060;text-align:left;padding:6px 10px;border-bottom:1px solid #1e2a38;letter-spacing:.06em;background:#0a0c10}
td{padding:7px 10px;border-bottom:1px solid #1e2a38;color:#8fa8b8;font-size:12px;vertical-align:middle}
tr:nth-child(even) td{background:#0a0c1040}
.obp-total td{background:#131a14!important;font-family:'Space Mono',monospace;font-weight:700}
.report-pre{white-space:pre-wrap;font-size:11px;line-height:1.75;color:#4a9e82;background:#0a0c10;border:1px solid #1e2a38;border-radius:8px;padding:14px;margin-top:12px}
@media print{html,body{background:#09080f!important}@page{margin:18mm;background:#09080f}}
</style></head><body>

<!-- HEADER -->
<div style="margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid #1e2a38">
  <div style="font-family:'Space Mono',monospace;font-size:9px;color:#00c896;letter-spacing:.14em;margin-bottom:6px">TRADIEFY · NQ FUTURES · $25K · ATM MODEL · DAILY REPORT</div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:8px">
    <div>
      <div style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:#e8eaf0">${e.day.toUpperCase()}</div>
      <div style="font-family:'Space Mono',monospace;font-size:11px;color:#3a5060;margin-top:2px">Week ${e.week}${e.date?" · "+e.date:""}</div>
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div style="background:${oC(obpTotal)}10;border:1px solid ${oC(obpTotal)}40;border-radius:10px;padding:10px 16px;text-align:center">
        <div style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:${oC(obpTotal)};line-height:1">${obpTotal}</div>
        <div style="font-family:'Space Mono',monospace;font-size:8px;color:${oC(obpTotal)};opacity:.7;margin-top:2px;letter-spacing:.06em">OBP/10</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:${pC(e.pnl)}">${e.pnl>=0?"+":""}$${e.pnl}</div>
        <div style="display:flex;gap:6px;margin-top:4px;justify-content:flex-end;flex-wrap:wrap">
          ${pill(e.outcome||"—",e.outcome==="Win"?"#00c896":e.outcome==="Loss"?"#e05252":"#e6a817")}
          ${e.grade&&e.grade!=="—"?pill("GRADE "+e.grade,gC(e.grade)):""}
          ${e.health?pill(e.health,e.health==="GREEN"?"#00c896":e.health==="AMBER"?"#e6a817":"#e05252"):""}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- DEBRIEF QUOTE -->
<div style="font-size:12px;color:#2a3a48;font-style:italic;border-left:3px solid #00c896;padding:8px 12px;margin-bottom:16px;line-height:1.6;background:#00c89606;border-radius:0 8px 8px 0">"${(e.rawInput||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}"</div>

<!-- OBP + TRADE TABLES -->
<div class="grid2">
  <div>
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#00c896;letter-spacing:.08em;margin-bottom:8px">OBP EXECUTION SCORE</div>
    <div style="border:1px solid #1e2a38;border-radius:8px;overflow:hidden;background:#111820">
      <table>
        <thead><tr><th style="width:45%">COMPONENT</th><th style="width:15%">MAX</th><th>SCORE</th></tr></thead>
        <tbody>
          ${obpRows.map(([n,m,s,note],ri)=>`
          <tr style="${ri%2===0?'':'background:#0a0c1060'}">
            <td style="color:#dde1ea">${n}</td>
            <td style="font-family:'Space Mono',monospace;color:#3a5060;font-size:11px">${m}</td>
            <td>${s!==null&&s!==undefined?bar(s,m):'<span style="color:#3a5060">—</span>'}</td>
          </tr>`).join("")}
          <tr class="obp-total">
            <td style="color:#e8eaf0;font-size:12px">TOTAL OBP</td>
            <td style="color:#3a5060;font-size:11px">10</td>
            <td>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:${oC(obpTotal)}">${obpTotal}</span>
                <span style="font-family:'Space Mono',monospace;font-size:9px;color:${oC(obpTotal)};letter-spacing:.06em">${obpTotal>=9?"ELITE":obpTotal>=7?"GOOD":obpTotal>=5?"AVERAGE":"POOR"}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div>
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#00c896;letter-spacing:.08em;margin-bottom:8px">TRADE BREAKDOWN</div>
    <div style="border:1px solid #1e2a38;border-radius:8px;overflow:hidden;background:#111820">
      <table>
        <thead><tr><th>FIELD</th><th>VALUE</th></tr></thead>
        <tbody>
          ${tradeRows.map(([k,v],ri)=>`
          <tr style="${ri%2===0?'':'background:#0a0c1060'}">
            <td style="color:#7a8fa8">${k}</td>
            <td style="font-family:'Space Mono',monospace;font-weight:700;color:${
              k==="Daily Rule"?(v.includes("SAFE")?"#00c896":"#e05252"):
              k==="Result"?(v==="Win"?"#00c896":v==="Loss"?"#e05252":"#e6a817"):
              k==="Net P&L"?(v.includes("-")?"#e05252":"#00c896"):"#e8eaf0"
            }">${v}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- RISK MANAGER ANALYSIS -->
${e.text ? `<div>
  <div style="font-family:'Space Mono',monospace;font-size:9px;color:#00c896;letter-spacing:.08em;margin-bottom:8px">RISK MANAGER ANALYSIS</div>
  <div class="report-pre">${e.text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
</div>` : ""}

<!-- FOOTER -->
<div style="margin-top:28px;padding-top:12px;border-top:1px solid #1e2a38;font-family:'Space Mono',monospace;font-size:9px;color:#1e2a38;display:flex;justify-content:space-between">
  <span>NQ RISK MANAGER JOURNAL · TRADIEFY · ATM MODEL · OBP SYSTEM</span>
  <span>${e.day.toUpperCase()} · ${e.week}${e.date?" · "+e.date:""}</span>
</div>

</body></html>`;

    try {
      const blob = new Blob([html], { type:"text/html;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `NQ-${e.day}-${e.week}.html`;
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{ URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
    } catch(err) {
      const a = document.createElement("a");
      a.href = "data:text/html;charset=utf-8," + encodeURIComponent(html);
      a.download = `NQ-${e.day}-${e.week}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
  }

  // ── RENDER ──
  return (
    <div style={{ ...sans, background: C.bg, minHeight: "100vh", color: C.text, padding: "1.5rem 1.25rem" }}>
      <style dangerouslySetInnerHTML={{__html:`@import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700&family=Inter:wght@300;400;500;600&display=swap');@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem" }}>
        <div>
          <div style={{ ...mono, fontSize: 9, color: "#00c896", letterSpacing: "0.14em", marginBottom: 6 }}>TRADIEFY · NQ FUTURES · $25K INSTANT FUNDED</div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: C.text, lineHeight: 1.2 }}>
            Risk Manager <span style={{ ...mono, color: "#00c896" }}>Journal</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>ATM Model · OBP Execution System · Discipline over profit</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <input type="week" value={week} onChange={e => setWeek(e.target.value)}
            style={{ ...mono, fontSize: 11, padding: "5px 10px", width: "auto", color: C.slate, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 4, display: "block", marginLeft: "auto" }} />
          <div style={{...mono, fontSize: 9, color: "#e8eaf0", textAlign:"right", marginBottom: 6, letterSpacing:"0.06em"}}>{new Date().toLocaleDateString("en-GB",{weekday:"long",day:"2-digit",month:"short",year:"numeric"})}</div>
          {editingBal ? (
            <div style={{display:"flex",gap:6,alignItems:"center",justifyContent:"flex-end"}}>
              <input type="number" value={balInput} onChange={e=>setBalInput(e.target.value)}
                style={{...mono,fontSize:13,width:110,padding:"4px 8px",background:C.surface,border:`1px solid #00c896`,borderRadius:6,color:C.text,textAlign:"right"}}
                onKeyDown={e=>{if(e.key==="Enter"){const v=parseFloat(balInput);if(!isNaN(v)){setStartBalance(v);try{window.storage.set("nq_startbal",String(v));}catch(e){}localStorage.setItem("nq_startbal",String(v));setEditingBal(false);}}}'}
                autoFocus
              />
              <button onClick={()=>{const v=parseFloat(balInput);if(!isNaN(v)){setStartBalance(v);try{window.storage.set("nq_startbal",String(v));}catch(e){}localStorage.setItem("nq_startbal",String(v));}setEditingBal(false);}}
                style={{...mono,fontSize:10,padding:"4px 10px",background:"#00c896",color:C.bg,border:"none",borderRadius:6,cursor:"pointer",fontWeight:700}}>SET</button>
            </div>
          ) : (
            <div onClick={()=>setEditingBal(true)} style={{cursor:"pointer"}} title="Click to update balance">
              <div style={{ ...mono, fontSize: 17, fontWeight: 700, color: "#e8eaf0" }}>
                ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ ...mono, fontSize: 9, color:"#e8eaf0", marginTop: 2, letterSpacing: "0.06em" }}>CLICK BALANCE TO EDIT</div>
            </div>
          )}
          <div style={{ ...mono, fontSize: 9, color: "#e6a817", marginTop: 3, letterSpacing: "0.06em" }}>${toTarget.toFixed(0)} TO TARGET</div>
          <div style={{ width: 130, height: 3, background: C.dim, borderRadius: 2, marginTop: 6, overflow: "hidden", marginLeft: "auto" }}>
            <div style={{ height: "100%", width: `${targetPct}%`, background: "linear-gradient(90deg,#e6a817,#f59e0b)", borderRadius: 2, transition: "width 0.6s ease" }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: "1.5rem" }}>
        {[["entry","DAILY DEBRIEF"],["log","TRADE LOG"],["weekly","WEEKLY REPORT"],["behavior","BEHAVIOUR"],["ref","SYSTEM REF"]].map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); if (t==="weekly") { if (!weeklyReport || weeklyReport.error) generateWeekly(); } }}
            style={{ ...mono, padding: "9px 16px", fontSize: 11, cursor: "pointer", border: "none",
              borderBottom: `2px solid ${tab===t ? "#00c896" : "transparent"}`,
              background: "none", color: tab===t ? C.text : C.muted, letterSpacing: "0.06em", transition: "all 0.15s" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ DAILY ENTRY ══ */}
      {tab === "entry" && (
        <div>
          <JournalBanner />
          {/* Day pills with actual dates */}
          {(() => {
            // Compute Mon–Fri dates for selected week
            const [yr, wn] = week.split("-W").map(Number);
            const jan4 = new Date(yr, 0, 4);
            const mon = new Date(jan4);
            mon.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (wn - 1) * 7);
            return (
              <div style={{ display: "flex", gap: 6, marginBottom: "1.25rem", flexWrap: "wrap" }}>
                {DAYS.map((d, i) => {
                  const dayDate = new Date(mon);
                  dayDate.setDate(mon.getDate() + i);
                  const dateStr = dayDate.toLocaleDateString("en-GB", { day:"2-digit", month:"short" });
                  const has = weekEntries.some(e => e.dayIdx === i);
                  const act = activeDay === i;
                  return (
                    <button key={d} onClick={() => setActiveDay(i)} style={{
                      ...mono, padding: "6px 14px", fontSize: 11, borderRadius: 6, cursor: "pointer",
                      border: `1px solid ${act ? "#00c896" : has ? "#00c89640" : C.border}`,
                      background: act ? "#00c896" : "none",
                      color: act ? C.bg : has ? "#00c896" : C.muted,
                      fontWeight: act ? 700 : 400, letterSpacing: "0.06em", transition: "all 0.12s",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    }}>
                      <span>{DAY_SHORT[i]}</span>
                      <span style={{ fontSize: 8, color: "#e8eaf0", opacity: 0.8, fontWeight: 400 }}>{dateStr}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Inner tab bar: Debrief / Tradovate */}
          <div style={{ display: "flex", gap: 4, marginBottom: "1rem" }}>
            {[["debrief","DEBRIEF INPUT"],["tradovate","TRADOVATE DATA"]].map(([t,label]) => (
              <button key={t} onClick={() => setInnerTab(t)} style={{
                ...mono, padding: "6px 16px", fontSize: 11, borderRadius: 6, cursor: "pointer",
                border: `1px solid ${innerTab===t ? "#00c896" : C.border}`,
                background: innerTab===t ? "#00c896" : "none",
                color: innerTab===t ? C.bg : C.muted,
                fontWeight: innerTab===t ? 700 : 400, letterSpacing: "0.06em", transition: "all 0.12s",
              }}>{label}</button>
            ))}
          </div>

          {/* Debrief Input */}
          {innerTab === "debrief" && (
          <div style={card}>
            <div style={secLabel}>DEBRIEF INPUT — {DAYS[activeDay].toUpperCase()}<div style={secLine} /></div>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              style={{ ...sans, fontSize: 13, width: "100%", border: `1px solid ${C.border}`, borderRadius: 8,
                padding: "10px 12px", background: C.bg, color: C.text, lineHeight: 1.65,
                resize: "vertical", minHeight: 110, outline: "none" }}
              placeholder={`Talk naturally. Just tell me what happened.\n\nE.g: "TOOK ATM MODEL TRADE TODAY, TARGET WAS 1.56R TOOK 1.26R SURVIVAL MODE, WIN $140. MODEL HAD 80 POINTS AVAILABLE I EXTRACTED 65 POINTS."\n\nMention: P&L · Win/Loss · ATM Model or not · R:R available vs taken · model points available & extracted · emotions · mistakes.`} />
            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Btn primary onClick={generate} disabled={loading || !input.trim()}>{loading ? MSGS[loadTick] : "GENERATE REPORT ↗"}</Btn>
              <Btn onClick={() => { setInput(""); setReport(null); }}>CLEAR</Btn>
              {saved && <span style={{ ...mono, fontSize: 10, color: "#00c896", letterSpacing: "0.06em" }}>✓ ENTRY SAVED</span>}
            </div>
            {loading && (
              <div style={{ marginTop: 12, height: 2, background: C.dim, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", background: `linear-gradient(90deg,${C.muted},${C.slate},${C.muted})`, backgroundSize: "200%", animation: "shimmer 1.5s linear infinite", borderRadius: 2 }} />
              </div>
            )}
          </div>
          )}

          {/* Tradovate Data */}
          {innerTab === "tradovate" && (
            <TradovateTab dayIdx={activeDay} week={week} entries={entries} persist={persist} setEntries={setEntries} />
          )}


          {/* Report output */}
          {report && !loading && (
            <div style={card}>
              {/* Report header with pills */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ ...secLabel, marginBottom: 4 }}>RISK MANAGER REPORT<div style={secLine} /></div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{report.day} · Week {week} · <span style={{...mono,fontSize:11,color:"#3a5060"}}>{new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</span></div>
                </div>
                {report.parsed && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {/* OBP pill */}
                    <div style={{ background: obpBig(report.parsed.obp) + "18", border: `1px solid ${obpBig(report.parsed.obp)}40`, borderRadius: 10, padding: "8px 16px", textAlign: "center", minWidth: 64 }}>
                      <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: obpBig(report.parsed.obp), lineHeight: 1 }}>{report.parsed.obp || "—"}</div>
                      <div style={{ ...mono, fontSize: 8, color: obpBig(report.parsed.obp), opacity: 0.7, marginTop: 2, letterSpacing: "0.06em" }}>OBP / 10</div>
                    </div>
                    {/* Grade pill */}
                    {report.parsed.grade && report.parsed.grade !== "—" && (
                      <div style={{ background: gradeC(report.parsed.grade) + "18", border: `1px solid ${gradeC(report.parsed.grade)}40`, borderRadius: 10, padding: "8px 16px", textAlign: "center", minWidth: 56 }}>
                        <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: gradeC(report.parsed.grade), lineHeight: 1 }}>{report.parsed.grade}</div>
                        <div style={{ ...mono, fontSize: 8, color: gradeC(report.parsed.grade), opacity: 0.7, marginTop: 2, letterSpacing: "0.06em" }}>GRADE</div>
                      </div>
                    )}
                    {/* Health pill */}
                    {report.parsed.health && (
                      <span style={pill(healthC(report.parsed.health))}>{report.parsed.health}</span>
                    )}
                    {/* Outcome pill */}
                    {report.parsed.outcome && (
                      <span style={pill(outC(report.parsed.outcome))}>{report.parsed.outcome.toUpperCase()}</span>
                    )}
                  </div>
                )}
              </div>

              {/* OBP table rendered from parsed data */}
              <OBPTable obpData={report.obpData} />
              {/* Trade Breakdown table */}
              <TradeTable tradeData={report.tradeData} />

              {/* Rest of report text */}
              <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.8,
                padding: "1.25rem", border: `1px solid ${C.border}`, borderRadius: 10,
                background: C.bg, color: "#9ab8c8", fontFamily: "'Inter',sans-serif" }}>
                {report.text}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <Btn primary onClick={saveEntry}>SAVE ENTRY</Btn>
                <CopyBtn text={report.rawText || report.text} />
                <Btn onClick={() => setReport(null)}>DISCARD</Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TRADE LOG ══ */}
      {tab === "log" && (
        <div>
          {!weekEntries.length
            ? <div style={{ textAlign:"center", padding:"3rem", color:C.dim, ...mono, fontSize:11, letterSpacing:"0.05em" }}>NO ENTRIES THIS WEEK YET<br/><span style={{fontSize:9,marginTop:6,display:"block"}}>DEBRIEF YOUR FIRST DAY TO GET STARTED</span></div>
            : (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:"1.25rem" }}>
                  {[
                    { label:"DAYS LOGGED", val:`${weekEntries.length}/5`, color:C.text },
                    { label:"WEEK P&L",    val:`${weekNet>=0?"+":""}$${weekNet.toFixed(0)}`, color:pnlC(weekNet) },
                    { label:"AVG OBP",     val:avgObpWeek!==null?`${avgObpWeek.toFixed(1)}/10`:"—", color:avgObpWeek!==null?obpBig(avgObpWeek):C.muted },
                    { label:"TO TARGET",   val:`$${toTarget.toFixed(0)}`, color:C.slate },
                  ].map(({label,val,color}) => (
                    <div key={label} style={metricCard}>
                      <div style={{...mono,fontSize:9,color:"#6a7a90",letterSpacing:"0.08em",marginBottom:6}}>{label}</div>
                      <div style={{...mono,fontSize:18,fontWeight:700,color}}>{val}</div>
                    </div>
                  ))}
                </div>
                {weekEntries.map(e => (
                  <div key={e.id} style={{background:"#111820",border:`1px solid #1e2a38`,borderRadius:12,padding:"1.25rem",marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{...mono,fontSize:13,fontWeight:700,color:"#e8eaf0",letterSpacing:"0.04em"}}>{e.day.toUpperCase()}</div>{e.date&&<div style={{...mono,fontSize:10,color:"#3a5060"}}>{e.date}</div>}</div>
                        <div style={{width:1,height:14,background:"#2a3a4a"}}/>
                        <div style={{...mono,fontSize:12,fontWeight:700,color:pnlC(e.pnl)}}>{e.pnl>=0?"+":""}${e.pnl}</div>
                        <div style={{...mono,fontSize:11,fontWeight:700,color:obpBig(e.obp)}}>OBP {e.obp}/10</div>
                        {e.grade&&e.grade!=="—"&&<span style={pill(gradeC(e.grade))}>{e.grade}</span>}
                        {e.health&&<span style={pill(healthC(e.health))}>{e.health}</span>}
                        {e.outcome&&<span style={pill(outC(e.outcome))}>{e.outcome.toUpperCase()}</span>}
                        {e.extraction>0&&<span style={pill(C.slate)}>{e.extraction}% EXT</span>}
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>exportDailyReport(e)} style={{...mono,padding:"5px 12px",fontSize:10,fontWeight:700,borderRadius:8,cursor:"pointer",background:"#00c896",color:"#09080f",border:"none",letterSpacing:"0.05em"}}>EXPORT ↗</button>
                        <Btn small onClick={() => deleteEntry(e.week,e.dayIdx)}>DELETE</Btn>
                      </div>
                    </div>
                    <div style={{fontSize:12,color:"#7a8fa8",fontStyle:"italic",borderLeft:`2px solid #00c896`,borderOpacity:0.4,paddingLeft:10,lineHeight:1.6,marginBottom:10}}>"{e.rawInput}"</div>
                    {e.obpData && <OBPTable obpData={e.obpData} />}
                    {e.tradeData && <TradeTable tradeData={e.tradeData} />}
                    <div style={{whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.75,maxHeight:220,overflowY:"auto",color:"#8fa8b8",fontFamily:"'Inter',sans-serif"}}>{stripOBPTable(e.text||"")}</div>
                  </div>
                ))}
              </>
            )}
        </div>
      )}

      {/* ══ WEEKLY REPORT ══ */}
      {tab === "weekly" && (
        <div>
          {!weekEntries.length
            ? <div style={{textAlign:"center",padding:"3rem",color:C.dim,...mono,fontSize:11,letterSpacing:"0.05em"}}>LOG AT LEAST ONE DAY FIRST<br/><span style={{fontSize:9,marginTop:6,display:"block"}}>YOUR WEEKLY REPORT GENERATES AUTOMATICALLY</span></div>
            : (
              <>
                {/* Stats grid */}
                {(() => {
                  const wins = weekEntries.filter(e=>e.outcome==="Win").length;
                  const losses = weekEntries.filter(e=>e.outcome==="Loss").length;
                  const total = weekEntries.length;
                  const winRate = total ? Math.round(wins/total*100) : 0;
                  const avgO = total ? (weekEntries.reduce((s,e)=>s+(e.obp||0),0)/total) : 0;
                  const totalAvail = weekEntries.reduce((s,e)=>s+(e.ptsAvail||0),0);
                  const totalGot   = weekEntries.reduce((s,e)=>s+(e.ptsGot||0),0);
                  const avgExt = totalAvail>0?Math.round(totalGot/totalAvail*100):null;
                  const highObp = weekEntries.filter(e=>e.obp>=8).length;
                  const expectancy = total ? weekEntries.reduce((s,e)=>s+(e.pnl||0),0)/total : 0;
                  const modelDays = weekEntries.filter(e=>e.tradeData?.model&&!e.tradeData.model.includes("No Model")).length;
                  const modelPresence = total ? Math.round(modelDays/total*100) : 0;
                  return (
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:"1rem"}}>
                      {[
                        {label:"WIN RATE",         val:total?`${winRate}%`:"—",           sub:`${wins}W / ${losses}L`,                                           color:winRate>=50?C.silver:C.red},
                        {label:"AVG OBP",           val:total?`${avgO.toFixed(1)}/10`:"—", sub:`${highObp}/${total} high execution days`,                        color:total?obpBig(avgO):C.muted},
                        {label:"EXTRACTION EFF",    val:avgExt!==null?`${avgExt}%`:"—",   sub:totalAvail>0?`${totalGot} / ${totalAvail} pts`:"add pts to debrief", color:avgExt>=70?C.silver:avgExt>=40?C.amber:avgExt!==null?C.red:C.muted},
                        {label:"EXPECTANCY",        val:total?`${expectancy>=0?"+":""}$${expectancy.toFixed(0)}`:"—", sub:"avg P&L per trading day",             color:expectancy>=0?C.silver:C.red},
                        {label:"MODEL PRESENCE",    val:total?`${modelPresence}%`:"—",     sub:`${modelDays}/${total} days with ATM model`,                      color:modelPresence>=80?C.silver:modelPresence>=50?C.amber:C.red},
                        {label:"EDGE UTILIZATION",  val:totalAvail>0?`${Math.round(totalGot/totalAvail*100)}%`:"—", sub:`${totalGot}/${totalAvail} pts extracted`,     color:totalAvail>0?(Math.round(totalGot/totalAvail*100)>=40?C.silver:Math.round(totalGot/totalAvail*100)>=25?C.amber:C.red):C.muted},
                        {label:"WEEK P&L",          val:`${weekNet>=0?"+":""}$${weekNet.toFixed(0)}`, sub:`${total} days · $${balance.toLocaleString()} bal`,    color:pnlC(weekNet)},
                      ].map(({label,val,sub,color})=>(
                        <div key={label} style={metricCard}>
                          <div style={{...mono,fontSize:9,color:C.muted,letterSpacing:"0.08em",marginBottom:5}}>{label}</div>
                          <div style={{...mono,fontSize:17,fontWeight:700,color,lineHeight:1}}>{val}</div>
                          <div style={{...mono,fontSize:9,color:C.muted,marginTop:4}}>{sub}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* 5 day cards */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:"1.25rem"}}>
                  {DAYS.map((d,i)=>{
                    const e = weekEntries.find(x=>x.dayIdx===i);
                    return (
                      <div key={d} style={{...metricCard,borderColor:e?obpBig(e.obp)+"30":C.border,textAlign:"center"}}>
                        <div style={{...mono,fontSize:9,color:C.muted,letterSpacing:"0.08em",marginBottom:5}}>{DAY_SHORT[i]}</div>
                        {e ? (
                          <>
                            <div style={{...mono,fontSize:14,fontWeight:700,color:obpBig(e.obp),lineHeight:1}}>{e.obp}/10</div>
                            <div style={{...mono,fontSize:10,color:pnlC(e.pnl),marginTop:3}}>{e.pnl>=0?"+":""}${e.pnl}</div>
                            {e.extraction>0&&<div style={{...mono,fontSize:9,color:C.muted,marginTop:2}}>{e.extraction}% ext</div>}
                            {e.outcome&&<div style={{...mono,fontSize:8,color:outC(e.outcome),marginTop:2,letterSpacing:"0.04em"}}>{e.outcome.toUpperCase()}</div>}
                          </>
                        ) : <div style={{...mono,fontSize:12,color:C.dim}}>—</div>}
                      </div>
                    );
                  })}
                </div>

                {/* Behavior Metrics */}
                <WeekBehaviorSummary weekEntries={weekEntries} />

                {/* AI weekly report */}
                <div style={card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem",flexWrap:"wrap",gap:8}}>
                    <div style={{...secLabel,marginBottom:0,flex:1}}>WEEKLY RISK MANAGER REPORT<div style={secLine}/></div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={exportWeeklyPDF} disabled={exporting} style={{...mono,padding:"7px 14px",fontSize:10,fontWeight:700,borderRadius:8,cursor:exporting?"not-allowed":"pointer",background:"#00c896",color:C.bg,border:"none",letterSpacing:"0.05em",opacity:exporting?0.5:1}}>
                          {exporting?"DOWNLOADING...":"EXPORT REPORT ↗"}
                        </button>
                        <Btn onClick={generateWeekly} disabled={weeklyLoading}>{weeklyLoading?"GENERATING...":"REGENERATE ↗"}</Btn>
                      </div>
                      <div style={{...mono,fontSize:9,color:C.muted,letterSpacing:"0.04em"}}>downloads .html → open in browser → Ctrl+P → Save as PDF</div>
                    </div>
                  </div>
                  {weeklyLoading&&(
                    <div style={{padding:"1.5rem 0"}}>
                      <div style={{...mono,fontSize:10,color:C.slate,letterSpacing:"0.1em",textAlign:"center",marginBottom:10}}>GENERATING WEEKLY ANALYSIS...</div>
                      <div style={{height:2,background:C.dim,borderRadius:2,overflow:"hidden"}}>
                        <div style={{height:"100%",background:`linear-gradient(90deg,${C.muted},${C.slate},${C.muted})`,backgroundSize:"200%",animation:"shimmer 1.5s linear infinite"}}/>
                      </div>
                    </div>
                  )}
                  {weeklyReport&&!weeklyLoading&&typeof weeklyReport==="object"&&(
                    <WeeklyReportUI data={weeklyReport} week={week} weekEntries={weekEntries} weekNet={weekNet} balance={balance} startBalance={startBalance} toTarget={toTarget} />
                  )}
                </div>
              </>
            )}
        </div>
      )}

      {/* ══ BEHAVIOUR RESEARCH ══ */}
      {tab === "behavior" && (
        <BehaviorResearch entries={entries} week={week} weekEntries={weekEntries} persist={persist} setEntries={setEntries} />
      )}

      {/* ══ SYSTEM REFERENCE ══ */}
      {tab === "ref" && (
        <SystemReference entries={entries} weekEntries={weekEntries} />
      )}
    </div>
  );
}
