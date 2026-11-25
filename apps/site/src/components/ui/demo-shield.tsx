"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
   Demo Shield — a privacy layer for screen shares, demos and recordings.
   Source: 21st.dev / MouseUI (mouseui.21st.dev).

   Wrap any part of your app. Demo Shield reads the rendered text (and input
   values) under it, finds emails, card numbers (Luhn-checked), API keys and
   tokens, phone numbers, money amounts, IP addresses and any names you pass,
   and lays masks over them. It never touches your DOM: masks are an overlay
   drawn from text ranges, so React keeps full ownership of the tree.

   ⌘/Ctrl + Shift + H arms it. Hold ⌥/Alt over a mask to peek (the presenter
   sees an outline so they know it's live). Mark anything else with
   `data-shield` to always mask it, or `data-shield-ignore` to skip it.
   ────────────────────────────────────────────────────────────────────────── */

export type ShieldType = "email" | "card" | "key" | "phone" | "money" | "ip" | "name" | "custom";
export type ShieldMode = "blur" | "bar" | "tag";
export type ShieldPattern = { label: string; regex: RegExp };
export type ShieldCounts = { [k: string]: number };

export type DemoShieldProps = {
  children?: React.ReactNode;
  /** controlled on/off */
  active?: boolean;
  defaultActive?: boolean;
  onActiveChange?: (active: boolean) => void;
  mode?: ShieldMode;
  defaultMode?: ShieldMode;
  onModeChange?: (mode: ShieldMode) => void;
  /** which detectors start enabled (default: all) */
  detect?: ShieldType[];
  /** extra words to always mask, e.g. customer names (case-insensitive) */
  words?: string[];
  /** extra regex detectors */
  patterns?: ShieldPattern[];
  /** letter used with ⌘/Ctrl + Shift. Set null to disable. */
  hotkey?: string | null;
  /** show the control bar */
  hud?: boolean;
  /** fires whenever the scan result changes */
  onScan?: (counts: ShieldCounts, total: number) => void;
  watermark?: boolean;
  watermarkHref?: string;
  className?: string;
  style?: React.CSSProperties;
};

type Mask = { id: string; t: ShieldType; x: number; y: number; w: number; h: number };
type Box = { l: number; t: number; r: number; b: number };

const ORDER: ShieldType[] = ["key", "card", "email", "ip", "phone", "money", "name", "custom"];
const LABEL: { [k: string]: string } = { email: "Email", card: "Card", key: "Secret", phone: "Phone", money: "Money", ip: "IP", name: "Name", custom: "Custom" };
const TAG: { [k: string]: string } = { email: "EMAIL", card: "CARD", key: "SECRET", phone: "PHONE", money: "AMOUNT", ip: "IP", name: "NAME", custom: "HIDDEN" };
const DOT: { [k: string]: string } = { email: "#3b82f6", card: "#f97316", key: "#ef4444", phone: "#14b8a6", money: "#22c55e", ip: "#a855f7", name: "#eab308", custom: "#94a3b8" };

/* ── detectors ─────────────────────────────────────────────────────────── */

const RX: { [k: string]: RegExp } = {
  key: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b|\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bAKIA[0-9A-Z]{16}\b|\bxox[abprs]-[A-Za-z0-9-]{10,}|\bwhsec_[A-Za-z0-9]{12,}\b|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}|\bBearer\s+[A-Za-z0-9._-]{16,}/g,
  card: /\b(?:\d[ -]?){12,18}\d\b/g,
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  ip: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  phone: /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,5}\)[\s.-]?|\d{2,5}[\s.-])\d{2,5}(?:[\s.-]?\d{2,5}){0,3}\b/g,
  money: /-?(?:[$€£₹¥]|\b(?:USD|EUR|GBP|INR)\s?)\s?\d[\d,]*(?:\.\d+)?(?:\s?[KMB]\b)?/g,
};

