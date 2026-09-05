import React, { useState, useEffect, useMemo } from "react";
import {
  MapPin, Users, Calendar, Route as RouteIcon,
  FileText, MessageSquare, Plus, Trash2, X, Check, Copy,
  ChevronRight, Clock, Sparkles, AlertCircle, Loader2, ChevronLeft, Tag, ShieldCheck,
  Receipt, Camera, Download, BarChart3, History
} from "lucide-react";

// ---------- brand palette (from The Cleaning Genies logo/pricelist) ----------
const NAVY = "#111A3C";
const NAVY_DARK = "#0A1230";
const NAVY_TINT = "#EFEDF7";
const GOLD = "#C9A227";
const GOLD_DARK = "#AD8A1E";
const CREAM = "#F7F5EF";

// ---------- constants ----------
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const RATE_TYPES = ["per clean", "per hour"];
const FREQUENCIES = ["Weekly", "Fortnightly", "Monthly", "Deep Clean", "End of Tenancy", "Commercial", "One-off", "Custom"];
const FREQ_TO_RECURRENCE = {
  "Weekly": "weekly", "Fortnightly": "fortnightly", "Monthly": "monthly",
  "Deep Clean": "none", "End of Tenancy": "none", "Commercial": "weekly",
  "One-off": "none", "Custom": "none",
};
const RECURRENCE_LABEL = { none: "One-off", weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly" };

const DEFAULT_RATECARD = {
  blueLightPct: 20,
  frequencyRates: {
    "Weekly": { rateType: "per hour", rate: 17 },
    "Fortnightly": { rateType: "per hour", rate: 18.5 },
    "Monthly": { rateType: "per hour", rate: 20 },
    "Deep Clean": { rateType: "per hour", rate: 25 },
    "End of Tenancy": { rateType: "per clean", rate: 200 },
    "Commercial": { rateType: "per hour", rate: 24 },
  },
  catalog: [
    { id: "bed-single", label: "Strip & make bed — single", price: 7, unit: "per bed" },
    { id: "bed-double", label: "Strip & make bed — double", price: 10, unit: "per bed" },
    { id: "bed-king", label: "Strip & make bed — king/queen", price: 13, unit: "per bed" },
    { id: "bin-kitchen", label: "Empty kitchen & additional bins", price: 5, unit: "per bin" },
    { id: "bin-fluids", label: "Bathroom bin (bodily fluids / sanitary products)", price: 7.5, unit: "per bin" },
    { id: "fridge", label: "Inside fridge", price: 14, unit: "per fridge" },
    { id: "cupboard", label: "Inside cupboards (not pre-emptied)", price: 10, unit: "per cupboard" },
    { id: "cupboard-empty", label: "Inside cupboards (pre-emptied)", price: 7, unit: "per cupboard" },
    { id: "drain-bathroom", label: "Bathroom drain clearing", price: 14, unit: "per drain" },
    { id: "drain-kitchen", label: "Kitchen drain clearing", price: 10, unit: "per drain" },
    { id: "window", label: "Internal window cleaning", price: 5, unit: "per window" },
    { id: "sliding-door", label: "Double sliding doors", price: 10, unit: "flat" },
    { id: "steaming", label: "Steaming", price: 3, unit: "per room" },
  ],
};

const DEFAULT_POLICIES = [
  { id: "cancellation", title: "Cancellation policy", body: "" },
  { id: "access", title: "Access & keys", body: "" },
  { id: "holiday", title: "Holiday / time off", body: "" },
  { id: "complaints", title: "Complaints & re-cleans", body: "" },
  { id: "payment", title: "Payment terms", body: "" },
];

const EXPENSE_CATEGORIES = ["Supplies", "Mileage", "Insurance", "Equipment", "Uniforms", "Marketing", "Other"];
// Maps each category to its box on the Self Assessment self-employment
// short pages (SA103S 2024–25). Equipment is flagged separately since it's
// usually claimed as a capital allowance (Annual Investment Allowance),
// not a simple expense box.
const CATEGORY_TO_SA103 = {
  "Supplies": { box: "Box 11", label: "Costs of goods bought for resale or goods used" },
  "Mileage": { box: "Box 12", label: "Car, van and travel expenses" },
  "Insurance": { box: "Box 14", label: "Rent, rates, power and insurance costs" },
  "Marketing": { box: "Box 19", label: "Other allowable business expenses" },
  "Uniforms": { box: "Box 19", label: "Other allowable business expenses" },
  "Other": { box: "Box 19", label: "Other allowable business expenses" },
  "Equipment": { box: "Box 23 (capital allowances)", label: "Annual Investment Allowance — not part of Box 20 total, see note" },
};
const SA103_EXPENSE_BOXES = [
  { box: "Box 11", label: "Costs of goods bought for resale or goods used" },
  { box: "Box 12", label: "Car, van and travel expenses" },
  { box: "Box 14", label: "Rent, rates, power and insurance costs" },
  { box: "Box 19", label: "Other allowable business expenses" },
];
const HMRC_RATE_HIGH = 0.45;
const HMRC_RATE_LOW = 0.25;
const HMRC_MILE_THRESHOLD = 10000;

const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- date helpers ----------
const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const diffDays = (a, b) => { const da = new Date(a + "T00:00:00"), db = new Date(b + "T00:00:00"); return Math.round((db - da) / 86400000); };
const dayName = (iso) => { const d = new Date(iso + "T00:00:00"); return DAYS[(d.getDay() + 6) % 7]; };
const formatDate = (iso) => { if (!iso) return ""; const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); };
const mondayOf = (iso) => { const d = new Date(iso + "T00:00:00"); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// UK tax year runs 6 Apr – 5 Apr
const ukTaxYearStart = (iso) => {
  const d = new Date(iso + "T00:00:00");
  const year = d.getFullYear();
  const aprSix = new Date(`${year}-04-06T00:00:00`);
  const startYear = d < aprSix ? year - 1 : year;
  return `${startYear}-04-06`;
};
const ukTaxYearEnd = (startIso) => {
  const startYear = Number(startIso.slice(0, 4));
  return `${startYear + 1}-04-05`;
};
const ukTaxYearLabel = (startIso) => {
  const startYear = Number(startIso.slice(0, 4));
  return `${startYear}–${String(startYear + 1).slice(2)}`;
};
function priorMilesInTaxYear(expenses, dateISO, excludeId) {
  const start = ukTaxYearStart(dateISO);
  return expenses
    .filter((e) => e.category === "Mileage" && e.id !== excludeId && e.date >= start && e.date < dateISO)
    .reduce((s, e) => s + (Number(e.miles) || 0), 0);
}
function mileageAmount(priorMiles, miles) {
  const atHigh = Math.max(0, Math.min(miles, HMRC_MILE_THRESHOLD - priorMiles));
  const atLow = Math.max(0, miles - atHigh);
  return atHigh * HMRC_RATE_HIGH + atLow * HMRC_RATE_LOW;
}
const addMinutes = (hhmm, mins) => {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const mm = ((total % 60) + 60) % 60;
  return `${pad(hh)}:${pad(mm)}`;
};

function occursOn(job, targetIso) {
  const dd = diffDays(job.date, targetIso);
  if (dd < 0) return false;
  switch (job.recurrence) {
    case "weekly": return dd % 7 === 0;
    case "fortnightly": return dd % 14 === 0;
    case "monthly": {
      const start = new Date(job.date + "T00:00:00");
      const target = new Date(targetIso + "T00:00:00");
      return start.getDate() === target.getDate();
    }
    default: return dd === 0;
  }
}
function occurrencesInRange(job, startIso, endIso) {
  const out = [];
  let cursor = startIso, guard = 0;
  while (diffDays(cursor, endIso) >= 0 && guard < 400) {
    if (occursOn(job, cursor)) out.push(cursor);
    cursor = addDays(cursor, 1);
    guard++;
  }
  return out;
}
// total labour ("job.hours") shared across the assigned team -> minutes actually spent on site
function jobClockMinutes(job) {
  const team = Math.max(1, (job.cleanerIds || []).length);
  return Math.round(((Number(job.hours) || 0) * 60) / team);
}

const MESSAGE_TEMPLATES = [
  { id: "late", label: "Running late", icon: Clock,
    body: "Hi {client}, it's {business} — just letting you know {cleaner} is running about {minutes} minutes behind schedule today and will arrive closer to {time}. Sorry for the short notice, and thanks for your patience!" },
  { id: "reschedule", label: "Need to change day", icon: Calendar,
    body: "Hi {client}, it's {business}. We need to move your clean originally booked for {oldDate} — would {newDate} work instead? Let us know and we'll get it locked in. Sorry for the inconvenience!" },
  { id: "holiday", label: "Team holiday / time off", icon: Sparkles,
    body: "Hi {client}, it's {business}. Just a heads up that our team will be taking some time off from {startDate} to {endDate}, so your clean on {affectedDate} will be paused for that week. We'll pick back up on your usual schedule straight after — thanks for understanding!" },
  { id: "onway", label: "On our way", icon: RouteIcon,
    body: "Hi {client}, it's {business} — {cleaner} is on the way and should be with you by around {time}. See you soon!" },
  { id: "confirm", label: "Booking confirmation", icon: Check,
    body: "Hi {client}, thanks for booking with {business}! Confirming {cleaner} will be with you on {date} at {time}. If anything changes on your end just let us know." },
  { id: "reminder", label: "Day-before reminder", icon: AlertCircle,
    body: "Hi {client}, quick reminder from {business} that your clean is booked for tomorrow, {date} at {time}. See you then!" },
];

// ---------- storage helpers ----------
async function loadState() {
  const keys = ["business", "cleaners", "clients", "jobs", "ratecard", "policies", "expenses"];
  const out = {};
  for (const k of keys) {
    try { const r = await window.storage.get(k, false); out[k] = r ? JSON.parse(r.value) : null; }
    catch { out[k] = null; }
  }
  return out;
}
async function saveState(key, value) {
  try { await window.storage.set(key, JSON.stringify(value), false); }
  catch (e) { console.error("storage save failed", key, e); }
}

// compress a photo file down to a small base64 JPEG before storing
function compressImage(file, maxDim = 1000, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// export an array-of-arrays as a downloadable CSV
function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- postcode lookup (UK, free, no key — postcodes.io) ----------
async function geocodePostcode(postcode) {
  const clean = (postcode || "").replace(/\s+/g, "").toUpperCase();
  if (!clean) return { status: "empty" };
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`);
    if (res.status === 404) return { status: "notfound" };
    if (!res.ok) return { status: "error" };
    const data = await res.json();
    if (data && data.status === 200 && data.result) {
      return { status: "found", lat: data.result.latitude, lng: data.result.longitude };
    }
    return { status: "notfound" };
  } catch (e) {
    return { status: "error" }; // network/CORS blocked — caller should offer manual fallback
  }
}

// ---------- geometry ----------
function haversine(a, b) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function nearestNeighborRoute(start, stops) {
  const withCoords = stops.filter((s) => s.lat != null && s.lng != null);
  const withoutCoords = stops.filter((s) => s.lat == null || s.lng == null);
  if (withCoords.length === 0) return { ordered: stops, totalKm: null, hasCoords: false };
  const remaining = [...withCoords];
  const ordered = [];
  let current = start, totalKm = 0;
  while (remaining.length) {
    let bestIdx = 0, bestDist = Infinity;
    remaining.forEach((s, i) => { const d = haversine(current, s); if (d != null && d < bestDist) { bestDist = d; bestIdx = i; } });
    const next = remaining.splice(bestIdx, 1)[0];
    totalKm += bestDist === Infinity ? 0 : bestDist;
    ordered.push(next);
    current = next;
  }
  return { ordered: [...ordered, ...withoutCoords], totalKm, hasCoords: true };
}

// ---------- small UI atoms ----------
const Card = ({ children, className = "", onClick }) => <div onClick={onClick} className={`bg-white rounded-2xl border border-stone-200 shadow-sm ${className}`}>{children}</div>;
const Field = ({ label, children }) => (
  <label className="block mb-3">
    <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">{label}</span>
    {children}
  </label>
);
const inputCls = `w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[${NAVY}] focus:border-transparent`;
const Btn = ({ children, onClick, variant = "primary", className = "", type = "button", disabled }) => {
  const base = "inline-flex items-center gap-1.5 justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: `bg-[${NAVY}] text-white hover:bg-[${NAVY_DARK}]`,
    ghost: "bg-transparent text-stone-600 hover:bg-stone-100",
    danger: "bg-transparent text-red-600 hover:bg-red-50",
    gold: `bg-[${GOLD}] text-white hover:bg-[${GOLD_DARK}]`,
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>{children}</button>;
};
const Badge = ({ children, tone = "default" }) => {
  const tones = { default: "bg-stone-100 text-stone-600", green: `bg-[${NAVY_TINT}] text-[${NAVY}]`, gold: "bg-amber-50 text-amber-700" };
  return <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>;
};

// join names like "Sam, Priya & Jordan"
function joinNames(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

// ---------- main app ----------
export default function App() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");


  const [business, setBusiness] = useState({ name: "The Cleaning Genies", address: "", phone: "", email: "" });
  const [cleaners, setCleaners] = useState([]);
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [ratecard, setRatecard] = useState(DEFAULT_RATECARD);
  const [policies, setPolicies] = useState(DEFAULT_POLICIES);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    (async () => {
      const s = await loadState();
      if (s.business) setBusiness(s.business);
      if (s.cleaners) setCleaners(s.cleaners);
      else setCleaners([
        { id: uid(), name: "Cleaner 1", rate: 12 }, { id: uid(), name: "Cleaner 2", rate: 12 },
        { id: uid(), name: "Cleaner 3", rate: 12 }, { id: uid(), name: "Cleaner 4", rate: 12 },
      ]);
      if (s.clients) setClients(s.clients);
      if (s.jobs) setJobs(s.jobs);
      if (s.ratecard) setRatecard({ ...DEFAULT_RATECARD, ...s.ratecard });
      if (s.policies) setPolicies(s.policies);
      if (s.expenses) setExpenses(s.expenses);
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (!loading) saveState("business", business); }, [business, loading]);
  useEffect(() => { if (!loading) saveState("cleaners", cleaners); }, [cleaners, loading]);
  useEffect(() => { if (!loading) saveState("clients", clients); }, [clients, loading]);
  useEffect(() => { if (!loading) saveState("jobs", jobs); }, [jobs, loading]);
  useEffect(() => { if (!loading) saveState("ratecard", ratecard); }, [ratecard, loading]);
  useEffect(() => { if (!loading) saveState("policies", policies); }, [policies, loading]);
  useEffect(() => { if (!loading) saveState("expenses", expenses); }, [expenses, loading]);

  const tabs = [
    { id: "dashboard", label: "Today", icon: Sparkles },
    { id: "clients", label: "Clients", icon: MapPin },
    { id: "schedule", label: "Schedule", icon: Calendar },
    { id: "routes", label: "Routes", icon: RouteIcon },
    { id: "team", label: "Team", icon: Users },
    { id: "pricing", label: "Pricing", icon: Tag },
    { id: "expenses", label: "Expenses", icon: Receipt },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "invoices", label: "Invoices", icon: FileText },
    { id: "policies", label: "Policies", icon: ShieldCheck },
    { id: "messages", label: "Messages", icon: MessageSquare },
  ];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: NAVY }}><Loader2 className="w-6 h-6 text-white animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: CREAM }}>
      <div className="text-white px-4 pb-4 sticky top-0 z-20 shadow-md" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`, paddingTop: "calc(env(safe-area-inset-top) + 1.1rem)" }}>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2" style={{ background: NAVY_DARK, borderColor: GOLD }}>
            <Sparkles className="w-4 h-4" style={{ color: GOLD }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight truncate" style={{ fontFamily: "Georgia, serif", letterSpacing: "0.01em" }}>{business.name || "Cleaning App"}</h1>
            <p className="text-[11px] tracking-wide" style={{ color: GOLD }}>Team &amp; job manager</p>
          </div>
        </div>
      </div>

      <div className="px-3 pt-4 max-w-3xl mx-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 7rem)" }}>
        {tab === "dashboard" && <Dashboard cleaners={cleaners} clients={clients} jobs={jobs} />}
        {tab === "clients" && <Clients clients={clients} setClients={setClients} ratecard={ratecard} />}
        {tab === "schedule" && <Schedule cleaners={cleaners} clients={clients} jobs={jobs} setJobs={setJobs} />}
        {tab === "routes" && <Routes cleaners={cleaners} clients={clients} jobs={jobs} business={business} />}
        {tab === "team" && <Team cleaners={cleaners} setCleaners={setCleaners} />}
        {tab === "pricing" && <Pricing ratecard={ratecard} setRatecard={setRatecard} />}
        {tab === "expenses" && <Expenses expenses={expenses} setExpenses={setExpenses} />}
        {tab === "reports" && <Reports cleaners={cleaners} clients={clients} jobs={jobs} expenses={expenses} ratecard={ratecard} />}
        {tab === "invoices" && <Invoices clients={clients} jobs={jobs} business={business} setBusiness={setBusiness} ratecard={ratecard} />}
        {tab === "policies" && <Policies policies={policies} setPolicies={setPolicies} />}
        {tab === "messages" && <Messages business={business} cleaners={cleaners} clients={clients} />}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t z-20" style={{ borderColor: "#E5E1D8", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-3xl mx-auto grid grid-cols-5 gap-0.5 px-1 py-1.5 max-h-[112px] overflow-y-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg text-[10px] font-semibold min-h-[44px]"
                style={active ? { color: NAVY, background: NAVY_TINT } : { color: "#A8A29E" }}>
                <Icon className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Dashboard ----------
