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

      {/* ── Risk Manager Message ── */}
      <div style={{borderLeft:`3px solid #00c896`,padding:"12px 16px",background:"#00c89608",borderRadius:"0 10px 10px 0"}}>
        <div style={{...mono,fontSize:9,color:"#00a87a",letterSpacing:"0.08em",marginBottom:6}}>RISK MANAGER SAYS</div>
        <div style={{...sans,fontSize:13,color:C.text,lineHeight:1.6,fontStyle:"italic"}}>"{data.riskManagerMessage}"</div>
      </div>
    </div>
  );
}


// ── Tradovate Order Data Parser ──
function TradovateTab({ dayIdx, week, entries, persist, setEntries }) {
  const [rawData, setRawData] = useState("");
  const [parsed, setParsed] = useState(null);
  const [saved, setSaved] = useState(false);

  // Load saved tradovate data for this day
  useEffect(() => {
    const entry = entries.find(e => e.week === week && e.dayIdx === dayIdx);
    if (entry?.tradovateRaw) setRawData(entry.tradovateRaw);
    if (entry?.tradovateParsed) setParsed(entry.tradovateParsed);
  }, [dayIdx, week, entries]);

  function parseOrders(raw) {
    if (!raw.trim()) return null;
    const lines = raw.trim().split("\n").map(l => l.trim()).filter(Boolean);

    // Try to detect CSV headers or tab-separated data
    // Common Tradovate export columns: Time, Symbol, Side, Qty, Price, Fill Price, P&L, Commission
    const orders = [];
    let headers = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(/[\t,]/).map(p => p.trim().replace(/^"|"$/g, ""));

      // Detect header row
      if (i === 0 && parts.some(p => /time|date|symbol|side|qty|price|p.l|pnl|profit|fill/i.test(p))) {
        headers = parts.map(p => p.toLowerCase().replace(/[^a-z0-9]/g, ""));
        continue;
      }

      if (parts.length >= 3) {
        const obj = {};
        if (headers.length) {
          headers.forEach((h, idx) => { obj[h] = parts[idx] || ""; });
        } else {
          // Headerless — try positional guessing
          obj.raw = parts;
        }

        // Normalise common field names
        const side = (obj.side || obj.buysell || obj.action || "").toUpperCase();
        const pnlRaw = obj.pl || obj.pnl || obj.profit || obj.realizedpnl || obj.netpnl || "";
        const pnl = parseFloat(pnlRaw.replace(/[$,()]/g, "").replace(/^\(/, "-")) || 0;
        const qty = parseInt(obj.qty || obj.quantity || obj.contracts || obj.filled || 1);
        const price = parseFloat(obj.fillprice || obj.avgprice || obj.price || 0);
        const symbol = obj.symbol || obj.contract || "NQ";
        const time = obj.time || obj.datetime || obj.date || "";
        const commission = parseFloat((obj.commission || obj.comm || obj.fees || "0").replace(/[$,]/g,"")) || 0;

        if (side || pnl !== 0 || price > 0) {
          orders.push({ side, pnl, qty, price, symbol, time, commission, raw: parts });
        }
      }
    }

    if (!orders.length) {
      // Last resort: try to extract numbers line by line
      lines.forEach(line => {
        const nums = line.match(/-?\$?[\d,]+\.?\d*/g);
        if (nums && nums.length >= 2) {
          const pnl = parseFloat(nums[nums.length-1].replace(/[$,]/g,""));
          orders.push({ side: line.toLowerCase().includes("sell") ? "SELL" : line.toLowerCase().includes("buy") ? "BUY" : "?", pnl, qty:1, price:0, symbol:"NQ", time:"", commission:0, raw:[line] });
        }
      });
    }

    if (!orders.length) return null;

    // Calculate stats
    const trades = orders.filter(o => o.pnl !== 0 || o.side);
    const wins = trades.filter(o => o.pnl > 0);
    const losses = trades.filter(o => o.pnl < 0);
    const breakevens = trades.filter(o => o.pnl === 0);
    const totalPnl = trades.reduce((s, o) => s + o.pnl, 0);
    const totalComm = trades.reduce((s, o) => s + o.commission, 0);
    const winRate = trades.length ? Math.round(wins.length / trades.length * 100) : 0;
    const avgWin = wins.length ? wins.reduce((s,o)=>s+o.pnl,0)/wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s,o)=>s+o.pnl,0)/losses.length : 0;
    const profitFactor = Math.abs(avgLoss) > 0 ? Math.abs(avgWin * wins.length / (avgLoss * losses.length)) : 0;
    const largestWin = wins.length ? Math.max(...wins.map(o=>o.pnl)) : 0;
    const largestLoss = losses.length ? Math.min(...losses.map(o=>o.pnl)) : 0;

    return { trades, wins, losses, breakevens, totalPnl, totalComm, winRate, avgWin, avgLoss, profitFactor, largestWin, largestLoss, rawCount: lines.length };
  }

  function handleParse() {
    const result = parseOrders(rawData);
    setParsed(result);
  }

  async function saveData() {
    const result = parseOrders(rawData);
    setParsed(result);
    // Update the entry in storage
    const updated = entries.map(e => {
      if (e.week === week && e.dayIdx === dayIdx) {
        return { ...e, tradovateRaw: rawData, tradovateParsed: result };
      }
      return e;
    });
    // If no entry yet for this day, can't save (need debrief first)
    setEntries(updated);
    await persist(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const Stat = ({ label, val, color, sub }) => (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.875rem" }}>
      <div style={{ ...mono, fontSize: 9, color: C.muted, letterSpacing: "0.08em", marginBottom: 5 }}>{label}</div>
      <div style={{ ...mono, fontSize: 17, fontWeight: 700, color: color || C.text, lineHeight: 1 }}>{val}</div>
      {sub && <div style={{ ...mono, fontSize: 9, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const TRow = ({ label, val, color }) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "8px 12px", borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
      <div style={{ ...sans, fontSize: 12, color: C.muted }}>{label}</div>
      <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: color || C.text }}>{val}</div>
    </div>
  );

  return (
    <div>
      <div style={card}>
        <div style={secLabel}>TRADOVATE ORDER DATA — {["MON","TUE","WED","THU","FRI"][dayIdx]}<div style={secLine}/></div>
        <div style={{ ...sans, fontSize: 11, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
          Paste your Tradovate order/trade data below. Works with CSV export, tab-separated, or any format from the fills report.
        </div>
        <textarea
          value={rawData}
          onChange={e => setRawData(e.target.value)}
          style={{ ...sans, fontSize: 12, width: "100%", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", background: C.bg, color: C.text, lineHeight: 1.6, resize: "vertical", minHeight: 130, outline: "none", fontFamily: "monospace" }}
          placeholder={`Paste raw Tradovate data here. Examples:\n\nWith headers:\nTime,Symbol,Side,Qty,Fill Price,P&L,Commission\n09:32:14,NQH4,BUY,1,18245.50,,,\n09:34:22,NQH4,SELL,1,18262.75,,347.50,4.34\n\nOr just paste any rows from fills/orders report.`}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Btn primary onClick={handleParse} disabled={!rawData.trim()}>PARSE DATA ↗</Btn>
          {parsed && <Btn onClick={saveData}>SAVE TO ENTRY</Btn>}
          <Btn onClick={() => { setRawData(""); setParsed(null); }}>CLEAR</Btn>
          {saved && <span style={{ ...mono, fontSize: 10, color: "#00c896", letterSpacing: "0.06em" }}>✓ SAVED</span>}
        </div>
      </div>

      {parsed && parsed.trades?.length === 0 && (
          <div style={{ ...card, textAlign: "center", color: C.muted, fontSize: 12, padding: "1.5rem" }}>
            Could not parse trades. Try copying the fills/orders table with headers included.
          </div>
      )}
      {parsed && parsed.trades?.length > 0 && (
          <div>
            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 12 }}>
              <Stat label="TOTAL TRADES" val={parsed.trades.length} color={C.text}/>
              <Stat label="WIN RATE" val={`${parsed.winRate}%`} color={parsed.winRate>=50?"#00c896":C.red} sub={`${parsed.wins.length}W · ${parsed.losses.length}L · ${parsed.breakevens.length}BE`}/>
              <Stat label="NET P&L" val={`${parsed.totalPnl>=0?"+":""}$${parsed.totalPnl.toFixed(2)}`} color={pnlC(parsed.totalPnl)} sub={`after $${parsed.totalComm.toFixed(2)} comm`}/>
              <Stat label="PROFIT FACTOR" val={parsed.profitFactor>0?parsed.profitFactor.toFixed(2):"—"} color={parsed.profitFactor>=1.5?"#00c896":parsed.profitFactor>=1?C.amber:C.red}/>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {/* Performance table */}
              <div style={{ ...card, padding: "1rem" }}>
                <div style={{ ...secLabel, marginBottom: 10 }}>PERFORMANCE BREAKDOWN<div style={secLine}/></div>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <TRow label="Avg Win" val={`$${parsed.avgWin.toFixed(2)}`} color="#00c896"/>
                  <TRow label="Avg Loss" val={`$${parsed.avgLoss.toFixed(2)}`} color={C.red}/>
                  <TRow label="Largest Win" val={`$${parsed.largestWin.toFixed(2)}`} color="#00c896"/>
                  <TRow label="Largest Loss" val={`$${parsed.largestLoss.toFixed(2)}`} color={C.red}/>
                  <TRow label="Total Commission" val={`$${parsed.totalComm.toFixed(2)}`} color={C.amber}/>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "8px 12px", alignItems: "center" }}>
                    <div style={{ ...sans, fontSize: 12, color: C.muted }}>Win/Loss Ratio</div>
                    <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: Math.abs(parsed.avgWin)>Math.abs(parsed.avgLoss)?"#00c896":C.red }}>{parsed.avgLoss!==0?Math.abs(parsed.avgWin/parsed.avgLoss).toFixed(2):"—"}</div>
                  </div>
                </div>
              </div>

              {/* Trade list */}
              <div style={{ ...card, padding: "1rem" }}>
                <div style={{ ...secLabel, marginBottom: 10 }}>TRADE LIST<div style={secLine}/></div>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 60px 70px", background: C.bg, padding: "6px 10px", borderBottom: `1px solid ${C.border}` }}>
                    {["#","SIDE","QTY","P&L"].map(h => <div key={h} style={{ ...mono, fontSize: 8, color: C.muted, letterSpacing: "0.06em" }}>{h}</div>)}
                  </div>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {parsed.trades.map((t, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr 60px 70px", padding: "7px 10px", borderBottom: i < parsed.trades.length-1 ? `1px solid ${C.border}` : "none", alignItems: "center", background: i%2===0?"transparent":C.bg+"60" }}>
                        <div style={{ ...mono, fontSize: 10, color: C.muted }}>{i+1}</div>
                        <div style={{ ...mono, fontSize: 11, fontWeight: 700, color: t.side==="BUY"?"#00c896":t.side==="SELL"?C.red:C.muted }}>{t.side||"?"}</div>
                        <div style={{ ...mono, fontSize: 11, color: C.slate }}>{t.qty}</div>
                        <div style={{ ...mono, fontSize: 11, fontWeight: 700, color: pnlC(t.pnl) }}>{t.pnl>=0?"+":""}${t.pnl.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* OBP alignment note */}
            <div style={{ borderLeft: `3px solid ${C.amber}`, padding: "10px 14px", background: C.amber+"0a", borderRadius: "0 8px 8px 0", marginBottom: 12 }}>
              <div style={{ ...mono, fontSize: 9, color: C.amber, letterSpacing: "0.08em", marginBottom: 4 }}>TRADOVATE vs OBP NOTE</div>
              <div style={{ ...sans, fontSize: 12, color: C.text, lineHeight: 1.5 }}>
                Win rate from raw orders: <span style={{ color: parsed.winRate>=50?"#00c896":C.red, fontWeight: 600 }}>{parsed.winRate}%</span>. 
                Remember — a losing trade with high OBP is still a good trade. Compare this with your OBP score in the Debrief tab.
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}


// ── Banner Component ──
function JournalBanner() {
  return (
    <svg width="100%" viewBox="0 0 680 200" xmlns="http://www.w3.org/2000/svg" style={{display:"block",marginBottom:"1.5rem",borderRadius:12,overflow:"hidden"}}>
      <defs>
        <linearGradient id="bbg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#020a06"/>
          <stop offset="60%" stopColor="#041210"/>
          <stop offset="100%" stopColor="#061a14"/>
        </linearGradient>
        <linearGradient id="bvfade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00c896" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#00c896" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="bfloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00c896" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#00c896" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="bglow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00c896" stopOpacity="0"/>
          <stop offset="50%" stopColor="#00c896" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#00c896" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="bsilgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#112218"/>
          <stop offset="100%" stopColor="#06100a"/>
        </linearGradient>
        <linearGradient id="bcenter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00c896" stopOpacity="0.12"/>
          <stop offset="100%" stopColor="#00c896" stopOpacity="0"/>
        </linearGradient>
        <clipPath id="bclip"><rect width="680" height="200"/></clipPath>
      </defs>
      <g clipPath="url(#bclip)">

        {/* background */}
        <rect width="680" height="200" fill="url(#bbg)"/>

        {/* center vertical teal glow column */}
        <rect x="300" y="0" width="80" height="200" fill="url(#bcenter)"/>

        {/* grid lines */}
        {[80,160,240,340,440,520,600].map((x,i)=>(
          <line key={"vg"+i} x1={x} y1="0" x2={x} y2="200" stroke="#00c896" strokeOpacity="0.04" strokeWidth="0.5"/>
        ))}
        {[50,100,150].map((y,i)=>(
          <line key={"hg"+i} x1="0" y1={y} x2="680" y2={y} stroke="#00c896" strokeOpacity="0.04" strokeWidth="0.5"/>
        ))}

        {/* floor glow */}
        <rect x="0" y="165" width="680" height="35" fill="url(#bfloor)"/>
        <line x1="0" y1="165" x2="680" y2="165" stroke="url(#bglow)" strokeWidth="1.5"/>
        <ellipse cx="340" cy="165" rx="140" ry="10" fill="#00c896" fillOpacity="0.05"/>

        {/* ── TRADER SILHOUETTE ── */}
        {/* base platform */}
        <rect x="295" y="148" width="90" height="17" rx="2" fill="#081a10"/>
        <rect x="305" y="135" width="70" height="30" rx="1" fill="#081a10"/>
        {/* torso */}
        <rect x="318" y="105" width="44" height="45" rx="2" fill="#071510"/>
        {/* neck + head */}
        <rect x="330" y="82" width="20" height="28" rx="3" fill="#071510"/>
        <ellipse cx="340" cy="76" rx="14" ry="16" fill="#081a10"/>
        {/* shoulders wide */}
        <rect x="308" y="108" width="64" height="12" rx="3" fill="#091a12"/>
        {/* left arm down */}
        <rect x="308" y="116" width="10" height="38" rx="4" fill="#071510"/>
        {/* right arm raised — like pointing/confident */}
        <rect x="362" y="88" width="10" height="30" rx="4" fill="#071510" transform="rotate(-30 367 88)"/>
        {/* left leg */}
        <rect x="318" y="148" width="14" height="20" rx="3" fill="#071510"/>
        {/* right leg */}
        <rect x="348" y="148" width="14" height="20" rx="3" fill="#071510"/>

        {/* teal outline accent on silhouette */}
        <ellipse cx="340" cy="76" rx="14" ry="16" fill="none" stroke="#00c896" strokeOpacity="0.2" strokeWidth="0.5"/>
        <rect x="308" y="105" width="64" height="48" rx="2" fill="none" stroke="#00c896" strokeOpacity="0.1" strokeWidth="0.5"/>

        {/* glow dot on head */}
        <circle cx="340" cy="62" r="4" fill="#00c896" fillOpacity="0.25"/>
        <circle cx="340" cy="62" r="1.5" fill="#00c896" fillOpacity="0.9"/>

        {/* floor shadow ellipse */}
        <ellipse cx="340" cy="166" rx="60" ry="5" fill="#00c896" fillOpacity="0.07"/>

        {/* ── LEFT EQUITY CURVE ── */}
        <polyline points="50,135 85,118 118,128 152,95 186,108 220,78 256,92 292,60"
          fill="none" stroke="#00c896" strokeWidth="1.5" strokeOpacity="0.55" strokeLinejoin="round"/>
        <polyline points="50,135 85,118 118,128 152,95 186,108 220,78 256,92 292,60"
          fill="none" stroke="#00c896" strokeWidth="3" strokeOpacity="0.08" strokeLinejoin="round"/>
        <circle cx="292" cy="60" r="3.5" fill="#00c896" fillOpacity="0.9"/>
        <circle cx="220" cy="78" r="2" fill="#00c896" fillOpacity="0.5"/>
        <circle cx="152" cy="95" r="2" fill="#00c896" fillOpacity="0.5"/>

        {/* ── RIGHT EQUITY CURVE ── */}
        <polyline points="390,120 424,105 458,115 492,82 526,95 560,62 594,78 628,50"
          fill="none" stroke="#00c896" strokeWidth="1" strokeOpacity="0.3" strokeLinejoin="round"/>
        <circle cx="628" cy="50" r="2.5" fill="#00c896" fillOpacity="0.5"/>

        {/* left border accent */}
        <rect x="38" y="30" width="2" height="124" fill="#00c896" fillOpacity="0.5"/>

        {/* ── TEXT LEFT ── */}
        <text x="52" y="50" fontFamily="'Space Mono',monospace" fill="#00c896" fillOpacity="0.65" fontSize="9" letterSpacing="0.12em">TRADIEFY · NQ FUTURES · $25K FUNDED</text>
        <text x="52" y="88" fontFamily="'Space Mono',monospace" fill="#e8eaf0" fontSize="26" fontWeight="700" letterSpacing="-0.01em">RISK MANAGER</text>
        <text x="52" y="118" fontFamily="'Space Mono',monospace" fill="#00c896" fontSize="26" fontWeight="700" letterSpacing="-0.01em">JOURNAL</text>
        <text x="52" y="140" fontFamily="'Space Mono',monospace" fill="#1a3028" fontSize="10" letterSpacing="0.08em">ATM MODEL · OBP EXECUTION SYSTEM</text>
        <text x="52" y="154" fontFamily="'Space Mono',monospace" fill="#1a3028" fontSize="10" letterSpacing="0.08em">DISCIPLINE OVER PROFIT</text>
        <rect x="52" y="162" width="50" height="1.5" fill="#00c896" fillOpacity="0.7"/>
        <rect x="108" y="162" width="25" height="1.5" fill="#00c896" fillOpacity="0.3"/>

        {/* ── NQ watermark right ── */}
        <text x="510" y="148" fontFamily="'Space Mono',monospace" fill="#00c896" fillOpacity="0.08" fontSize="68" fontWeight="700" textAnchor="middle" letterSpacing="-0.04em">NQ</text>
        <text x="510" y="164" fontFamily="'Space Mono',monospace" fill="#00c896" fillOpacity="0.1" fontSize="10" textAnchor="middle" letterSpacing="0.14em">NASDAQ 100 FUTURES</text>

        {/* ── LIVE badge ── */}
        <rect x="596" y="28" width="54" height="22" rx="4" fill="#00c896" fillOpacity="0.08" stroke="#00c896" strokeOpacity="0.3" strokeWidth="0.5"/>
        <circle cx="609" cy="39" r="3" fill="#00c896" fillOpacity="0.85"/>
        <circle cx="609" cy="39" r="5" fill="none" stroke="#00c896" strokeOpacity="0.3" strokeWidth="0.5"/>
        <text x="631" y="43" fontFamily="'Space Mono',monospace" fill="#00c896" fontSize="9" textAnchor="middle" letterSpacing="0.06em" fontWeight="700">LIVE</text>

        {/* $26,500 target label */}
        <text x="596" y="70" fontFamily="'Space Mono',monospace" fill="#1a3028" fontSize="9" letterSpacing="0.05em">$26,500 TARGET</text>

        {/* top + bottom border */}
        <line x1="0" y1="0" x2="680" y2="0" stroke="#00c896" strokeOpacity="0.12" strokeWidth="1"/>
        <line x1="0" y1="199" x2="680" y2="199" stroke="#00c896" strokeOpacity="0.08" strokeWidth="1"/>

      </g>
    </svg>
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
      try {
        const res = await window.storage.get("nq_entries");
        if (res && res.value) setEntries(JSON.parse(res.value));
        const sb = await window.storage.get("nq_startbal");
        if (sb && sb.value) { setStartBalance(parseFloat(sb.value)); setBalInput(sb.value); }
      } catch (e) {}
    }
    load();
  }, []);
  useEffect(() => { let t; if (loading) t = setInterval(() => setLoadTick(m => (m+1)%4), 1800); return () => clearInterval(t); }, [loading]);

  const persist = async (e) => {
    try { await window.storage.set("nq_entries", JSON.stringify(e)); } catch (err) {}
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
        headers: { "Content-Type": "application/json" },
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

  async function saveEntry() {
    if (!report) return;
    const e = { id: Date.now(), ...report.parsed, obpData: report.obpData, tradeData: report.tradeData, text: report.rawText || report.text, rawInput: report.rawInput, day: report.day, dayIdx: report.dayIdx, week: report.week, startBalance };
    const updated = [...entries.filter(x => !(x.week === e.week && x.dayIdx === e.dayIdx)), e];
    setEntries(updated);
    await persist(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function deleteEntry(wk, dayIdx) {
    const updated = entries.filter(e => !(e.week === wk && e.dayIdx === dayIdx));
    setEntries(updated);
    await persist(updated);
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

    const prompt = `You are a strict NQ futures prop firm risk manager. Analyse this week and respond ONLY with a valid JSON object — no extra text, no markdown, no explanation.

WEEK ${week} DATA:
${weekEntries.map(e => `${e.day}: P&L=$${e.pnl} | OBP=${e.obp}/10 | Grade=${e.grade} | Outcome=${e.outcome||"?"} | Extraction=${e.extraction||0}% | Debrief:"${e.rawInput}"`).join("\n")}

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 600, messages: [{ role: "user", content: prompt }] })
      });
      const data = await res.json();
      let text = data.content.map(c => c.text || "").join("").trim();
      // Strip markdown code blocks if present
      text = text.replace(/^```json\n?|^```\n?|\n?```$/g, "").trim();
      try {
        const parsed = JSON.parse(text);
        setWeeklyReport(parsed);
      } catch(e) {
        setWeeklyReport({ error: "Could not parse response. Try regenerating." });
      }
    } catch { setWeeklyReport({ error: "Connection error. Try again." }); }
    setWeeklyLoading(false);
  }

  // ── PDF EXPORT ──
  async function exportWeeklyPDF() {
    if (!weekEntries.length) return;
    setExporting(true);
    const wins = weekEntries.filter(e=>e.outcome==="Win").length;
    const losses = weekEntries.filter(e=>e.outcome==="Loss").length;
    const total = weekEntries.length;
    const winRate = total ? Math.round(wins/total*100) : 0;
    const avgO = total ? (weekEntries.reduce((s,e)=>s+(e.obp||0),0)/total).toFixed(1) : "—";
    const totalAvail = weekEntries.reduce((s,e)=>s+(e.ptsAvail||0),0);
    const totalGot   = weekEntries.reduce((s,e)=>s+(e.ptsGot||0),0);
    const avgExt = totalAvail>0?Math.round(totalGot/totalAvail*100):null;
    const highObp = weekEntries.filter(e=>e.obp>=8).length;
    const expectancy = total ? weekEntries.reduce((s,e)=>s+(e.pnl||0),0)/total : 0;
    const modelDays = weekEntries.filter(e=>e.tradeData?.model&&!e.tradeData.model.includes("No Model")).length;
    const modelPresence = total ? Math.round(modelDays/total*100) : 0;

    // Build HTML for PDF
    const sc = (v, max) => v/max >= 0.85 ? '#00c896' : v/max >= 0.6 ? '#00a87a' : v/max >= 0.35 ? '#e6a817' : '#e05252';
    const obpC = v => v >= 8 ? '#00c896' : v >= 6 ? '#00a87a' : v >= 4 ? '#e6a817' : '#e05252';
    const pC   = v => v >= 0 ? '#00c896' : '#e05252';
    const grC  = g => !g||g==='—' ? '#2a3a32' : g.startsWith('A') ? '#00c896' : g.startsWith('B') ? '#00a87a' : '#e6a817';
    const bar  = (v, max) => `<div style="display:flex;align-items:center;gap:6px"><span style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:${sc(v,max)};min-width:22px">${v}</span><div style="flex:1;height:3px;background:#131a14;border-radius:2px;max-width:60px"><div style="width:${Math.round(v/max*100)}%;height:100%;background:${sc(v,max)};border-radius:2px"></div></div><span style="font-family:'Space Mono',monospace;font-size:9px;color:#2a3a32">${max}</span></div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#09080f;color:#e8eaf0;padding:36px 40px;font-size:13px;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.mono{font-family:'Space Mono',monospace}
.card{background:#0f0d1a;border:1px solid #1a2030;border-radius:12px;padding:20px;margin-bottom:14px}
.card-sm{background:#0f0d1a;border:1px solid #1a2030;border-radius:10px;padding:14px}
.sec-label{font-family:'Space Mono',monospace;font-size:10px;color:#00a87a;letter-spacing:0.1em;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #1a2030;display:flex;align-items:center;gap:8px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.metric{background:#09080f;border:1px solid #1a2030;border-radius:10px;padding:12px 14px}
.m-label{font-family:'Space Mono',monospace;font-size:9px;color:#2a3a32;letter-spacing:0.08em;margin-bottom:5px}
.m-val{font-family:'Space Mono',monospace;font-size:17px;font-weight:700;line-height:1}
.m-sub{font-family:'Space Mono',monospace;font-size:9px;color:#2a3a32;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:12px}
thead tr{background:#09080f}
th{font-family:'Space Mono',monospace;font-size:9px;color:#2a3a32;text-align:left;padding:7px 10px;border-bottom:1px solid #1a2030;letter-spacing:0.06em}
td{padding:8px 10px;border-bottom:1px solid #1a2030;color:#94a3b8;vertical-align:middle}
tr:nth-child(even) td{background:#0f0d1a40}
.badge{font-family:'Space Mono',monospace;font-size:10px;padding:3px 9px;border-radius:20px;font-weight:700;display:inline-block}
.bw{background:#00c89618;color:#00c896;border:1px solid #00c89640}
.bl{background:#e0525218;color:#e05252;border:1px solid #e0525240}
.bbe{background:#e6a81718;color:#e6a817;border:1px solid #e6a81740}
.day-card{background:#0f0d1a;border:1px solid #1a2030;border-radius:12px;padding:20px;margin-bottom:16px;page-break-inside:avoid}
.day-banner{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;margin-bottom:16px;border-bottom:1px solid #1a2030;flex-wrap:wrap;gap:8px}
.day-title{font-family:'Space Mono',monospace;font-size:15px;font-weight:700;color:#e8eaf0}
.pill-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.obp-big{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#09080f;border:1px solid;border-radius:10px;padding:10px 16px;min-width:64px;text-align:center}
.obp-tbl th{background:#131a14}
.obp-total-row td{background:#131a14;font-family:'Space Mono',monospace;font-weight:700}
.debrief-quote{font-size:11px;color:#1e1538;font-style:italic;border-left:2px solid #1a2030;padding:8px 12px;margin-bottom:14px;line-height:1.6}
.report-box{white-space:pre-wrap;font-size:11px;line-height:1.75;color:#4a9e82;background:#09080f;border:1px solid #1a2030;border-radius:8px;padding:14px;margin-top:12px}
.verdict-row{border-left:3px solid #00c896;padding:8px 12px;background:#00c89610;border-radius:0 8px 8px 0;margin:10px 0;font-size:12px;color:#00a87a;font-family:'Space Mono',monospace}
.page-break{page-break-before:always;padding-top:24px}
.weekly-txt{white-space:pre-wrap;font-size:12px;line-height:1.8;color:#4a9e82;background:#09080f;border:1px solid #1a2030;border-radius:10px;padding:18px}
@media print{
  body{background:#09080f!important}
  .card,.card-sm,.day-card,.metric{background:#0f0d1a!important}
  @page{margin:20mm;background:#09080f}
}
</style></head><body>

<!-- ═══ HEADER ═══ -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #1a2030">
  <div>
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#00c896;letter-spacing:0.14em;margin-bottom:8px">TRADIEFY · NQ FUTURES · $25K INSTANT FUNDED · ATM MODEL</div>
    <div style="font-family:'Space Mono',monospace;font-size:24px;font-weight:700;color:#e8eaf0;line-height:1.1">Risk Manager <span style="color:#00c896">Journal</span></div>
    <div style="font-size:11px;color:#2a3a32;margin-top:6px">OBP Execution System · Discipline over profit · Week ${week}</div>
  </div>
  <div style="text-align:right">
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#2a3a32;letter-spacing:0.08em;margin-bottom:4px">ACCOUNT BALANCE</div>
    <div style="font-family:'Space Mono',monospace;font-size:26px;font-weight:700;color:${balance>=startBalance?'#00c896':'#e05252'}">\$${balance.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#2a3a32;margin-top:4px">TARGET \$26,500 · \$${toTarget.toFixed(0)} REMAINING</div>
    <div style="font-family:'Space Mono',monospace;font-size:9px;color:#2a3a32;margin-top:8px">${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
  </div>
</div>

<!-- ═══ WEEKLY STATS ═══ -->
<div class="card">
  <div class="sec-label">WEEKLY PERFORMANCE STATS</div>
  <div class="grid4">
    <div class="metric"><div class="m-label">WIN RATE</div><div class="m-val" style="color:${winRate>=50?'#00c896':'#e05252'}">${winRate}%</div><div class="m-sub">${wins}W / ${losses}L of ${total} days</div></div>
    <div class="metric"><div class="m-label">AVG OBP SCORE</div><div class="m-val" style="color:${obpC(parseFloat(avgO))}">${avgO}/10</div><div class="m-sub">${highObp}/${total} high execution days</div></div>
    <div class="metric"><div class="m-label">EXTRACTION EFF</div><div class="m-val" style="color:${avgExt!==null?(avgExt>=70?'#00c896':avgExt>=40?'#e6a817':'#e05252'):'#2a3a32'}">${avgExt!==null?avgExt+'%':'—'}</div><div class="m-sub">${totalGot} / ${totalAvail} pts captured</div></div>
    <div class="metric"><div class="m-label">NET P&L</div><div class="m-val" style="color:${pC(weekNet)}">${weekNet>=0?'+':''}\$${weekNet.toFixed(0)}</div><div class="m-sub">${total} days traded</div></div>
  </div>
  <div class="grid3">
    <div class="metric"><div class="m-label">EXPECTANCY</div><div class="m-val" style="color:${pC(expectancy)}">${expectancy>=0?'+':''}\$${expectancy.toFixed(0)}</div><div class="m-sub">avg P&L per trading day</div></div>
    <div class="metric"><div class="m-label">MODEL PRESENCE</div><div class="m-val" style="color:${modelPresence>=80?'#00c896':modelPresence>=50?'#e6a817':'#e05252'}">${modelPresence}%</div><div class="m-sub">${modelDays}/${total} days — ATM model</div></div>
    <div class="metric"><div class="m-label">OBP RULE COMPLIANCE</div><div class="m-val" style="color:#00c896">${weekEntries.filter(e=>e.obp>=8).length}/${total}</div><div class="m-sub">days with OBP ≥ 8 (target)</div></div>
  </div>
</div>

<!-- ═══ DAY BY DAY TABLE ═══ -->
<div class="card">
  <div class="sec-label">DAY BY DAY SNAPSHOT</div>
  <table>
    <thead><tr>
      <th>DAY</th><th>P&L</th><th>OBP /10</th><th>OUTCOME</th>
      <th>PTS AVAIL</th><th>PTS GOT</th><th>EXTRACTION</th>
      <th>GRADE</th><th>HEALTH</th><th>TOMORROW</th>
    </tr></thead>
    <tbody>
      ${weekEntries.map((e,idx)=>`<tr style="${idx%2===0?'':'background:#0f0d1a40'}">
        <td style="font-family:'Space Mono',monospace;font-weight:700;color:#e8eaf0">${e.day}</td>
        <td style="font-family:'Space Mono',monospace;font-weight:700;color:${pC(e.pnl)}">${e.pnl>=0?'+':''}\$${e.pnl}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-family:'Space Mono',monospace;font-weight:700;color:${obpC(e.obp)}">${e.obp}</span>
            <div style="width:40px;height:3px;background:#1a2030;border-radius:2px"><div style="width:${Math.round(e.obp/10*100)}%;height:100%;background:${obpC(e.obp)};border-radius:2px"></div></div>
          </div>
        </td>
        <td><span class="badge ${e.outcome==='Win'?'bw':e.outcome==='Loss'?'bl':'bbe'}">${e.outcome||'—'}</span></td>
        <td style="color:#7a8ba6">${e.ptsAvail||'—'}</td>
        <td style="color:#00a87a">${e.ptsGot||'—'}</td>
        <td style="font-family:'Space Mono',monospace;color:${e.extraction>=70?'#00c896':e.extraction>=40?'#e6a817':'#e05252'}">${e.extraction?e.extraction+'%':'—'}</td>
        <td style="font-family:'Space Mono',monospace;font-weight:700;color:${grC(e.grade)}">${e.grade||'—'}</td>
        <td style="color:${e.health==='GREEN'?'#00c896':e.health==='AMBER'?'#e6a817':'#e05252'}">${e.health||'—'}</td>
        <td style="font-size:10px;color:#2a3a32">${e.clearance||'—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<!-- ═══ DAILY ENTRIES ═══ -->
<div class="page-break">
  <div style="font-family:'Space Mono',monospace;font-size:10px;color:#00a87a;letter-spacing:0.1em;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #1a2030">DAILY TRADE ENTRIES — FULL BREAKDOWN</div>

  ${weekEntries.map((e,di)=>{
    const obpTotal = e.obpData ? (e.obpData.mv||0)+(e.obpData.eq||0)+(e.obpData.rd||0)+(e.obpData.tm||0)+(e.obpData.ec||0) : e.obp;
    const obpRows = e.obpData ? [
      ['Model Validity',3,e.obpData.mv,e.obpData.mvNote],
      ['Entry Quality',2,e.obpData.eq,e.obpData.eqNote],
      ['Risk Discipline',2,e.obpData.rd,e.obpData.rdNote],
      ['Trade Management',2,e.obpData.tm,e.obpData.tmNote],
      ['Emotional Control',1,e.obpData.ec,e.obpData.ecNote],
    ] : [];
    const tradeRows = e.tradeData ? Object.entries({
      'Model Used':e.tradeData.model,
      'Result':e.tradeData.result,
      'Net P&L':e.tradeData.pnl,
      'R:R Available':e.tradeData.rrAvail,
      'R:R Captured':e.tradeData.rrGot,
      'Pts Available':e.tradeData.ptsAvail,
      'Pts Extracted':e.tradeData.ptsGot,
      'Extraction Eff':e.tradeData.extraction,
      'Account Balance':e.tradeData.balance,
      'Daily Rule':e.tradeData.dailyRule,
    }).filter(([,v])=>v) : [];

    return `<div class="day-card" style="${di>0?'margin-top:4px':''}">

      <!-- Day Banner -->
      <div class="day-banner">
        <div style="display:flex;align-items:center;gap:14px">
          <span class="day-title">${e.day.toUpperCase()}</span>
          <span style="font-family:'Space Mono',monospace;font-size:14px;font-weight:700;color:${pC(e.pnl)}">${e.pnl>=0?'+':''}\$${e.pnl}</span>
          <span class="badge ${e.outcome==='Win'?'bw':e.outcome==='Loss'?'bl':'bbe'}">${e.outcome||'—'}</span>
          ${e.grade&&e.grade!=='—'?`<span style="font-family:'Space Mono',monospace;font-size:10px;color:${grC(e.grade)};background:${grC(e.grade)}18;border:1px solid ${grC(e.grade)}40;padding:3px 9px;border-radius:20px;font-weight:700">GRADE ${e.grade}</span>`:''}
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <!-- OBP Big Score -->
          <div class="obp-big" style="border-color:${obpC(obpTotal)}40;background:${obpC(obpTotal)}10">
            <div style="font-family:'Space Mono',monospace;font-size:20px;font-weight:700;color:${obpC(obpTotal)};line-height:1">${obpTotal}</div>
            <div style="font-family:'Space Mono',monospace;font-size:8px;color:${obpC(obpTotal)};opacity:0.7;margin-top:2px;letter-spacing:0.06em">OBP/10</div>
          </div>
          ${e.health?`<div style="background:${e.health==='GREEN'?'#00c89610':e.health==='AMBER'?'#e6a81710':'#e0525210'};border:1px solid ${e.health==='GREEN'?'#00c89640':e.health==='AMBER'?'#e6a81740':'#e0525240'};border-radius:8px;padding:8px 12px;text-align:center">
            <div style="font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:${e.health==='GREEN'?'#00c896':e.health==='AMBER'?'#e6a817':'#e05252'}">${e.health}</div>
            <div style="font-family:'Space Mono',monospace;font-size:8px;color:#2a3a32;margin-top:1px">HEALTH</div>
          </div>`:''}
        </div>
      </div>

      <!-- Trader's own words -->
      <div class="debrief-quote">"${(e.rawInput||'').replace(/"/g,'&quot;')}"</div>

      <!-- Two-column: OBP + Trade -->
      <div class="grid2">

        <!-- OBP Execution Score Table -->
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:9px;color:#00a87a;letter-spacing:0.08em;margin-bottom:8px">OBP EXECUTION SCORE</div>
          <div style="border:1px solid #1a2030;border-radius:8px;overflow:hidden">
            <table class="obp-tbl">
              <thead><tr><th style="width:45%">COMPONENT</th><th style="width:15%">MAX</th><th style="width:40%">SCORE</th></tr></thead>
              <tbody>
                ${obpRows.map(([name,max,score,note],ri)=>`
                <tr style="${ri%2===0?'':'background:#09080f60'}">
                  <td style="color:#e8eaf0">${name}</td>
                  <td style="font-family:'Space Mono',monospace;color:#2a3a32;font-size:11px">${max}</td>
                  <td>${score!==null&&score!==undefined?bar(score,max):'<span style="color:#2a3a32">—</span>'}</td>
                </tr>`).join('')}
                <tr class="obp-total-row">
                  <td style="color:#e8eaf0;font-size:12px">TOTAL OBP</td>
                  <td style="color:#2a3a32;font-size:11px">10</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="font-family:'Space Mono',monospace;font-size:16px;font-weight:700;color:${obpC(obpTotal)}">${obpTotal}</span>
                      <span style="font-family:'Space Mono',monospace;font-size:9px;color:${obpC(obpTotal)};letter-spacing:0.06em">${obpTotal>=9?'ELITE':obpTotal>=7?'GOOD':obpTotal>=5?'AVERAGE':'POOR'}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Trade Breakdown Table -->
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:9px;color:#00a87a;letter-spacing:0.08em;margin-bottom:8px">TRADE BREAKDOWN</div>
          <div style="border:1px solid #1a2030;border-radius:8px;overflow:hidden">
            <table>
              <thead><tr><th style="width:45%">FIELD</th><th>VALUE</th></tr></thead>
              <tbody>
                ${tradeRows.map(([k,v],ri)=>`
                <tr style="${ri%2===0?'':'background:#09080f60'}">
                  <td style="color:#2a3a32">${k}</td>
                  <td style="font-family:'Space Mono',monospace;font-weight:700;color:${
                    k==='Daily Rule'?(v.includes('SAFE')?'#00c896':'#e05252'):
                    k==='Result'?(v==='Win'?'#00c896':v==='Loss'?'#e05252':'#e6a817'):
                    k==='Net P&L'?(v.includes('-')?'#e05252':'#00c896'):
                    k==='Extraction Eff'?(()=>{const n=parseFloat(v);return n>=70?'#00c896':n>=40?'#e6a817':'#e05252';})():
                    k==='Model Used'?(v.includes('No Model')?'#e05252':'#00c896'):
                    '#e8eaf0'
                  }">${v}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Report text (psych, lessons, verdict) -->
      ${e.text?`<div style="margin-top:12px"><div style="font-family:'Space Mono',monospace;font-size:9px;color:#00a87a;letter-spacing:0.08em;margin-bottom:6px">RISK MANAGER ANALYSIS</div><div class="report-box">${e.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>`:''}

    </div>`;
  }).join('')}
</div>

<!-- ═══ WEEKLY AI REPORT ═══ -->
${weeklyReport?`<div class="page-break">
  <div style="font-family:'Space Mono',monospace;font-size:10px;color:#00a87a;letter-spacing:0.1em;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #1a2030">AI RISK MANAGER WEEKLY ANALYSIS</div>
  <div class="weekly-txt">${weeklyReport.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
</div>`:''}

<!-- ═══ FOOTER ═══ -->
<div style="margin-top:36px;padding-top:16px;border-top:1px solid #1a2030;font-family:'Space Mono',monospace;font-size:9px;color:#1e1538;display:flex;justify-content:space-between">
  <span>NQ RISK MANAGER JOURNAL · TRADIEFY · ATM MODEL · OBP SYSTEM</span>
  <span>WEEK ${week} · EXPORTED ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}).toUpperCase()}</span>
</div>

</body></html>`;

    // Download as HTML file — open in browser then Ctrl+P to save as PDF
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NQ-Journal-Week-${week}.html`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
    } catch(err) {
      // Last resort: open as data URL
      const encoded = encodeURIComponent(html);
      const a = document.createElement('a');
      a.href = 'data:text/html;charset=utf-8,' + encoded;
      a.download = `NQ-Journal-Week-${week}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setExporting(false);
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
            style={{ ...mono, fontSize: 11, padding: "5px 10px", width: "auto", color: C.slate, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8, display: "block", marginLeft: "auto" }} />
          {editingBal ? (
            <div style={{display:"flex",gap:6,alignItems:"center",justifyContent:"flex-end"}}>
              <input type="number" value={balInput} onChange={e=>setBalInput(e.target.value)}
                style={{...mono,fontSize:13,width:110,padding:"4px 8px",background:C.surface,border:`1px solid #00c896`,borderRadius:6,color:C.text,textAlign:"right"}}
                onKeyDown={e=>{if(e.key==="Enter"){const v=parseFloat(balInput);if(!isNaN(v)){setStartBalance(v);window.storage.set("nq_startbal",String(v));setEditingBal(false);}}}}
                autoFocus
              />
              <button onClick={()=>{const v=parseFloat(balInput);if(!isNaN(v)){setStartBalance(v);window.storage.set("nq_startbal",String(v));}setEditingBal(false);}}
                style={{...mono,fontSize:10,padding:"4px 10px",background:"#00c896",color:C.bg,border:"none",borderRadius:6,cursor:"pointer",fontWeight:700}}>SET</button>
            </div>
          ) : (
            <div onClick={()=>setEditingBal(true)} style={{cursor:"pointer"}} title="Click to update balance">
              <div style={{ ...mono, fontSize: 17, fontWeight: 700, color: pnlC(balance - startBalance) }}>
                ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ ...mono, fontSize: 9, color:"#00c896", marginTop: 2, letterSpacing: "0.06em" }}>CLICK BALANCE TO EDIT</div>
            </div>
          )}
          <div style={{ ...mono, fontSize: 9, color: C.muted, marginTop: 3, letterSpacing: "0.06em" }}>${toTarget.toFixed(0)} TO TARGET</div>
          <div style={{ width: 130, height: 3, background: C.dim, borderRadius: 2, marginTop: 6, overflow: "hidden", marginLeft: "auto" }}>
            <div style={{ height: "100%", width: `${targetPct}%`, background: C.silver, borderRadius: 2, transition: "width 0.6s ease" }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: "1.5rem" }}>
        {[["entry","DAILY DEBRIEF"],["log","TRADE LOG"],["weekly","WEEKLY REPORT"],["charts","EQUITY + DD"]].map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); if (t==="weekly" && !weeklyReport) generateWeekly(); }}
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
          {/* Day pills */}
          <div style={{ display: "flex", gap: 6, marginBottom: "1.25rem", flexWrap: "wrap" }}>
            {DAYS.map((d, i) => {
              const has = weekEntries.some(e => e.dayIdx === i);
              const act = activeDay === i;
              return (
                <button key={d} onClick={() => setActiveDay(i)} style={{
                  ...mono, padding: "6px 16px", fontSize: 11, borderRadius: 6, cursor: "pointer",
                  border: `1px solid ${act ? "#00c896" : has ? "#00c89640" : C.border}`,
                  background: act ? "#00c896" : "none",
                  color: act ? C.bg : has ? "#00c896" : C.muted,
                  fontWeight: act ? 700 : 400, letterSpacing: "0.06em", transition: "all 0.12s",
                }}>{DAY_SHORT[i]}</button>
              );
            })}
          </div>

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
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{report.day} · Week {week}</div>
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
                        <div style={{...mono,fontSize:13,fontWeight:700,color:"#e8eaf0",letterSpacing:"0.04em"}}>{e.day.toUpperCase()}</div>
                        <div style={{width:1,height:14,background:"#2a3a4a"}}/>
                        <div style={{...mono,fontSize:12,fontWeight:700,color:pnlC(e.pnl)}}>{e.pnl>=0?"+":""}${e.pnl}</div>
                        <div style={{...mono,fontSize:11,fontWeight:700,color:obpBig(e.obp)}}>OBP {e.obp}/10</div>
                        {e.grade&&e.grade!=="—"&&<span style={pill(gradeC(e.grade))}>{e.grade}</span>}
                        {e.health&&<span style={pill(healthC(e.health))}>{e.health}</span>}
                        {e.outcome&&<span style={pill(outC(e.outcome))}>{e.outcome.toUpperCase()}</span>}
                        {e.extraction>0&&<span style={pill(C.slate)}>{e.extraction}% EXT</span>}
                      </div>
                      <Btn small onClick={() => deleteEntry(e.week,e.dayIdx)}>DELETE</Btn>
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
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:"1rem"}}>
                      {[
                        {label:"WIN RATE",         val:total?`${winRate}%`:"—",           sub:`${wins}W / ${losses}L`,                                           color:winRate>=50?C.silver:C.red},
                        {label:"AVG OBP",           val:total?`${avgO.toFixed(1)}/10`:"—", sub:`${highObp}/${total} high execution days`,                        color:total?obpBig(avgO):C.muted},
                        {label:"EXTRACTION EFF",    val:avgExt!==null?`${avgExt}%`:"—",   sub:totalAvail>0?`${totalGot} / ${totalAvail} pts`:"add pts to debrief", color:avgExt>=70?C.silver:avgExt>=40?C.amber:avgExt!==null?C.red:C.muted},
                        {label:"EXPECTANCY",        val:total?`${expectancy>=0?"+":""}$${expectancy.toFixed(0)}`:"—", sub:"avg P&L per trading day",             color:expectancy>=0?C.silver:C.red},
                        {label:"MODEL PRESENCE",    val:total?`${modelPresence}%`:"—",     sub:`${modelDays}/${total} days with ATM model`,                      color:modelPresence>=80?C.silver:modelPresence>=50?C.amber:C.red},
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
                  {weeklyReport&&!weeklyLoading&&(
                    <WeeklyReportUI data={weeklyReport} week={week} weekEntries={weekEntries} weekNet={weekNet} balance={balance} startBalance={startBalance} toTarget={toTarget} />
                  )}
                </div>
              </>
            )}
        </div>
      )}

      {/* ══ CHARTS ══ */}
      {tab === "charts" && (
        <div>
          <Charts entries={entries} />
        </div>
      )}
    </div>
  );
}