function luhn(d: string) {
  let s = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = +(d[i] ?? 0);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    s += n;
    alt = !alt;
  }
  return s % 10 === 0;
}
function valid(t: string, m: string) {
  if (t === "card") {
    const d = m.replace(/\D/g, "");
    return d.length >= 13 && d.length <= 19 && luhn(d);
  }
  if (t === "phone") {
    const d = m.replace(/\D/g, "").length;
    return d >= 10 && d <= 15;
  }
  return true;
}
function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type Hit = { s: number; e: number; t: ShieldType };
function findAll(text: string, on: { [k: string]: boolean }, words: string[], patterns: ShieldPattern[]) {
  const hits = [] as Hit[];
  const taken = (s: number, e: number) => hits.some((h) => s < h.e && e > h.s);
  const run = (t: ShieldType, rx: RegExp) => {
    const r = new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g");
    for (const m of text.matchAll(r)) {
      const s = m.index || 0;
      const e = s + m[0].length;
      if (!m[0].trim() || !valid(t, m[0]) || taken(s, e)) continue;
      hits.push({ s, e, t });
    }
  };
  for (const t of ORDER) {
    if (!on[t]) continue;
    if (RX[t]) run(t, RX[t]);
    else if (t === "name" && words.length) run("name", new RegExp("\\b(?:" + words.filter(Boolean).map(esc).join("|") + ")\\b", "gi"));
    else if (t === "custom") patterns.forEach((p) => run("custom", p.regex));
  }
  return hits;
}

/* ── watermark ─────────────────────────────────────────────────────────── */