function Dashboard({ cleaners, clients, jobs }) {
  const today = todayISO();
  const todayJobs = jobs.filter((j) => occursOn(j, today));
  const byCleaner = cleaners.map((c) => ({
    cleaner: c,
    jobs: todayJobs.filter((j) => (j.cleanerIds || []).includes(c.id)).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-bold text-stone-800">Today · {formatDate(today)}</h2>
        <span className="text-xs text-stone-500">{todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""}</span>
      </div>
      {cleaners.length === 0 && <Card className="p-4 text-sm text-stone-500">Add your team on the Team tab to get started.</Card>}
      {byCleaner.map(({ cleaner, jobs: cj }) => (
        <Card key={cleaner.id} className="p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-stone-800 text-sm">{cleaner.name}</span>
            <span className="text-xs text-stone-400">£{cleaner.rate}/hr</span>
          </div>
          {cj.length === 0 ? <p className="text-xs text-stone-400">No jobs booked today.</p> : (
            <div className="space-y-1.5">
              {cj.map((j) => {
                const client = clients.find((c) => c.id === j.clientId);
                const mins = jobClockMinutes(j);
                const teammates = (j.cleanerIds || []).filter((id) => id !== cleaner.id).map((id) => cleaners.find((c) => c.id === id)?.name).filter(Boolean);
                return (
                  <div key={j.id} className="text-xs bg-stone-50 rounded-lg px-2.5 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-stone-500 shrink-0">{j.startTime}–{addMinutes(j.startTime, mins)}</span>
                      <span className="font-medium text-stone-800 truncate">{client?.name || "Unknown client"}</span>
                      <Badge tone="green">{RECURRENCE_LABEL[j.recurrence]}</Badge>
                      {client?.blueLight && <Badge tone="gold">Blue Light</Badge>}
                    </div>
                    {teammates.length > 0 && <div className="text-stone-500 mt-1 pl-9">with {joinNames(teammates)}</div>}
                    {client?.notes && <div className="text-amber-700 mt-1 pl-9">⭑ {client.notes}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ))}
      <Card className="p-3.5 text-white" style={{ background: NAVY }}>
        <div className="flex items-center gap-2 text-sm font-semibold mb-1"><RouteIcon className="w-4 h-4" style={{ color: GOLD }} /> Route tab</div>
        <p className="text-xs" style={{ color: "#C9CBE0" }}>Head to Routes to get each cleaner's optimised stop order for today, starting and ending at the depot.</p>
      </Card>
    </div>
  );
}

// ---------- Clients ----------
function Clients({ clients, setClients, ratecard }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const blank = { id: "", name: "", houseNumber: "", postcode: "", address: "", lat: null, lng: null, phone: "", email: "", rate: "", rateType: "per hour", frequency: "Weekly", notes: "", blueLight: false, extras: [], visitLog: [] };
  const [form, setForm] = useState(blank);
  const [extraDraft, setExtraDraft] = useState({ label: "", price: "" });
  const [catalogPick, setCatalogPick] = useState({ id: "", qty: 1 });
  const [geoStatus, setGeoStatus] = useState("idle"); // idle | checking | found | notfound | error
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [visitDraft, setVisitDraft] = useState({ date: todayISO(), note: "" });

  const startAdd = () => { setForm(blank); setExtraDraft({ label: "", price: "" }); setCatalogPick({ id: "", qty: 1 }); setGeoStatus("idle"); setShowManualCoords(false); setVisitDraft({ date: todayISO(), note: "" }); setEditing(null); setOpen(true); };
  const startEdit = (c) => { setForm({ ...blank, ...c, extras: c.extras || [], visitLog: c.visitLog || [] }); setExtraDraft({ label: "", price: "" }); setCatalogPick({ id: "", qty: 1 }); setGeoStatus(c.lat != null ? "found" : "idle"); setShowManualCoords(false); setVisitDraft({ date: todayISO(), note: "" }); setEditing(c.id); setOpen(true); };

  const lookupPostcode = async () => {
    if (!form.postcode || !form.postcode.trim()) { setGeoStatus("idle"); return; }
    setGeoStatus("checking");
    const result = await geocodePostcode(form.postcode);
    if (result.status === "found") { setForm((f) => ({ ...f, lat: result.lat, lng: result.lng })); setGeoStatus("found"); }
    else { setForm((f) => ({ ...f, lat: null, lng: null })); setGeoStatus(result.status); }
  };

  const pickFrequency = (freq) => {
    const rc = ratecard.frequencyRates[freq];
    setForm({ ...form, frequency: freq, ...(rc ? { rate: rc.rate, rateType: rc.rateType } : {}) });
  };

  const addCatalogExtra = () => {
    const item = ratecard.catalog.find((c) => c.id === catalogPick.id);
    if (!item) return;
    setForm({ ...form, extras: [...(form.extras || []), { id: uid(), label: item.label, unitPrice: item.price, qty: Number(catalogPick.qty) || 1 }] });
    setCatalogPick({ id: "", qty: 1 });
  };
  const addCustomExtra = () => {
    if (!extraDraft.label || extraDraft.price === "") return;
    setForm({ ...form, extras: [...(form.extras || []), { id: uid(), label: extraDraft.label, unitPrice: Number(extraDraft.price), qty: 1 }] });
    setExtraDraft({ label: "", price: "" });
  };
  const removeExtra = (id) => setForm({ ...form, extras: form.extras.filter((e) => e.id !== id) });

  const addVisitNote = () => {
    if (!visitDraft.note.trim()) return;
    setForm({ ...form, visitLog: [{ id: uid(), date: visitDraft.date, note: visitDraft.note }, ...(form.visitLog || [])] });
    setVisitDraft({ date: todayISO(), note: "" });
  };
  const removeVisitNote = (id) => setForm({ ...form, visitLog: (form.visitLog || []).filter((v) => v.id !== id) });

  const save = () => {
    if (!form.name || !form.address) return;
    const record = { ...form, id: form.id || uid(), rate: Number(form.rate) || 0 };
    if (editing) setClients(clients.map((c) => (c.id === editing ? record : c)));
    else setClients([...clients, record]);
    setOpen(false);
  };
  const remove = (id) => setClients(clients.filter((c) => c.id !== id));

  return (
    <div className="space-y-3">
      <button onClick={startAdd} className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left shadow-sm active:scale-[0.99] transition-transform" style={{ background: GOLD }}>
        <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center shrink-0"><Plus className="w-5 h-5 text-white" /></div>
        <div>
          <div className="text-sm font-bold text-white">Add client</div>
          <div className="text-xs text-white/85">Tap here to enter a new client's details</div>
        </div>
      </button>

      <h2 className="text-sm font-bold text-stone-800">Clients ({clients.length})</h2>

      {clients.length === 0 && (
        <Card className="p-5 text-center">
          <MapPin className="w-6 h-6 text-stone-300 mx-auto mb-2" />
          <p className="text-sm text-stone-500 mb-3">No clients yet. Tap "Add client" above to add your first one.</p>
        </Card>
      )}

      {clients.map((c) => (
        <Card key={c.id} className="p-3.5 flex items-start gap-2.5" onClick={() => startEdit(c)}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm text-stone-800">{c.name}</span>
              <Badge tone="green">{c.frequency}</Badge>
              {c.blueLight && <Badge tone="gold">Blue Light −{ratecard.blueLightPct}%</Badge>}
            </div>
            <div className="text-xs text-stone-400">{[c.houseNumber, c.address, c.postcode].filter(Boolean).join(", ")}</div>
            {(c.phone || c.email) && <div className="text-xs text-stone-400">{[c.phone, c.email].filter(Boolean).join(" · ")}</div>}
            <div className="text-xs text-stone-500 mt-0.5">£{c.rate} {c.rateType}</div>
            {c.extras?.length > 0 && <div className="text-xs text-amber-700 mt-0.5">+ {c.extras.map((e) => `${e.label}${e.qty > 1 ? ` ×${e.qty}` : ""}`).join(", ")}</div>}
            {c.notes && <div className="text-xs text-stone-500 mt-0.5 italic">"{c.notes}"</div>}
            {c.visitLog?.length > 0 && <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-1"><History className="w-3 h-3" /> {c.visitLog.length} visit note{c.visitLog.length !== 1 ? "s" : ""}</div>}
          </div>
          <button onClick={(e) => { e.stopPropagation(); startEdit(c); }} className="text-stone-300 shrink-0"><ChevronRight className="w-4 h-4" /></button>
        </Card>
      ))}

      {open && (
        <Modal onClose={() => setOpen(false)} title={editing ? "Edit client" : "Add client"}>
          <Field label="Client name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Address (street / area)"><input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Maple Street, Guildford" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="House number / name"><input className={inputCls} value={form.houseNumber} onChange={(e) => setForm({ ...form, houseNumber: e.target.value })} placeholder="e.g. 12 or Rose Cottage" /></Field>
            <Field label="Postcode">
              <div className="flex gap-1.5">
                <input className={`${inputCls} flex-1`} value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} placeholder="e.g. GU1 4AB" />
                <Btn variant="ghost" onClick={lookupPostcode} className="px-3 shrink-0">Find</Btn>
              </div>
            </Field>
          </div>
          {geoStatus === "checking" && <p className="text-xs text-stone-400 -mt-2 mb-3">Looking up postcode…</p>}
          {geoStatus === "found" && <p className="text-xs -mt-2 mb-3" style={{ color: NAVY }}>✓ Location found — this client will be included in optimised routes automatically.</p>}
          {geoStatus === "notfound" && <p className="text-xs text-amber-700 -mt-2 mb-3">That postcode wasn't recognised — double check it and tap Find again.</p>}
          {geoStatus === "error" && (
            <div className="text-xs text-amber-700 -mt-2 mb-3">
              Couldn't reach the postcode lookup service right now.{" "}
              <button type="button" className="underline font-semibold" onClick={() => setShowManualCoords(true)}>Enter coordinates manually instead</button>
            </div>
          )}
          {(showManualCoords || (geoStatus === "found" && form.lat != null)) && (
            <div className="grid grid-cols-2 gap-2 -mt-1">
              <Field label="Latitude"><input className={inputCls} value={form.lat ?? ""} onChange={(e) => setForm({ ...form, lat: e.target.value === "" ? null : Number(e.target.value) })} placeholder="e.g. 51.234" /></Field>
              <Field label="Longitude"><input className={inputCls} value={form.lng ?? ""} onChange={(e) => setForm({ ...form, lng: e.target.value === "" ? null : Number(e.target.value) })} placeholder="e.g. -0.567" /></Field>
            </div>
          )}
          {!showManualCoords && geoStatus !== "found" && geoStatus !== "error" && (
            <button type="button" className="text-xs text-stone-400 underline -mt-2 mb-3 block" onClick={() => setShowManualCoords(true)}>Enter coordinates manually instead</button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Phone"><input type="tel" className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>

          <Field label="Clean type / frequency">
            <select className={inputCls} value={form.frequency} onChange={(e) => pickFrequency(e.target.value)}>
              {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Rate (£)"><input type="number" className={inputCls} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></Field>
            <Field label="Rate type">
              <select className={inputCls} value={form.rateType} onChange={(e) => setForm({ ...form, rateType: e.target.value })}>
                {RATE_TYPES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
          </div>
          <p className="text-xs text-stone-400 -mt-2 mb-3">Rate auto-fills from your Pricing tab when you pick a clean type — edit it here for this client if they get a custom deal. For "per hour" this is the total contracted job size (e.g. a 3-hour clean is billed as 3 hours whether 1 or 4 cleaners attend).</p>

          <label className="flex items-center gap-2 mb-3 text-sm text-stone-700">
            <input type="checkbox" checked={form.blueLight} onChange={(e) => setForm({ ...form, blueLight: e.target.checked })} />
            Blue Light card holder (−{ratecard.blueLightPct}% on the clean rate)
          </label>

          <Field label="Special requirements / notes">
            <textarea className={inputCls} rows={2} placeholder="e.g. keys under mat, dog in garden, allergic to bleach" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>

          <Field label="Visit history">
            <div className="flex gap-1.5 mb-2">
              <input type="date" className={`${inputCls} w-36 shrink-0`} value={visitDraft.date} onChange={(e) => setVisitDraft({ ...visitDraft, date: e.target.value })} />
              <input className={`${inputCls} flex-1`} placeholder="e.g. left extra key, dog was loose in garden" value={visitDraft.note} onChange={(e) => setVisitDraft({ ...visitDraft, note: e.target.value })} />
              <Btn variant="ghost" onClick={addVisitNote}><Plus className="w-4 h-4" /></Btn>
            </div>
            {(form.visitLog || []).length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {form.visitLog.map((v) => (
                  <div key={v.id} className="flex items-start justify-between bg-stone-50 rounded-lg px-2.5 py-1.5 text-xs gap-2">
                    <div><span className="font-semibold text-stone-600">{formatDate(v.date)}</span> <span className="text-stone-600">— {v.note}</span></div>
                    <button onClick={() => removeVisitNote(v.id)} className="text-stone-300 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </Field>

          <Field label="Extras for this client">
            <div className="space-y-1 mb-2">
              {(form.extras || []).map((ex) => (
                <div key={ex.id} className="flex items-center justify-between bg-stone-50 rounded-lg px-2.5 py-1.5 text-xs">
                  <span className="text-stone-700">{ex.label}{ex.qty > 1 ? ` ×${ex.qty}` : ""}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-600">£{(ex.unitPrice * ex.qty).toFixed(2)}</span>
                    <button onClick={() => removeExtra(ex.id)} className="text-stone-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 mb-1.5">
              <select className={`${inputCls} flex-1`} value={catalogPick.id} onChange={(e) => setCatalogPick({ ...catalogPick, id: e.target.value })}>
                <option value="">Add from price list…</option>
                {ratecard.catalog.map((item) => <option key={item.id} value={item.id}>{item.label} — £{item.price} ({item.unit})</option>)}
              </select>
              <input type="number" min="1" className={`${inputCls} w-14`} value={catalogPick.qty} onChange={(e) => setCatalogPick({ ...catalogPick, qty: e.target.value })} />
              <Btn variant="ghost" onClick={addCatalogExtra}><Plus className="w-4 h-4" /></Btn>
            </div>
            <div className="flex gap-1.5">
              <input className={`${inputCls} flex-1`} placeholder="Custom extra name" value={extraDraft.label} onChange={(e) => setExtraDraft({ ...extraDraft, label: e.target.value })} />
              <input type="number" className={`${inputCls} w-16`} placeholder="£" value={extraDraft.price} onChange={(e) => setExtraDraft({ ...extraDraft, price: e.target.value })} />
              <Btn variant="ghost" onClick={addCustomExtra}><Plus className="w-4 h-4" /></Btn>
            </div>
          </Field>

          <div className="flex gap-2 mt-2">
            <Btn onClick={save} className="flex-1"><Check className="w-4 h-4" /> Save</Btn>
            {editing && <Btn variant="danger" onClick={() => { remove(editing); setOpen(false); }}><Trash2 className="w-4 h-4" /></Btn>}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- Schedule ----------
function Schedule({ cleaners, clients, jobs, setJobs }) {
  const [form, setForm] = useState({ clientId: "", cleanerIds: [], date: todayISO(), startTime: "09:00", hours: 3, recurrence: "weekly" });

  const pickClient = (clientId) => {
    const client = clients.find((c) => c.id === clientId);
    setForm({ ...form, clientId, recurrence: client ? FREQ_TO_RECURRENCE[client.frequency] || "none" : form.recurrence });
  };
  const toggleCleaner = (id) => {
    setForm({ ...form, cleanerIds: form.cleanerIds.includes(id) ? form.cleanerIds.filter((x) => x !== id) : [...form.cleanerIds, id] });
  };
  const addJob = () => {
    if (!form.clientId || form.cleanerIds.length === 0) return;
    setJobs([...jobs, { id: uid(), ...form, hours: Number(form.hours) }]);
    setForm({ ...form, clientId: "" });
  };
  const removeJob = (id) => setJobs(jobs.filter((j) => j.id !== id));
  const shown = [...jobs].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const previewMins = form.cleanerIds.length > 0 ? Math.round((Number(form.hours) || 0) * 60 / form.cleanerIds.length) : null;

  if (clients.length === 0) return <Card className="p-4 text-sm text-stone-500">Add at least one client on the Clients tab before booking jobs.</Card>;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="text-sm font-bold text-stone-800 mb-3">Book a job</h2>
        <Field label="Client">
          <select className={inputCls} value={form.clientId} onChange={(e) => pickClient(e.target.value)}>
            <option value="">Select client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        <Field label="Cleaners on this job">
          <div className="flex flex-wrap gap-1.5">
            {cleaners.map((c) => {
              const on = form.cleanerIds.includes(c.id);
              return (
                <button key={c.id} type="button" onClick={() => toggleCleaner(c.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                  style={on ? { background: NAVY, color: "white", borderColor: NAVY } : { background: "white", color: "#57534e", borderColor: "#d6d3d1" }}>
                  {c.name}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="First / only date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Start time"><input type="time" className={inputCls} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Job size (hours)"><input type="number" min="0.25" step="0.25" className={inputCls} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></Field>
          <Field label="Repeats">
            <select className={inputCls} value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}>
              <option value="none">One-off</option><option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option>
            </select>
          </Field>
        </div>
        {previewMins != null && (
          <p className="text-xs -mt-1 mb-2" style={{ color: NAVY }}>
            {form.cleanerIds.length} cleaner{form.cleanerIds.length !== 1 ? "s" : ""} → about {previewMins} min on site ({form.startTime}–{addMinutes(form.startTime, previewMins)}). Each cleaner is paid for their {previewMins} min at their own rate; the client is billed for the full {form.hours || 0} hour job.
          </p>
        )}
        <Btn onClick={addJob} className="w-full mt-1" disabled={form.cleanerIds.length === 0}><Plus className="w-4 h-4" /> Add to schedule</Btn>
      </Card>

      <h2 className="text-sm font-bold text-stone-800">Booked jobs</h2>
      <div className="space-y-1.5">
        {shown.length === 0 && <p className="text-xs text-stone-400">No jobs yet.</p>}
        {shown.map((j) => {
          const client = clients.find((c) => c.id === j.clientId);
          const team = (j.cleanerIds || []).map((id) => cleaners.find((c) => c.id === id)?.name).filter(Boolean);
          const mins = jobClockMinutes(j);
          const past = j.recurrence === "none" && diffDays(j.date, todayISO()) > 0;
          return (
            <Card key={j.id} className={`p-3 flex items-center gap-2.5 ${past ? "opacity-50" : ""}`}>
              <div className="text-center shrink-0 w-14">
                <div className="text-[10px] font-bold" style={{ color: NAVY }}>{dayName(j.date)}</div>
                <div className="text-[10px] text-stone-400">{formatDate(j.date)}</div>
                <div className="text-[10px] text-stone-400 font-mono">{j.startTime}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-stone-800 truncate">{client?.name}</span>
                  <Badge tone="green">{RECURRENCE_LABEL[j.recurrence]}</Badge>
                </div>
                <div className="text-xs text-stone-400 truncate">{joinNames(team) || "No cleaners assigned"} · {j.hours}hr job ({mins} min on site)</div>
              </div>
              <button onClick={() => removeJob(j.id)} className="text-stone-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Routes ----------
function Routes({ cleaners, clients, jobs, business }) {
  const [date, setDate] = useState(todayISO());
  const depot = useMemo(() => ({ lat: business.lat ?? null, lng: business.lng ?? null }), [business]);
  const dayJobs = jobs.filter((j) => occursOn(j, date));

  return (
    <div className="space-y-4">
      <Card className="p-3.5">
        <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {depot.lat == null && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mt-1">
            Add depot coordinates on the Invoices tab (business details) or on any client to get true distance-based route ordering. Without coordinates, stops show in the order booked.
          </p>
        )}
      </Card>
      {cleaners.map((c) => {
        const stops = dayJobs.filter((j) => (j.cleanerIds || []).includes(c.id))
          .map((j) => { const client = clients.find((cl) => cl.id === j.clientId); return { ...client, jobId: j.id, startTime: j.startTime, mins: jobClockMinutes(j), team: (j.cleanerIds || []).filter((id) => id !== c.id).map((id) => cleaners.find((cc) => cc.id === id)?.name).filter(Boolean) }; })
          .filter((s) => s.id);
        if (stops.length === 0) return null;
        const { ordered, totalKm, hasCoords } = nearestNeighborRoute(depot.lat != null ? depot : stops[0], stops);
        return (
          <Card key={c.id} className="p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-semibold text-sm text-stone-800">{c.name}</span>
              {hasCoords && totalKm != null && <span className="text-xs text-stone-400">~{totalKm.toFixed(1)} km</span>}
            </div>
            <ol className="space-y-2">
              <li className="flex items-center gap-2 text-xs text-stone-400"><span className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center font-bold shrink-0">•</span> Depot / start</li>
              {ordered.map((s, i) => (
                <li key={s.jobId} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: NAVY }}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-stone-800 truncate">{s.name}</div>
                      <div className="text-xs text-stone-400 truncate">{s.address}</div>
                    </div>
                    <span className="text-xs font-mono text-stone-400 shrink-0">{s.startTime}–{addMinutes(s.startTime, s.mins)}</span>
                  </div>
                  {s.team.length > 0 && <div className="text-xs text-stone-500 pl-7 mt-0.5">with {joinNames(s.team)}</div>}
                  {s.notes && <div className="text-xs text-amber-700 pl-7 mt-0.5">⭑ {s.notes}</div>}
                </li>
              ))}
              <li className="flex items-center gap-2 text-xs text-stone-400"><span className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center font-bold shrink-0">•</span> Back to depot</li>
            </ol>
          </Card>
        );
      })}
      {dayJobs.length === 0 && <Card className="p-4 text-sm text-stone-500">No jobs booked for {formatDate(date)} yet.</Card>}
    </div>
  );
}

// ---------- Team ----------
function docStatus(dateStr) {
  if (!dateStr) return null;
  const days = diffDays(todayISO(), dateStr);
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return "ok";
}
function Team({ cleaners, setCleaners }) {
  const update = (id, field, value) => setCleaners(cleaners.map((c) => (c.id === id ? { ...c, [field]: field === "rate" ? Number(value) : value } : c)));
  const remove = (id) => setCleaners(cleaners.filter((c) => c.id !== id));
  const add = () => setCleaners([...cleaners, { id: uid(), name: "New cleaner", rate: 12, dbsExpiry: "", insuranceExpiry: "" }]);
  return (
    <div className="space-y-3">
      <button onClick={add} className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left shadow-sm active:scale-[0.99] transition-transform" style={{ background: GOLD }}>
        <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center shrink-0"><Plus className="w-5 h-5 text-white" /></div>
        <div>
          <div className="text-sm font-bold text-white">Add cleaner</div>
          <div className="text-xs text-white/85">Add a new team member and their hourly rate</div>
        </div>
      </button>

      <h2 className="text-sm font-bold text-stone-800">Team ({cleaners.length})</h2>
      <p className="text-xs text-stone-400 -mt-2">When you book a job, pick 1–4 of these cleaners to work it together — pay and on-site time are worked out automatically from the team size.</p>
      {cleaners.map((c) => {
        const dbs = docStatus(c.dbsExpiry);
        const ins = docStatus(c.insuranceExpiry);
        return (
          <Card key={c.id} className="p-3.5">
            <div className="flex items-center gap-2.5 mb-2.5">
              <input className={`${inputCls} flex-1`} value={c.name} onChange={(e) => update(c.id, "name", e.target.value)} />
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-stone-400">£</span>
                <input type="number" className={`${inputCls} w-16`} value={c.rate} onChange={(e) => update(c.id, "rate", e.target.value)} />
                <span className="text-xs text-stone-400">/hr</span>
              </div>
              <button onClick={() => remove(c.id)} className="text-stone-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">DBS check expiry</span>
                <input type="date" className={inputCls} value={c.dbsExpiry || ""} onChange={(e) => update(c.id, "dbsExpiry", e.target.value)} />
                {dbs === "expired" && <p className="text-xs text-red-600 font-semibold mt-1">Expired</p>}
                {dbs === "soon" && <p className="text-xs text-amber-700 font-semibold mt-1">Expiring soon</p>}
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">Insurance expiry</span>
                <input type="date" className={inputCls} value={c.insuranceExpiry || ""} onChange={(e) => update(c.id, "insuranceExpiry", e.target.value)} />
                {ins === "expired" && <p className="text-xs text-red-600 font-semibold mt-1">Expired</p>}
                {ins === "soon" && <p className="text-xs text-amber-700 font-semibold mt-1">Expiring soon</p>}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- Pricing ----------
function Pricing({ ratecard, setRatecard }) {
  const updateFreqRate = (freq, field, value) => setRatecard({
    ...ratecard,
    frequencyRates: { ...ratecard.frequencyRates, [freq]: { ...ratecard.frequencyRates[freq], [field]: field === "rate" ? Number(value) : value } },
  });
  const updateCatalogItem = (id, field, value) => setRatecard({
    ...ratecard, catalog: ratecard.catalog.map((c) => (c.id === id ? { ...c, [field]: field === "price" ? Number(value) : value } : c)),
  });
  const removeCatalogItem = (id) => setRatecard({ ...ratecard, catalog: ratecard.catalog.filter((c) => c.id !== id) });
  const [newItem, setNewItem] = useState({ label: "", price: "", unit: "" });
  const addCatalogItem = () => {
    if (!newItem.label || newItem.price === "") return;
    setRatecard({ ...ratecard, catalog: [...ratecard.catalog, { id: uid(), label: newItem.label, price: Number(newItem.price), unit: newItem.unit || "flat" }] });
    setNewItem({ label: "", price: "", unit: "" });
  };

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h2 className="text-sm font-bold text-stone-800 mb-1">Clean rates</h2>
        <p className="text-xs text-stone-400 mb-3">These auto-fill when you set a client's clean type. Editing here won't change clients already saved.</p>
        {Object.keys(ratecard.frequencyRates).map((freq) => {
          const r = ratecard.frequencyRates[freq];
          return (
            <div key={freq} className="flex items-center gap-2 mb-2">
              <span className="text-sm text-stone-700 flex-1">{freq}</span>
              <span className="text-xs text-stone-400">£</span>
              <input type="number" className={`${inputCls} w-20`} value={r.rate} onChange={(e) => updateFreqRate(freq, "rate", e.target.value)} />
              <select className={`${inputCls} w-32`} value={r.rateType} onChange={(e) => updateFreqRate(freq, "rateType", e.target.value)}>
                {RATE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          );
        })}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-bold text-stone-800 mb-1">Blue Light discount</h2>
        <p className="text-xs text-stone-400 mb-2">Applied to the base clean rate for clients marked as Blue Light card holders.</p>
        <div className="flex items-center gap-2">
          <input type="number" className={`${inputCls} w-20`} value={ratecard.blueLightPct} onChange={(e) => setRatecard({ ...ratecard, blueLightPct: Number(e.target.value) })} />
          <span className="text-sm text-stone-600">% off</span>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-bold text-stone-800 mb-1">Additional costs / extras</h2>
        <p className="text-xs text-stone-400 mb-3">These appear as add-ons you can attach to any client, and can be included per invoice.</p>
        <div className="space-y-1.5 mb-3">
          {ratecard.catalog.map((item) => (
            <div key={item.id} className="flex items-center gap-1.5">
              <input className={`${inputCls} flex-1`} value={item.label} onChange={(e) => updateCatalogItem(item.id, "label", e.target.value)} />
              <span className="text-xs text-stone-400">£</span>
              <input type="number" className={`${inputCls} w-16`} value={item.price} onChange={(e) => updateCatalogItem(item.id, "price", e.target.value)} />
              <input className={`${inputCls} w-24`} value={item.unit} onChange={(e) => updateCatalogItem(item.id, "unit", e.target.value)} />
              <button onClick={() => removeCatalogItem(item.id)} className="text-stone-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input className={`${inputCls} flex-1`} placeholder="New item" value={newItem.label} onChange={(e) => setNewItem({ ...newItem, label: e.target.value })} />
          <input type="number" className={`${inputCls} w-16`} placeholder="£" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} />
          <input className={`${inputCls} w-20`} placeholder="unit" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
          <Btn variant="ghost" onClick={addCatalogItem}><Plus className="w-4 h-4" /></Btn>
        </div>
      </Card>
    </div>
  );
}

// ---------- Policies ----------
function Policies({ policies, setPolicies }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", title: "", body: "" });

  const startAdd = () => { setForm({ id: "", title: "", body: "" }); setOpen(true); };
  const startEdit = (p) => { setForm(p); setOpen(true); };
  const save = () => {
    if (!form.title) return;
    const record = { ...form, id: form.id || uid() };
    setPolicies(form.id ? policies.map((p) => (p.id === form.id ? record : p)) : [...policies, record]);
    setOpen(false);
  };
  const remove = (id) => { setPolicies(policies.filter((p) => p.id !== id)); setOpen(false); };

  return (
    <div className="space-y-3">
      <button onClick={startAdd} className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left shadow-sm active:scale-[0.99] transition-transform" style={{ background: GOLD }}>
        <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center shrink-0"><Plus className="w-5 h-5 text-white" /></div>
        <div>
          <div className="text-sm font-bold text-white">Add policy</div>
          <div className="text-xs text-white/85">Cancellations, access, holidays, complaints &amp; more</div>
        </div>
      </button>

      <h2 className="text-sm font-bold text-stone-800">Policies ({policies.length})</h2>
      <p className="text-xs text-stone-400 -mt-2">Keep your terms handy here so you can quote them to clients or new starters in seconds.</p>

      {policies.map((p) => (
        <Card key={p.id} className="p-3.5" onClick={() => startEdit(p)}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-sm" style={{ color: NAVY }}>{p.title}</span>
            <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
          </div>
          <p className="text-xs text-stone-500 whitespace-pre-wrap line-clamp-3">{p.body || "Tap to add details…"}</p>
        </Card>
      ))}

      {open && (
        <Modal onClose={() => setOpen(false)} title={form.id ? "Edit policy" : "Add policy"}>
          <Field label="Title"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Cancellation policy" /></Field>
          <Field label="Details">
            <textarea className={inputCls} rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="e.g. We ask for 48 hours' notice for cancellations. Cancellations with less notice may be charged at 50% of the usual rate." />
          </Field>
          <div className="flex gap-2 mt-2">
            <Btn onClick={save} className="flex-1"><Check className="w-4 h-4" /> Save</Btn>
            {form.id && <Btn variant="danger" onClick={() => remove(form.id)}><Trash2 className="w-4 h-4" /></Btn>}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- Expenses ----------
function Expenses({ expenses, setExpenses }) {
  const blank = { id: "", date: todayISO(), category: "Supplies", amount: "", miles: "", notes: "" };
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [monthFilter, setMonthFilter] = useState(todayISO().slice(0, 7));

  const startAdd = () => { setForm(blank); setReceiptPreview(null); setEditing(null); setOpen(true); };
  const startEdit = async (e) => {
    setForm({ ...blank, ...e, amount: e.amount ?? "", miles: e.miles ?? "" });
    setEditing(e.id);
    setReceiptPreview(null);
    setOpen(true);
    if (e.hasReceipt) {
      try { const r = await window.storage.get(`receipt:${e.id}`, false); if (r) setReceiptPreview(r.value); } catch {}
    }
  };

  const handlePhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    try { const dataUrl = await compressImage(file); setReceiptPreview(dataUrl); } catch {}
    setUploading(false);
  };
  const removePhoto = () => setReceiptPreview(null);

  const priorMiles = form.category === "Mileage" ? priorMilesInTaxYear(expenses, form.date, editing) : 0;
  const computedMileageAmount = form.category === "Mileage" ? mileageAmount(priorMiles, Number(form.miles) || 0) : null;

  const save = async () => {
    if (!form.date) return;
    if (form.category === "Mileage" && form.miles === "") return;
    if (form.category !== "Mileage" && form.amount === "") return;
    const id = form.id || uid();
    const amount = form.category === "Mileage" ? computedMileageAmount : Number(form.amount) || 0;
    const record = {
      id, date: form.date, category: form.category, amount,
      miles: form.category === "Mileage" ? Number(form.miles) || 0 : undefined,
      notes: form.notes, hasReceipt: !!receiptPreview,
    };
    if (receiptPreview) { try { await window.storage.set(`receipt:${id}`, receiptPreview, false); } catch {} }
    else if (editing) { try { await window.storage.delete(`receipt:${id}`, false); } catch {} }
    setExpenses(editing ? expenses.map((x) => (x.id === editing ? record : x)) : [...expenses, record]);
    setOpen(false);
  };
  const remove = async (id) => {
    setExpenses(expenses.filter((x) => x.id !== id));
    try { await window.storage.delete(`receipt:${id}`, false); } catch {}
    setOpen(false);
  };

  const months = useMemo(() => {
    const set = new Set(expenses.map((e) => e.date.slice(0, 7)));
    set.add(todayISO().slice(0, 7));
    return [...set].sort().reverse();
  }, [expenses]);
  const shown = expenses.filter((e) => monthFilter === "all" || e.date.slice(0, 7) === monthFilter).sort((a, b) => b.date.localeCompare(a.date));
  const monthTotal = shown.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const monthMiles = shown.filter((e) => e.category === "Mileage").reduce((s, e) => s + (Number(e.miles) || 0), 0);

  const exportExpenses = () => downloadCSV("expenses.csv", [
    ["Date", "Category", "Amount", "Miles", "Notes"],
    ...expenses.map((e) => [e.date, e.category, e.amount, e.miles ?? "", e.notes || ""]),
  ]);

  return (
    <div className="space-y-3">
      <button onClick={startAdd} className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left shadow-sm active:scale-[0.99] transition-transform" style={{ background: GOLD }}>
        <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center shrink-0"><Plus className="w-5 h-5 text-white" /></div>
        <div>
          <div className="text-sm font-bold text-white">Add expense</div>
          <div className="text-xs text-white/85">Log a cost, mileage trip, or receipt photo</div>
        </div>
      </button>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-stone-800">Expenses</h2>
        <select className="text-xs rounded-lg border border-stone-300 bg-white px-2 py-1" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          <option value="all">All time</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 text-center">
          <div className="text-[10px] text-stone-400 uppercase font-semibold">Total</div>
          <div className="text-sm font-bold text-stone-800">£{monthTotal.toFixed(2)}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[10px] text-stone-400 uppercase font-semibold">Miles logged</div>
          <div className="text-sm font-bold text-stone-800">{monthMiles}</div>
        </Card>
      </div>

      {shown.length === 0 && <Card className="p-4 text-sm text-stone-500">No expenses logged for this period yet.</Card>}
      {shown.map((e) => (
        <Card key={e.id} className="p-3 flex items-center gap-2.5" onClick={() => startEdit(e)}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: NAVY_TINT }}>
            <Receipt className="w-4 h-4" style={{ color: NAVY }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-stone-800">{e.category}</span>
              {e.hasReceipt && <Camera className="w-3 h-3 text-stone-400" />}
            </div>
            <div className="text-xs text-stone-400">{formatDate(e.date)}{e.category === "Mileage" ? ` · ${e.miles} mi` : ""}{e.notes ? ` · ${e.notes}` : ""}</div>
          </div>
          <span className="text-sm font-bold text-stone-800 shrink-0">£{Number(e.amount).toFixed(2)}</span>
        </Card>
      ))}

      {expenses.length > 0 && (
        <Btn variant="ghost" onClick={exportExpenses} className="w-full"><Download className="w-4 h-4" /> Export all as CSV</Btn>
      )}

      <p className="text-xs text-stone-400 px-1">This is a record-keeping tool, not tax software — it doesn't file anything with HMRC. For Self Assessment or Making Tax Digital, use an accountant or dedicated bookkeeping software; this just keeps your receipts and mileage organised for that.</p>

      {open && (
        <Modal onClose={() => setOpen(false)} title={editing ? "Edit expense" : "Add expense"}>
          <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Category">
            <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>

          {form.category === "Mileage" ? (
            <>
              <Field label="Miles driven"><input type="number" min="0" step="0.1" className={inputCls} value={form.miles} onChange={(e) => setForm({ ...form, miles: e.target.value })} /></Field>
              <p className="text-xs -mt-2 mb-3" style={{ color: NAVY }}>
                {priorMiles.toLocaleString()} miles already logged this UK tax year (from 6 Apr). At HMRC rates (45p up to 10,000 miles/year, 25p after), this trip works out to <strong>£{(computedMileageAmount || 0).toFixed(2)}</strong>.
              </p>
            </>
          ) : (
            <Field label="Amount (£)"><input type="number" step="0.01" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          )}

          <Field label="Notes (optional)"><input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. supplier name" /></Field>

          <Field label="Receipt photo (optional)">
            {receiptPreview ? (
              <div className="relative inline-block">
                <img src={receiptPreview} alt="Receipt" className="rounded-lg max-h-40 border border-stone-200" />
                <button onClick={removePhoto} className="absolute -top-2 -right-2 bg-white rounded-full shadow p-1 text-stone-500 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 py-4 text-sm text-stone-500 cursor-pointer">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {uploading ? "Processing…" : "Take or choose a photo"}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0])} />
              </label>
            )}
          </Field>

          <div className="flex gap-2 mt-2">
            <Btn onClick={save} className="flex-1"><Check className="w-4 h-4" /> Save</Btn>
            {editing && <Btn variant="danger" onClick={() => remove(editing)}><Trash2 className="w-4 h-4" /></Btn>}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- Reports ----------
function Reports({ cleaners, clients, jobs, expenses, ratecard }) {
  const [weekStart, setWeekStart] = useState(mondayOf(todayISO()));
  const weekEnd = addDays(weekStart, 6);

  const payRows = cleaners.map((c) => {
    const cJobs = jobs.filter((j) => (j.cleanerIds || []).includes(c.id));
    let totalMins = 0, jobCount = 0;
    cJobs.forEach((j) => { const occs = occurrencesInRange(j, weekStart, weekEnd); const mins = jobClockMinutes(j); totalMins += occs.length * mins; jobCount += occs.length; });
    const hours = totalMins / 60;
    return { cleaner: c, jobCount, hours, pay: hours * c.rate };
  });
  const weekPayroll = payRows.reduce((s, r) => s + r.pay, 0);

  let weekRevenue = 0;
  clients.forEach((client) => {
    jobs.filter((j) => j.clientId === client.id).forEach((j) => {
      const occs = occurrencesInRange(j, weekStart, weekEnd);
      if (occs.length === 0) return;
      const lineAmt = client.rateType === "per hour" ? (Number(j.hours) || 0) * client.rate : client.rate;
      const discounted = client.blueLight ? lineAmt * (1 - (ratecard.blueLightPct || 0) / 100) : lineAmt;
      weekRevenue += discounted * occs.length;
    });
  });

  const weekExpenseRows = expenses.filter((e) => e.date >= weekStart && e.date <= weekEnd);
  const weekExpensesTotal = weekExpenseRows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const net = weekRevenue - weekPayroll - weekExpensesTotal;

  // ---- Self Assessment (SA103S) summary, by UK tax year ----
  const [taxYearStart, setTaxYearStart] = useState(ukTaxYearStart(todayISO()));
  const taxYearEnd = ukTaxYearEnd(taxYearStart);
  const shiftTaxYear = (n) => { const y = Number(taxYearStart.slice(0, 4)) + n; setTaxYearStart(`${y}-04-06`); };

  let turnover = 0;
  clients.forEach((client) => {
    jobs.filter((j) => j.clientId === client.id).forEach((j) => {
      const occs = occurrencesInRange(j, taxYearStart, taxYearEnd);
      if (occs.length === 0) return;
      const lineAmt = client.rateType === "per hour" ? (Number(j.hours) || 0) * client.rate : client.rate;
      const discounted = client.blueLight ? lineAmt * (1 - (ratecard.blueLightPct || 0) / 100) : lineAmt;
      turnover += discounted * occs.length;
    });
  });

  const yearExpenses = expenses.filter((e) => e.date >= taxYearStart && e.date <= taxYearEnd);
  const boxTotals = SA103_EXPENSE_BOXES.map((b) => ({
    ...b,
    total: yearExpenses.filter((e) => (CATEGORY_TO_SA103[e.category]?.box) === b.box).reduce((s, e) => s + (Number(e.amount) || 0), 0),
  }));
  const box20Total = boxTotals.reduce((s, b) => s + b.total, 0);
  const equipmentTotal = yearExpenses.filter((e) => e.category === "Equipment").reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netProfitEstimate = turnover - box20Total;

  const exportSA103 = () => downloadCSV(`sa103-summary-${ukTaxYearLabel(taxYearStart)}.csv`, [
    ["SA103S box", "What it's for", "Amount"],
    ["Box 9", "Turnover (estimated from scheduled cleans)", turnover.toFixed(2)],
    ...boxTotals.map((b) => [b.box, b.label, b.total.toFixed(2)]),
    ["Box 20", "Total allowable expenses (Box 11–19)", box20Total.toFixed(2)],
    ["Box 21", "Net profit estimate (Box 9 − Box 20)", netProfitEstimate.toFixed(2)],
    ["Box 23 (capital allowances)", "Equipment — claim via Annual Investment Allowance, not Box 20", equipmentTotal.toFixed(2)],
  ]);

  const exportClients = () => downloadCSV("clients.csv", [
    ["Name", "House number", "Address", "Postcode", "Phone", "Email", "Frequency", "Rate", "Rate type", "Blue Light"],
    ...clients.map((c) => [c.name, c.houseNumber, c.address, c.postcode, c.phone, c.email, c.frequency, c.rate, c.rateType, c.blueLight ? "Yes" : "No"]),
  ]);
  const exportJobs = () => downloadCSV("jobs.csv", [
    ["Client", "Date", "Start time", "Hours", "Repeats", "Cleaners"],
    ...jobs.map((j) => [clients.find((c) => c.id === j.clientId)?.name || "", j.date, j.startTime, j.hours, RECURRENCE_LABEL[j.recurrence], (j.cleanerIds || []).map((id) => cleaners.find((c) => c.id === id)?.name).filter(Boolean).join("; ")]),
  ]);
  const exportExpenses = () => downloadCSV("expenses.csv", [
    ["Date", "Category", "Amount", "Miles", "Notes"],
    ...expenses.map((e) => [e.date, e.category, e.amount, e.miles ?? "", e.notes || ""]),
  ]);

  return (
    <div className="space-y-3">
      <Card className="p-3.5 flex items-center justify-between">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="text-stone-400"><ChevronLeft className="w-5 h-5" /></button>
        <div className="text-center">
          <div className="text-xs font-semibold text-stone-800">{formatDate(weekStart)} – {formatDate(weekEnd)}</div>
          <div className="text-[10px] text-stone-400">tap arrows to change week</div>
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="text-stone-400"><ChevronRight className="w-5 h-5" /></button>
      </Card>
      {weekStart !== mondayOf(todayISO()) && (
        <button onClick={() => setWeekStart(mondayOf(todayISO()))} className="text-xs font-semibold underline block mx-auto" style={{ color: NAVY }}>Jump to current week</button>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <div className="text-[10px] text-stone-400 uppercase font-semibold">Revenue</div>
          <div className="text-sm font-bold text-stone-800">£{weekRevenue.toFixed(0)}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[10px] text-stone-400 uppercase font-semibold">Payroll</div>
          <div className="text-sm font-bold text-stone-800">£{weekPayroll.toFixed(0)}</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-[10px] text-stone-400 uppercase font-semibold">Expenses</div>
          <div className="text-sm font-bold text-stone-800">£{weekExpensesTotal.toFixed(0)}</div>
        </Card>
      </div>

      <Card className="p-4 text-white" style={{ background: NAVY }}>
        <div className="text-xs mb-1" style={{ color: GOLD }}>Estimated net this week</div>
        <div className="text-2xl font-bold">£{net.toFixed(2)}</div>
        <p className="text-xs mt-1" style={{ color: "#C9CBE0" }}>Revenue is estimated from scheduled cleans (excludes extras added at invoice time). Payroll and expenses are what's logged for this week.</p>
      </Card>

      <h2 className="text-sm font-bold text-stone-800">Payroll breakdown</h2>
      {payRows.map(({ cleaner, jobCount, hours, pay }) => (
        <Card key={cleaner.id} className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-stone-800">{cleaner.name}</span>
            <span className="text-base font-bold" style={{ color: NAVY }}>£{pay.toFixed(2)}</span>
          </div>
          <div className="text-xs text-stone-400 mt-0.5">{jobCount} job{jobCount !== 1 ? "s" : ""} · {hours.toFixed(2)} hrs on site · £{cleaner.rate}/hr</div>
        </Card>
      ))}

      <Card className="p-4">
        <h2 className="text-sm font-bold text-stone-800 mb-1">Self Assessment summary (SA103S)</h2>
        <p className="text-xs text-stone-400 mb-3">Maps your logged expenses to the current short self-employment pages, box by box, so you can copy the figures straight across. This organises your records — it isn't tax advice and doesn't check anything with HMRC, so it's worth a quick sense-check (or an accountant) before you file, especially if turnover is near £90,000 or you have capital equipment.</p>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => shiftTaxYear(-1)} className="text-stone-400"><ChevronLeft className="w-5 h-5" /></button>
          <div className="text-sm font-semibold text-stone-800">Tax year {ukTaxYearLabel(taxYearStart)}</div>
          <button onClick={() => shiftTaxYear(1)} className="text-stone-400"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between bg-stone-50 rounded-lg px-2.5 py-1.5">
            <span><strong>Box 9</strong> — Turnover (estimated)</span><span className="font-semibold">£{turnover.toFixed(2)}</span>
          </div>
          {boxTotals.map((b) => (
            <div key={b.box} className="flex justify-between px-2.5 py-1">
              <span>{b.box} — {b.label}</span><span>£{b.total.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between bg-stone-50 rounded-lg px-2.5 py-1.5 font-semibold">
            <span>Box 20 — Total allowable expenses</span><span>£{box20Total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between rounded-lg px-2.5 py-1.5 font-bold" style={{ background: NAVY_TINT, color: NAVY }}>
            <span>Box 21 — Net profit (estimate)</span><span>£{netProfitEstimate.toFixed(2)}</span>
          </div>
          {equipmentTotal > 0 && (
            <div className="flex justify-between text-amber-700 px-2.5 py-1">
              <span>Equipment: £{equipmentTotal.toFixed(2)} — usually goes under capital allowances (Box 23, Annual Investment Allowance), not Box 20</span>
            </div>
          )}
        </div>
        <Btn variant="ghost" onClick={exportSA103} className="w-full mt-3"><Download className="w-4 h-4" /> Export SA103 summary</Btn>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-bold text-stone-800 mb-1">Export data</h2>
        <p className="text-xs text-stone-400 mb-3">Download CSV files for your records, an accountant, or backup.</p>
        <div className="space-y-2">
          <Btn variant="ghost" onClick={exportClients} className="w-full"><Download className="w-4 h-4" /> Export clients</Btn>
          <Btn variant="ghost" onClick={exportJobs} className="w-full"><Download className="w-4 h-4" /> Export schedule / jobs</Btn>
          <Btn variant="ghost" onClick={exportExpenses} className="w-full"><Download className="w-4 h-4" /> Export expenses</Btn>
        </div>
      </Card>
    </div>
  );
}

// ---------- Invoices ----------
function Invoices({ clients, jobs, business, setBusiness, ratecard }) {
  const [clientId, setClientId] = useState("");
  const [invoiceNum, setInvoiceNum] = useState("001");
  const [periodStart, setPeriodStart] = useState(mondayOf(todayISO()));
  const [periodEnd, setPeriodEnd] = useState(addDays(mondayOf(todayISO()), 6));
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [depotGeoStatus, setDepotGeoStatus] = useState(business.lat != null ? "found" : "idle");
  const [showDepotManualCoords, setShowDepotManualCoords] = useState(false);

  const lookupDepotPostcode = async () => {
    if (!business.postcode || !business.postcode.trim()) { setDepotGeoStatus("idle"); return; }
    setDepotGeoStatus("checking");
    const result = await geocodePostcode(business.postcode);
    if (result.status === "found") { setBusiness({ ...business, lat: result.lat, lng: result.lng }); setDepotGeoStatus("found"); }
    else { setBusiness({ ...business, lat: null, lng: null }); setDepotGeoStatus(result.status); }
  };

  const client = clients.find((c) => c.id === clientId);
  const clientJobs = jobs.filter((j) => j.clientId === clientId);
  // client is billed for the contracted job size (hours), not affected by team size
  const lineAmount = (j) => (client?.rateType === "per hour" ? (Number(j.hours) || 0) * client.rate : client?.rate || 0);

  const occurrences = clientJobs.flatMap((j) => occurrencesInRange(j, periodStart, periodEnd).map((date) => ({ date, job: j, amount: lineAmount(j) })))
    .sort((a, b) => a.date.localeCompare(b.date));

  const cleansSubtotal = occurrences.reduce((s, o) => s + o.amount, 0);
  const discountAmount = client?.blueLight ? cleansSubtotal * ((ratecard.blueLightPct || 0) / 100) : 0;
  const extrasTotal = (client?.extras || []).filter((e) => selectedExtras.includes(e.id)).reduce((s, e) => s + e.unitPrice * e.qty, 0);
  const total = cleansSubtotal - discountAmount + extrasTotal;

  const toggleExtra = (id) => setSelectedExtras((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const printInvoice = () => {
    const win = window.open("", "_blank");
    const cleanRows = occurrences.map((o) =>
      `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${formatDate(o.date)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${o.job.startTime}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${o.job.hours} hr clean</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">£${o.amount.toFixed(2)}</td></tr>`
    ).join("");
    const discountRow = discountAmount > 0 ? `<tr><td colspan="3" style="padding:6px 8px;border-bottom:1px solid #eee;color:${NAVY}">Blue Light discount (${ratecard.blueLightPct}%)</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;color:${NAVY}">−£${discountAmount.toFixed(2)}</td></tr>` : "";
    const extraRows = (client?.extras || []).filter((e) => selectedExtras.includes(e.id)).map((e) =>
      `<tr><td colspan="3" style="padding:6px 8px;border-bottom:1px solid #eee">${e.label}${e.qty > 1 ? ` ×${e.qty}` : ""}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">£${(e.unitPrice * e.qty).toFixed(2)}</td></tr>`
    ).join("");
    win.document.write(`
      <html><head><title>Invoice ${invoiceNum}</title></head>
      <body style="font-family:Georgia,serif;color:#222;max-width:600px;margin:40px auto;">
        <h1 style="color:${NAVY};margin-bottom:0;">${business.name}</h1>
        <p style="color:#888;margin-top:4px;font-family:Arial,sans-serif;">${[business.houseNumber, business.address].filter(Boolean).join(" ")}${business.postcode ? ", " + business.postcode : ""} ${business.phone ? " · " + business.phone : ""} ${business.email ? " · " + business.email : ""}</p>
        <hr style="border-color:${GOLD};"/>
        <h2>Invoice #${invoiceNum}</h2>
        <p style="font-family:Arial,sans-serif;"><strong>Bill to:</strong> ${client?.name || ""}<br/>${[client?.houseNumber, client?.address].filter(Boolean).join(" ")}${client?.postcode ? ", " + client.postcode : ""}${client?.phone ? "<br/>" + client.phone : ""}${client?.email ? "<br/>" + client.email : ""}</p>
        <p style="color:#888;font-size:13px;font-family:Arial,sans-serif;">Period: ${formatDate(periodStart)} – ${formatDate(periodEnd)}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;font-family:Arial,sans-serif;">
          <thead><tr style="text-align:left;color:#666;font-size:13px;"><th style="padding:6px 8px;">Date</th><th style="padding:6px 8px;">Time</th><th style="padding:6px 8px;">Job</th><th style="padding:6px 8px;text-align:right;">Amount</th></tr></thead>
          <tbody>${cleanRows}${discountRow}${extraRows}</tbody>
        </table>
        <h3 style="text-align:right;margin-top:16px;color:${NAVY};">Total due: £${total.toFixed(2)}</h3>
        <p style="color:#888;font-size:12px;margin-top:32px;font-family:Arial,sans-serif;">Thank you for your business!</p>
        <script>window.print()</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h2 className="text-sm font-bold text-stone-800 mb-3">Business details</h2>
        <Field label="Business name"><input className={inputCls} value={business.name} onChange={(e) => setBusiness({ ...business, name: e.target.value })} /></Field>
        <Field label="Address (street / area)"><input className={inputCls} value={business.address || ""} onChange={(e) => setBusiness({ ...business, address: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="House number / name"><input className={inputCls} value={business.houseNumber || ""} onChange={(e) => setBusiness({ ...business, houseNumber: e.target.value })} placeholder="e.g. Unit 4" /></Field>
          <Field label="Depot postcode">
            <div className="flex gap-1.5">
              <input className={`${inputCls} flex-1`} value={business.postcode || ""} onChange={(e) => setBusiness({ ...business, postcode: e.target.value })} placeholder="e.g. GU1 4AB" />
              <Btn variant="ghost" onClick={lookupDepotPostcode} className="px-3 shrink-0">Find</Btn>
            </div>
          </Field>
        </div>
        {depotGeoStatus === "checking" && <p className="text-xs text-stone-400 -mt-1 mb-3">Looking up postcode…</p>}
        {depotGeoStatus === "found" && <p className="text-xs -mt-1 mb-3" style={{ color: NAVY }}>✓ Location found — used as the start/end point for optimised routes.</p>}
        {depotGeoStatus === "notfound" && <p className="text-xs text-amber-700 -mt-1 mb-3">That postcode wasn't recognised — double check it and tap Find again.</p>}
        {depotGeoStatus === "error" && (
          <div className="text-xs text-amber-700 -mt-1 mb-3">
            Couldn't reach the postcode lookup service right now.{" "}
            <button type="button" className="underline font-semibold" onClick={() => setShowDepotManualCoords(true)}>Enter coordinates manually instead</button>
          </div>
        )}
        {(showDepotManualCoords || (depotGeoStatus === "found" && business.lat != null)) && (
          <div className="grid grid-cols-2 gap-2 mb-1">
            <Field label="Latitude"><input className={inputCls} value={business.lat ?? ""} onChange={(e) => setBusiness({ ...business, lat: e.target.value === "" ? null : Number(e.target.value) })} placeholder="e.g. 51.234" /></Field>
            <Field label="Longitude"><input className={inputCls} value={business.lng ?? ""} onChange={(e) => setBusiness({ ...business, lng: e.target.value === "" ? null : Number(e.target.value) })} placeholder="e.g. -0.567" /></Field>
          </div>
        )}
        {!showDepotManualCoords && depotGeoStatus !== "found" && depotGeoStatus !== "error" && (
          <button type="button" className="text-xs text-stone-400 underline mb-3 block" onClick={() => setShowDepotManualCoords(true)}>Enter coordinates manually instead</button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Phone"><input className={inputCls} value={business.phone || ""} onChange={(e) => setBusiness({ ...business, phone: e.target.value })} /></Field>
          <Field label="Email"><input className={inputCls} value={business.email || ""} onChange={(e) => setBusiness({ ...business, email: e.target.value })} /></Field>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-bold text-stone-800 mb-3">Generate invoice</h2>
        <Field label="Client">
          <select className={inputCls} value={clientId} onChange={(e) => { setClientId(e.target.value); setSelectedExtras([]); }}>
            <option value="">Select client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Period start"><input type="date" className={inputCls} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></Field>
          <Field label="Period end"><input type="date" className={inputCls} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></Field>
        </div>
        <Field label="Invoice number"><input className={inputCls} value={invoiceNum} onChange={(e) => setInvoiceNum(e.target.value)} /></Field>

        {client && (
          <div className="mt-2 border-t border-stone-100 pt-3">
            {occurrences.length === 0 ? <p className="text-xs text-stone-400 mb-2">No cleans fall in this period.</p> : (
              <div className="space-y-1 mb-2">
                {occurrences.map((o, i) => (
                  <div key={i} className="flex justify-between text-xs text-stone-500">
                    <span>{formatDate(o.date)} · {o.job.startTime} · {o.job.hours}hr clean</span><span>£{o.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            {client.blueLight && discountAmount > 0 && (
              <div className="flex justify-between text-xs font-semibold mb-2" style={{ color: NAVY }}>
                <span>Blue Light discount ({ratecard.blueLightPct}%)</span><span>−£{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {client.extras?.length > 0 && (
              <div className="mb-2 space-y-1">
                <div className="text-xs font-semibold text-stone-500">Include extras</div>
                {client.extras.map((e) => (
                  <label key={e.id} className="flex items-center justify-between text-xs bg-stone-50 rounded-lg px-2.5 py-1.5">
                    <span className="flex items-center gap-1.5"><input type="checkbox" checked={selectedExtras.includes(e.id)} onChange={() => toggleExtra(e.id)} />{e.label}{e.qty > 1 ? ` ×${e.qty}` : ""}</span>
                    <span>£{(e.unitPrice * e.qty).toFixed(2)}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-stone-800 border-t border-stone-100 pt-2">
              <span>Total</span><span>£{total.toFixed(2)}</span>
            </div>
            <Btn onClick={printInvoice} className="w-full mt-3" disabled={occurrences.length === 0 && extrasTotal === 0}>
              <FileText className="w-4 h-4" /> Preview &amp; print invoice
            </Btn>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Messages ----------
function Messages({ business, cleaners, clients }) {
  const [templateId, setTemplateId] = useState(MESSAGE_TEMPLATES[0].id);
  const template = MESSAGE_TEMPLATES.find((t) => t.id === templateId);
  const [values, setValues] = useState({});
  const [selectedCleaners, setSelectedCleaners] = useState([]);
  const [copied, setCopied] = useState(false);
  const placeholders = useMemo(() => { const matches = template.body.match(/{(\w+)}/g) || []; return [...new Set(matches.map((m) => m.slice(1, -1)))].filter((p) => p !== "business"); }, [template]);

  useEffect(() => {
    setValues((v) => { const next = { ...v }; placeholders.forEach((p) => { if (!(p in next)) next[p] = ""; }); return next; });
    setCopied(false);
  }, [templateId]); // eslint-disable-line

  const toggleCleaner = (id) => setSelectedCleaners((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const cleanerNames = joinNames(selectedCleaners.map((id) => cleaners.find((c) => c.id === id)?.name).filter(Boolean));

  const effectiveValues = { ...values, ...(placeholders.includes("cleaner") ? { cleaner: cleanerNames } : {}) };
  const filled = placeholders.reduce((text, p) => text.split(`{${p}}`).join(effectiveValues[p] || `[${p}]`), template.body.split("{business}").join(business.name));
  const copy = async () => { try { await navigator.clipboard.writeText(filled); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  const niceLabel = (p) => ({ client: "Client name", minutes: "Minutes late", time: "Time", oldDate: "Original date", newDate: "New date", startDate: "Holiday start date", endDate: "Holiday end date", affectedDate: "Affected clean date", date: "Date" }[p] || p);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {MESSAGE_TEMPLATES.map((t) => {
          const Icon = t.icon; const active = t.id === templateId;
          return (
            <button key={t.id} onClick={() => setTemplateId(t.id)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold border"
              style={active ? { background: NAVY, color: "white", borderColor: NAVY } : { background: "white", color: "#57534e", borderColor: "#e7e5e4" }}>
              <Icon className="w-3.5 h-3.5 shrink-0" /><span className="text-left">{t.label}</span>
            </button>
          );
        })}
      </div>
      <Card className="p-4">
        <h2 className="text-sm font-bold text-stone-800 mb-3">Fill in details</h2>
        {placeholders.includes("cleaner") && (
          <Field label="Cleaner(s) on this job">
            <div className="flex flex-wrap gap-1.5">
              {cleaners.map((c) => {
                const on = selectedCleaners.includes(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggleCleaner(c.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                    style={on ? { background: NAVY, color: "white", borderColor: NAVY } : { background: "white", color: "#57534e", borderColor: "#d6d3d1" }}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        {placeholders.filter((p) => p !== "cleaner").map((p) => (
          <Field key={p} label={niceLabel(p)}>
            {p === "client" ? (
              <select className={inputCls} value={values[p] || ""} onChange={(e) => setValues({ ...values, [p]: e.target.value })}>
                <option value="">Select client…</option>{clients.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            ) : (
              <input className={inputCls} value={values[p] || ""} onChange={(e) => setValues({ ...values, [p]: e.target.value })} />
            )}
          </Field>
        ))}
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-stone-800">Preview</h2>
          <Btn variant={copied ? "gold" : "primary"} onClick={copy}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? "Copied" : "Copy"}</Btn>
        </div>
        <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed bg-stone-50 rounded-lg p-3">{filled}</p>
      </Card>
    </div>
  );
}

// ---------- Modal ----------
function Modal({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-stone-800">{title}</h3>
          <button onClick={onClose} className="text-stone-400"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