const MOUSE_PX = [".2222......2222.", "224422....224422", "244442....244442", "2244223333224422", ".22233333333222.", "..333333333333..", ".33305333305333.", ".33300333300333.", "1133333443333311", ".33333333333333.", "1133331331333311", "..333331133333..", "...3333333333..."];
const MOUSE_COL = ["#141320", "#8e88a8", "#cfcbe3", "#ecebf7", "#ff8cc0", "#ffffff"];
function MouseLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 13) / 16} viewBox="0 0 16 13" shapeRendering="crispEdges" aria-hidden>
      {MOUSE_PX.flatMap((row, y) => row.split("").map((c, x) => (c === "." ? null : <rect key={x + "-" + y} x={x} y={y} width="1.02" height="1.02" fill={MOUSE_COL[+c]} />)))}
    </svg>
  );
}
function Watermark({ href }: { href: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Made with MouseUI — open mouseui.21st.dev"
        data-shield-ignore=""
        className="ds-wm group pointer-events-auto flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 no-underline outline-none transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:pr-2 focus-visible:ring-2"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full transition-transform duration-500 group-hover:rotate-[-8deg]" style={{ background: "linear-gradient(140deg,#3a1f4a,#0d0b16)" }}>
          <MouseLogo />
        </span>
        <span className="text-[13px] font-semibold tracking-[-0.02em]">
          Mouse<span style={{ color: "#c86bff" }}>UI</span>
        </span>
        <span className="grid max-w-0 grid-flow-col items-center gap-1 overflow-hidden whitespace-nowrap font-mono text-[11px] opacity-0 transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:max-w-[180px] group-hover:opacity-100 group-focus-visible:max-w-[180px] group-focus-visible:opacity-100">
          <span className="mx-1 h-3.5 w-px bg-current opacity-30" />
          mouseui.21st.dev ↗
        </span>
      </a>
    </div>
  );
}

/* ── component ─────────────────────────────────────────────────────────── */

export function DemoShield({
  children,
  active,
  defaultActive = false,
  onActiveChange,
  mode,
  defaultMode = "bar",
  onModeChange,
  detect,
  words = [],
  patterns = [],
  hotkey = "h",
  hud = true,
  onScan,
  watermark = true,
  watermarkHref = "https://mouseui.21st.dev",
  className,
  style,
}: DemoShieldProps) {
  const sc = "ds" + React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const rootRef = React.useRef(null as HTMLDivElement | null);
  const contentRef = React.useRef(null as HTMLDivElement | null);

  const [onInner, setOnInner] = React.useState(defaultActive);
  const on = active ?? onInner;
  const setOn = (v: boolean) => {
    if (active === undefined) setOnInner(v);
    onActiveChange?.(v);
  };
  const [modeInner, setModeInner] = React.useState(defaultMode as ShieldMode);
  const m = mode ?? modeInner;
  const setMode = (v: ShieldMode) => {
    if (mode === undefined) setModeInner(v);
    onModeChange?.(v);
  };

  const initialOn = () => {
    const o = {} as { [k: string]: boolean };
    ORDER.forEach((t) => (o[t] = detect ? detect.includes(t) : true));
    return o;
  };
  const [types, setTypes] = React.useState(initialOn);
  const [masks, setMasks] = React.useState([] as Mask[]);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [sweep, setSweep] = React.useState(0);
  const sweepAt = React.useRef(0);
  const [alt, setAlt] = React.useState(false);
  const [ptr, setPtr] = React.useState(null as { x: number; y: number } | null);

  const cfg = React.useRef({ types, words, patterns, onScan });
  cfg.current = { types, words, patterns, onScan };

  /* scan: text ranges → client rects → clipped overlay boxes */
  const dirty = React.useRef(true);
  const lastSig = React.useRef("");
  const scan = React.useCallback(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content) return;
    const { types: on, words: w, patterns: p } = cfg.current;
    const R = root.getBoundingClientRect();
    const clipCache = new WeakMap();
    const clipFor = (el: Element | null): Box => {
      let box: Box = { l: R.left, t: R.top, r: R.right, b: R.bottom };
      const chain = [] as Element[];
      let cur = el;
      while (cur && cur !== root) {
        if (clipCache.has(cur)) {
          const c = clipCache.get(cur) as Box;
          box = c;
          break;
        }
        chain.push(cur);
        cur = cur.parentElement;
      }
      for (let i = chain.length - 1; i >= 0; i--) {
        const e = chain[i];
        if (!e) continue;
        const cs = getComputedStyle(e);
        if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
          const r = e.getBoundingClientRect();
          box = { l: Math.max(box.l, r.left), t: Math.max(box.t, r.top), r: Math.min(box.r, r.right), b: Math.min(box.b, r.bottom) };
        }
        clipCache.set(e, box);
      }
      return box;
    };
    const out = [] as Mask[];
    const push = (t: ShieldType, r: DOMRect | Box, clip: Box, id: string, pad = 2) => {
      const l0 = "left" in r ? r.left : r.l;
      const t0 = "top" in r ? r.top : r.t;
      const r0 = "right" in r ? r.right : r.r;
      const b0 = "bottom" in r ? r.bottom : r.b;
      const l = Math.max(l0 - pad, clip.l);
      const tt = Math.max(t0 - pad * 0.5, clip.t);
      const rr = Math.min(r0 + pad, clip.r);
      const bb = Math.min(b0 + pad * 0.5, clip.b);
      if (rr - l < 2 || bb - tt < 2) return;
      out.push({ id, t, x: l - R.left, y: tt - R.top, w: rr - l, h: bb - tt });
    };
    const skip = (el: Element | null) => !!el && !!el.closest("[data-shield-ignore],script,style,noscript,[data-shield]");

    /* 1. text nodes, grouped by parent so "{'$'}{amount}" joins up */
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const nodes = [] as Text[];
    const starts = [] as number[];
    let text = "";
    let lastParent = null as Node | null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const tn = n as Text;
      if (!tn.data || skip(tn.parentElement)) continue;
      if (tn.parentNode !== lastParent) text += "\n";
      lastParent = tn.parentNode;
      starts.push(text.length);
      nodes.push(tn);
      text += tn.data;
    }
    const at = (pos: number, end: boolean) => {
      let lo = 0;
      let hi = nodes.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        const sm = starts[mid] ?? 0;
        if (sm < pos || (!end && sm === pos)) lo = mid;
        else hi = mid - 1;
      }
      const node = nodes[lo] as Text;
      return { node, off: Math.min(pos - (starts[lo] ?? 0), node.data.length) };
    };
    const hits = nodes.length ? findAll(text, on, w, p) : [];
    const range = document.createRange();
    hits.forEach((h, i) => {
      const a = at(h.s, false);
      const b = at(h.e, true);
      try {
        range.setStart(a.node, a.off);
        range.setEnd(b.node, b.off);
      } catch {
        return;
      }
      const clip = clipFor(a.node.parentElement);
      const rects = range.getClientRects();
      for (let k = 0; k < rects.length; k++) {
        const rk = rects[k];
        if (rk && rk.width > 0.5) push(h.t, rk, clip, "t" + i + "-" + k);
      }
    });

    /* 2. input / textarea values */
    content.querySelectorAll("input,textarea").forEach((el, i) => {
      const inp = el as HTMLInputElement;
      if (inp.type === "password" || inp.type === "hidden" || skip(inp)) return;
      const v = inp.value;
      if (!v) return;
      const hh = findAll(v, on, w, p);
      const first = hh[0];
      if (!first) return;
      const r = inp.getBoundingClientRect();
      const cs = getComputedStyle(inp);
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      push(first.t, { l: r.left + pl - 2, t: r.top + pt, r: r.right - pr + 2, b: r.bottom - pb }, clipFor(inp.parentElement), "i" + i, 0);
    });

    /* 3. explicit data-shield elements */
    content.querySelectorAll("[data-shield]").forEach((el, i) => {
      if (el.closest("[data-shield-ignore]")) return;
      const want = (el.getAttribute("data-shield") || "custom") as ShieldType;
      const t = LABEL[want] ? want : "custom";
      if (!on[t]) return;
      push(t, el.getBoundingClientRect(), clipFor(el.parentElement), "e" + i, 1);
    });

    const sig = out.map((o) => o.t + (o.x | 0) + "," + (o.y | 0) + "," + (o.w | 0) + "," + (o.h | 0)).join("|");
    if (sig !== lastSig.current) {
      lastSig.current = sig;
      setMasks(out);
      const counts = {} as ShieldCounts;
      out.forEach((o) => (counts[o.t] = (counts[o.t] || 0) + 1));
      cfg.current.onScan?.(counts, out.length);
    }
    setSize((s) => (s.w === R.width && s.h === R.height ? s : { w: R.width, h: R.height }));
  }, []);

  React.useEffect(() => {
    dirty.current = true;
  }, [types, words, patterns]);

  React.useEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content) return;
    let raf = 0;
    const mark = () => (dirty.current = true);
    const loop = () => {
      if (dirty.current) {
        dirty.current = false;
        scan();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const mo = new MutationObserver(mark);
    mo.observe(content, { subtree: true, childList: true, characterData: true, attributes: true });
    const ro = new ResizeObserver(mark);
    ro.observe(root);
    ro.observe(content);
    root.addEventListener("scroll", mark, true);
    root.addEventListener("input", mark, true);
    window.addEventListener("resize", mark);
    window.addEventListener("scroll", mark, true);
    document.fonts?.ready.then(mark);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      ro.disconnect();
      root.removeEventListener("scroll", mark, true);
      root.removeEventListener("input", mark, true);
      window.removeEventListener("resize", mark);
      window.removeEventListener("scroll", mark, true);
    };
  }, [scan]);

  /* arm → sweep */
  const prevOn = React.useRef(on);
  if (on && !prevOn.current) sweepAt.current = performance.now();
  React.useEffect(() => {
    if (on && !prevOn.current) setSweep((s) => s + 1);
    prevOn.current = on;
  }, [on]);

  /* hotkey + alt peek */
  const onRef = React.useRef(on);
  onRef.current = on;
  const toggleRef = React.useRef(() => {});
  toggleRef.current = () => setOn(!onRef.current);
  React.useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === "Alt") setAlt(true);
      if (hotkey && (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === hotkey.toLowerCase()) {
        e.preventDefault();
        toggleRef.current();
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === "Alt") setAlt(false);
    };
    const bl = () => setAlt(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", bl);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", bl);
    };
  }, [hotkey]);

  const onMove = (e: React.PointerEvent) => {
    const R = rootRef.current?.getBoundingClientRect();
    if (R) setPtr({ x: e.clientX - R.left, y: e.clientY - R.top });
  };

  const counts = {} as ShieldCounts;
  masks.forEach((o) => (counts[o.t] = (counts[o.t] || 0) + 1));
  const total = masks.length;
  const sweeping = performance.now() - sweepAt.current < 1200;
  const present = ORDER.filter((t) => counts[t] || (t === "name" && words.length) || (t === "custom" && patterns.length) || (t !== "name" && t !== "custom")).sort((a, b) => (counts[b] ? 1 : 0) - (counts[a] ? 1 : 0));

  const css = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600;700&display=swap');
.${sc}{--ink:#0c0c0d;--bar:#0c0c0d;--tally:#ff3b2f;--panel:#f4f2ec;--panel2:#e9e6dd;--line:#d3cfc3;--txt:#1b1a17;--mute:#7a766b;--key:#fffdf7;--keysh:#bdb8aa;--tagA:#fff1c2;--tagB:#ffe08a;--tagT:#6b4a00;--blurT:rgba(244,242,236,.35);--wmbg:#fffdf7;--wmfg:#111;--wmln:#d9d5ca;font-family:Geist,ui-sans-serif,system-ui,sans-serif}
.dark .${sc},.${sc}.dark{--bar:#2a2a2a;--panel:#141414;--panel2:#1c1c1c;--line:#2c2c2c;--txt:#f2f0ea;--mute:#8d897f;--key:#232323;--keysh:#050505;--tagA:#3a2c05;--tagB:#4a3808;--tagT:#ffd772;--blurT:rgba(20,20,20,.35);--wmbg:#151515;--wmfg:#f3f1ea;--wmln:#2e2e2e}
.${sc} .ds-wm{background:var(--wmbg);color:var(--wmfg);border-color:var(--wmln);box-shadow:0 4px 18px -6px rgba(0,0,0,.25)}
.${sc} .ds-mono{font-family:"Geist Mono",ui-monospace,monospace}
.${sc} .ds-m{position:absolute;pointer-events:none;border-radius:2px;opacity:0;clip-path:inset(0 100% 0 0 round 2px);transition:opacity .2s ease,clip-path .42s cubic-bezier(.2,.8,.2,1),background .2s,backdrop-filter .2s}
.${sc}.ds-on .ds-m{opacity:1;clip-path:inset(0 0 0 0 round 2px)}
.${sc} .ds-m[data-mode=bar]{background:var(--bar);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}
.${sc} .ds-m[data-mode=bar]::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(90deg,transparent,rgba(255,255,255,.07) 40%,transparent 60%);background-size:200% 100%;opacity:.8}
.${sc} .ds-m[data-mode=blur]{backdrop-filter:blur(7px) saturate(.4);-webkit-backdrop-filter:blur(7px) saturate(.4);background:var(--blurT)}
.${sc} .ds-m[data-mode=tag]{background:repeating-linear-gradient(-45deg,var(--tagA) 0 5px,var(--tagB) 5px 10px);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tagT) 35%,transparent);display:flex;align-items:center;justify-content:center;overflow:hidden}
.${sc} .ds-m[data-mode=tag] span{font:600 9px/1 "Geist Mono",ui-monospace,monospace;letter-spacing:.12em;color:var(--tagT);background:var(--tagA);padding:2px 4px;border-radius:2px;white-space:nowrap}
.${sc} .ds-m.ds-peek{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:inset 0 0 0 1.5px var(--tally),0 0 0 3px color-mix(in srgb,var(--tally) 18%,transparent)!important}
.${sc} .ds-m.ds-peek::after,.${sc} .ds-m.ds-peek span{opacity:0}
.${sc} .ds-scan{position:absolute;left:0;right:0;top:0;height:2px;background:var(--tally);box-shadow:0 0 18px 4px color-mix(in srgb,var(--tally) 55%,transparent),0 0 2px var(--tally);pointer-events:none;z-index:25;animation:${sc}-scan .8s linear forwards}
.${sc} .ds-scan::before{content:"";position:absolute;left:0;right:0;bottom:2px;height:70px;background:linear-gradient(to top,color-mix(in srgb,var(--tally) 14%,transparent),transparent)}
@keyframes ${sc}-scan{0%{transform:translateY(0);opacity:1}88%{opacity:1}100%{transform:translateY(var(--h));opacity:0}}
.${sc} .ds-hud{background:var(--panel);color:var(--txt);border:1px solid var(--line);box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 18px 40px -16px rgba(0,0,0,.35),0 2px 6px -2px rgba(0,0,0,.15)}
.dark .${sc} .ds-hud,.${sc}.dark .ds-hud{box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 18px 40px -12px rgba(0,0,0,.8)}
.${sc} .ds-key{background:var(--key);border:1px solid var(--line);box-shadow:0 2px 0 var(--keysh);transition:transform .12s,box-shadow .12s,background .2s}
.${sc} .ds-key:active{transform:translateY(2px);box-shadow:0 0 0 var(--keysh)}
.${sc} .ds-key[aria-pressed=true]{background:var(--panel2);transform:translateY(1px);box-shadow:0 1px 0 var(--keysh)}
.${sc} .ds-lamp{width:10px;height:10px;border-radius:99px;background:#5b5850;box-shadow:inset 0 1px 1px rgba(0,0,0,.5)}
.${sc}.ds-on .ds-lamp{background:var(--tally);box-shadow:0 0 0 3px color-mix(in srgb,var(--tally) 22%,transparent),0 0 14px var(--tally);animation:${sc}-pulse 1.6s ease-in-out infinite}
@keyframes ${sc}-pulse{50%{box-shadow:0 0 0 5px color-mix(in srgb,var(--tally) 10%,transparent),0 0 22px var(--tally)}}
.${sc} .ds-chips{scrollbar-width:none}.${sc} .ds-chips::-webkit-scrollbar{display:none}
.${sc} .ds-warn{color:var(--tally)}
@media (prefers-reduced-motion:reduce){.${sc} .ds-m{transition:opacity .15s}.${sc} .ds-scan{display:none}.${sc}.ds-on .ds-lamp{animation:none}}
`;

  return (
    <div
      ref={rootRef}
      onPointerMove={onMove}
      onPointerLeave={() => setPtr(null)}
      className={cn(sc, "relative isolate overflow-clip", on && "ds-on", className)}
      style={style}
    >
      <style>{css}</style>
      <div ref={contentRef} className="relative">
        {children}
      </div>

      {/* masks */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
        {masks.map((k) => {
          const peek = on && alt && !!ptr && ptr.x >= k.x - 4 && ptr.x <= k.x + k.w + 4 && ptr.y >= k.y - 4 && ptr.y <= k.y + k.h + 4;
          return (
            <div
              key={k.id + k.t}
              className={cn("ds-m", peek && "ds-peek")}
              data-mode={m}
              data-t={k.t}
              style={{
                left: k.x,
                top: k.y,
                width: k.w,
                height: k.h,
                transitionDelay: on && sweeping ? Math.round((k.y / Math.max(1, size.h)) * 720) + "ms" : "0ms",
              }}
            >
              {m === "tag" && k.w > 38 && k.h > 11 ? <span>{TAG[k.t]}</span> : null}
            </div>
          );
        })}
      </div>
      {on && sweep > 0 && sweeping && <div key={sweep} className="ds-scan" style={{ ["--h" as string]: size.h + "px" } as React.CSSProperties} />}

      {watermark && <Watermark href={watermarkHref} />}

      {hud && (
        <div data-shield-ignore="" className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-3">
          <div role="toolbar" aria-label="Demo Shield" className="ds-hud pointer-events-auto flex max-w-full items-center gap-2 rounded-[16px] p-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setOn(!on)}
              aria-pressed={on}
              className="ds-key flex h-10 shrink-0 items-center gap-2.5 rounded-[11px] pl-3 pr-3.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--tally)]"
            >
              <span className="ds-lamp" />
              <span className="flex flex-col items-start leading-none">
                <span className="ds-mono text-[10px] font-bold tracking-[.16em]">{on ? "SHIELD ON" : "SHIELD OFF"}</span>
                <span className={cn("ds-mono mt-1 text-[10px] tabular-nums tracking-[.04em]", on ? "text-[var(--mute)]" : total ? "ds-warn" : "text-[var(--mute)]")}>
                  {on ? `${total} masked` : total ? `${total} exposed` : "nothing found"}
                </span>
              </span>
            </button>

            <div className="ds-chips flex min-w-0 items-center gap-1 overflow-x-auto">
              {present.map((t) => {
                const enabled = types[t];
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={enabled}
                    title={(enabled ? "Stop masking " : "Mask ") + (LABEL[t] ?? t).toLowerCase()}
                    onClick={() => setTypes((s) => ({ ...s, [t]: !s[t] }))}
                    className={cn(
                      "flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] border px-2 text-[12px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--tally)]",
                      enabled ? "border-[var(--line)] bg-[var(--key)]" : "border-transparent bg-transparent text-[var(--mute)]"
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full transition-opacity" style={{ background: DOT[t], opacity: enabled ? 1 : 0.3 }} />
                    <span className={cn("font-medium", !enabled && "line-through decoration-[var(--mute)]")}>{LABEL[t]}</span>
                    <span className="ds-mono text-[10px] tabular-nums text-[var(--mute)]">{counts[t] || 0}</span>
                  </button>
                );
              })}
            </div>

            <div className="hidden h-6 w-px shrink-0 bg-[var(--line)] sm:block" />

            <div className="hidden shrink-0 items-center gap-0.5 rounded-[10px] bg-[var(--panel2)] p-0.5 sm:flex" role="radiogroup" aria-label="Mask style">
              {(["bar", "blur", "tag"] as ShieldMode[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={m === v}
                  onClick={() => setMode(v)}
                  className={cn(
                    "ds-mono h-7 rounded-[8px] px-2.5 text-[10px] font-semibold uppercase tracking-[.12em] outline-none transition-all focus-visible:ring-2 focus-visible:ring-[var(--tally)]",
                    m === v ? "bg-[var(--key)] text-[var(--txt)] shadow-[0_1px_0_var(--keysh)]" : "text-[var(--mute)] hover:text-[var(--txt)]"
                  )}
                >
                  {v === "bar" ? "Redact" : v === "blur" ? "Blur" : "Label"}
                </button>
              ))}
            </div>

            <div className="ds-mono hidden shrink-0 items-center gap-1.5 pr-2 text-[10px] text-[var(--mute)] lg:flex">
              <kbd className="ds-key rounded-[5px] px-1.5 py-0.5 text-[10px] text-[var(--txt)]">⌥</kbd>
              <span>peek</span>
              {hotkey && (
                <>
                  <span className="mx-1 opacity-40">·</span>
                  <kbd className="ds-key rounded-[5px] px-1.5 py-0.5 text-[10px] text-[var(--txt)]">⌘⇧{hotkey.toUpperCase()}</kbd>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DemoShield;
