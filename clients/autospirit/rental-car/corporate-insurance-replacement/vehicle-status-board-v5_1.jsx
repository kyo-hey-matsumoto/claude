import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Search, RefreshCw, Car, Wrench, CheckCircle2, ArrowRight, Clock, CalendarPlus, CalendarDays, Trash2, Sparkles, PackageCheck, Pencil, AlertCircle } from "lucide-react";

const STATUS = {
  available: { label: "在庫あり", color: "#3F9142", bg: "#EAF4EA" },
  scheduled: { label: "配車予定", color: "#2C6E8F", bg: "#E3EEF3" },
  out: { label: "稼働中", color: "#D9662E", bg: "#FBEEE4" },
  pending_pickup: { label: "引取待ち", color: "#B5473A", bg: "#FBEAE8" },
  cleaning: { label: "清掃待ち", color: "#C79A2A", bg: "#FBF3DF" },
};
const STATUS_ORDER = ["available", "scheduled", "out", "pending_pickup", "cleaning"];

const MAINT_TYPES = {
  車検: { color: "#4A5A78", bg: "#EAEDF3", waitLabel: "車検提出待ち", inLabel: "車検中" },
  故障: { color: "#B23A2E", bg: "#F7E8E7", waitLabel: "故障提出待ち", inLabel: "故障修理中" },
  板金: { color: "#8A6D3B", bg: "#F5EFE3", waitLabel: "板金提出待ち", inLabel: "板金修理中" },
};
const TYPE_KEY = { 車検: "shaken", 故障: "kosho", 板金: "bankin" };
const MAINT_STATUS = {};
Object.entries(MAINT_TYPES).forEach(([type, cfg]) => {
  const key = TYPE_KEY[type];
  MAINT_STATUS[`${key}_wait`] = { label: cfg.waitLabel, color: cfg.color, bg: cfg.bg };
  MAINT_STATUS[`${key}_in`] = { label: cfg.inLabel, color: cfg.color, bg: cfg.bg };
});
const MAINT_STATUS_ORDER = Object.keys(MAINT_STATUS);
const ALL_STATUS = { ...STATUS, ...MAINT_STATUS };
const FILTER_ORDER = [...STATUS_ORDER, ...MAINT_STATUS_ORDER];

const CATEGORY = {
  対物: { color: "#5B3FBF", bg: "#EDEBFB" },
  自費: { color: "#BF3F86", bg: "#FBEBF3" },
  長期レンタル: { color: "#4A6741", bg: "#EDF2E9" },
};
const JIHI_FIXED_DAYS = 14;
const LOCATIONS = ["川和", "青葉", "新横浜"];
const LOCATION_STYLE = {
  川和: { color: "#3A5A78", bg: "#EAF0F6" },
  青葉: { color: "#2E7D4F", bg: "#EAF6EE" },
  新横浜: { color: "#7A4A2E", bg: "#F6EFE7" },
};
function contractLabel(category, contractDays) {
  if (category === "自費") return `仮抑え${JIHI_FIXED_DAYS}日間`;
  if (category === "長期レンタル") return "仮抑え期限なし(長期)";
  return `特約${contractDays}日`;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  return `${Math.floor(hr / 24)}日前`;
}
function formatDate(d) {
  if (!d) return "";
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}`;
}
function formatDateTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}
function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function formatDeparture(info) {
  if (!info) return "";
  return `${formatDate(info.date)} ${info.time ? info.time + "出発" : "出発時刻未定"}`;
}
function locationDisplay(v) {
  if (v.status === "out" && v.currentDispatch && v.currentDispatch.departureLocation) {
    return { label: "出発地", value: v.currentDispatch.departureLocation };
  }
  return { label: "拠点", value: v.location };
}
function effContractDays(category, contractDays) {
  if (category === "自費") return JIHI_FIXED_DAYS;
  if (category === "長期レンタル") return null; // 上限なし
  return contractDays;
}

const SEED = [
  { id: "v1", number: "6643", model: "ポロ", note: "e-レンタ", status: "out", location: "川和", transfer: null, specialStatus: null,
    currentDispatch: { date: todayStr(), time: "09:30", contractDays: 15, category: "対物", staff: "松", note: "", requester: "e-レンタ" },
    pickupSchedule: null, pickupCompletedAt: null, reservations: [], updatedAt: Date.now() - 3600e3, updatedBy: "松" },
  { id: "v2", number: "7767", model: "ミライース", note: "日産登戸", status: "out", location: "川和", transfer: null, specialStatus: null,
    currentDispatch: { date: addDays(todayStr(), -2), time: "", contractDays: JIHI_FIXED_DAYS, category: "自費", staff: "松", note: "", requester: "日産登戸" },
    pickupSchedule: null, pickupCompletedAt: null, reservations: [], updatedAt: Date.now() - 7200e3, updatedBy: "松" },
  { id: "v3", number: "4674", model: "シエンタ", note: "武蔵野", status: "available", location: "青葉", transfer: null, specialStatus: null, currentDispatch: null, pickupSchedule: null, pickupCompletedAt: null, reservations: [], updatedAt: Date.now() - 5400e3, updatedBy: "羽" },
  { id: "v4", number: "5962", model: "マーチ", note: "日野港北", status: "cleaning", location: "川和", transfer: null, specialStatus: null, currentDispatch: null, pickupSchedule: null, pickupCompletedAt: Date.now() - 1800e3, reservations: [], updatedAt: Date.now() - 1800e3, updatedBy: "志" },
  { id: "v5", number: "9963", model: "クラウンHV", note: "トヨタ大和", status: "available", location: "新横浜", transfer: null, specialStatus: null, currentDispatch: null, pickupSchedule: null, pickupCompletedAt: null, reservations: [], updatedAt: Date.now() - 9000e3, updatedBy: "高" },
];

function getViewStatus(v, selectedDate) {
  if (v.specialStatus) {
    const key = `${TYPE_KEY[v.specialStatus.type]}_${v.specialStatus.stage}`;
    return { status: key, projected: false, info: v.specialStatus };
  }
  const today = todayStr();
  if (selectedDate === today) {
    if (v.status === "out") {
      if (v.pickupSchedule && v.pickupSchedule.date <= today) return { status: "pending_pickup", projected: false };
      return { status: "out", projected: false, info: v.currentDispatch };
    }
    if (v.status === "cleaning") return { status: "cleaning", projected: false };
    const resv = (v.reservations || []).find((r) => r.date <= today);
    if (resv) return { status: "scheduled", projected: false, info: resv };
    return { status: "available", projected: false };
  }
  if (v.status === "out" && v.currentDispatch) {
    const days = effContractDays(v.currentDispatch.category, v.currentDispatch.contractDays);
    if (days == null) return { status: "out", projected: true, info: v.currentDispatch }; // 長期レンタル: 上限なく抑え続ける
    const cap = addDays(v.currentDispatch.date, days);
    return selectedDate <= cap ? { status: "out", projected: true, info: v.currentDispatch } : { status: "available", projected: true };
  }
  if (v.status === "cleaning") return { status: "available", projected: true };
  const covering = (v.reservations || []).find((r) => {
    const days = effContractDays(r.category, r.contractDays);
    if (days == null) return selectedDate >= r.date;
    return selectedDate >= r.date && selectedDate <= addDays(r.date, days - 1);
  });
  if (covering) return { status: selectedDate === covering.date ? "scheduled" : "out", projected: true, info: covering };
  return { status: "available", projected: true };
}
function nextReservation(v) {
  const t = todayStr();
  const upcoming = (v.reservations || []).filter((r) => r.date > t).sort((a, b) => (a.date < b.date ? -1 : 1));
  return upcoming[0] || null;
}

export default function VehicleStatusBoard() {
  const [activeTab, setActiveTab] = useState("board");
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showReserve, setShowReserve] = useState(false);
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [showEditDispatch, setShowEditDispatch] = useState(false);
  const [showPickupForm, setShowPickupForm] = useState(false);
  const [showEditPickup, setShowEditPickup] = useState(false);
  const [showPickupConfirm, setShowPickupConfirm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.storage.get("vehicles_v5", true);
      const raw = res && res.value ? JSON.parse(res.value) : SEED;
      setVehicles(raw.map((v) => ({ location: "川和", transfer: null, specialStatus: null, ...v })));
    } catch (e) { setVehicles(SEED); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const persist = async (next) => {
    setVehicles(next);
    try { await window.storage.set("vehicles_v5", JSON.stringify(next), true); } catch (e) { notify("保存に失敗しました"); }
  };
  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const refreshSelected = (next, id) => setSelected(next.find((v) => v.id === id) || null);

  const dispatchWith = (id, dispatchInfo, consumeReservationId) => {
    const target = vehicles.find((v) => v.id === id);
    const departureLocation = (target && target.location) || "川和";
    const next = vehicles.map((v) =>
      v.id === id ? { ...v, status: "out", currentDispatch: { ...dispatchInfo, departureLocation }, pickupSchedule: null, pickupCompletedAt: null, reservations: (v.reservations || []).filter((r) => r.id !== consumeReservationId), updatedAt: Date.now(), updatedBy: dispatchInfo.staff || v.updatedBy } : v
    );
    persist(next); refreshSelected(next, id); setShowDispatchForm(false);
    notify("配車完了にしました");
  };

  const updateCurrentDispatch = (id, data) => {
    const next = vehicles.map((v) => (v.id === id ? { ...v, currentDispatch: { ...v.currentDispatch, ...data }, updatedAt: Date.now(), updatedBy: data.staff || v.updatedBy } : v));
    persist(next); refreshSelected(next, id); setShowEditDispatch(false);
    notify("配車情報を更新しました");
  };

  const schedulePickup = (id, data) => {
    const next = vehicles.map((v) => (v.id === id ? { ...v, pickupSchedule: data, updatedAt: Date.now() } : v));
    persist(next); refreshSelected(next, id); setShowPickupForm(false); setShowEditPickup(false);
    notify(`引取予定 ${formatDate(data.date)} を登録しました(返却場所: ${data.returnLocation})`);
  };

  const completePickup = (id, returnLocation) => {
    const now = Date.now();
    const next = vehicles.map((v) => {
      if (v.id !== id) return v;
      const who = (v.pickupSchedule && v.pickupSchedule.staff) || v.updatedBy;
      return { ...v, status: "cleaning", location: returnLocation, currentDispatch: null, pickupSchedule: null, pickupCompletedAt: now, updatedAt: now, updatedBy: who };
    });
    persist(next); refreshSelected(next, id); setShowPickupConfirm(false);
    notify(`引取完了・清掃待ちにしました(返却場所: ${returnLocation})`);
  };

  const completeCleaning = (id) => {
    const next = vehicles.map((v) => (v.id === id ? { ...v, status: "available", pickupCompletedAt: null, updatedAt: Date.now() } : v));
    persist(next); refreshSelected(next, id);
    notify("清掃完了・在庫ありに戻しました");
  };

  const scheduleTransfer = (id, data) => {
    const target = vehicles.find((v) => v.id === id);
    const next = vehicles.map((v) => (v.id === id ? { ...v, transfer: { from: v.location, to: data.to, date: data.date, staff: data.staff, note: data.note, createdAt: Date.now() } } : v));
    persist(next); refreshSelected(next, id); setShowTransferForm(false);
    notify(`回送を登録しました(${(target && target.location) || ""}→${data.to})`);
  };

  const completeTransfer = (id) => {
    const target = vehicles.find((v) => v.id === id);
    if (!target || !target.transfer) return;
    const next = vehicles.map((v) => (v.id === id ? { ...v, location: v.transfer.to, transfer: null, updatedAt: Date.now(), updatedBy: v.transfer.staff || v.updatedBy } : v));
    persist(next); refreshSelected(next, id);
    notify(`回送完了・拠点を${target.transfer.to}に更新しました`);
  };

  const cancelTransfer = (id) => {
    const next = vehicles.map((v) => (v.id === id ? { ...v, transfer: null } : v));
    persist(next); refreshSelected(next, id);
    notify("回送予定を取り消しました");
  };

  const addVehicle = (data) => {
    const next = [{ id: "v" + Date.now(), status: "available", transfer: null, specialStatus: null, currentDispatch: null, pickupSchedule: null, pickupCompletedAt: null, reservations: [], updatedAt: Date.now(), updatedBy: "", ...data }, ...vehicles];
    persist(next); setShowAdd(false);
  };
  const addReservation = (id, data) => {
    const next = vehicles.map((v) => (v.id === id ? { ...v, reservations: [...(v.reservations || []), { id: "r" + Date.now(), ...data, createdAt: Date.now() }] } : v));
    persist(next); refreshSelected(next, id); setShowReserve(false);
    notify("予約を登録しました。未来の在庫が確保されます");
  };
  const removeReservation = (id, resId) => {
    const next = vehicles.map((v) => (v.id === id ? { ...v, reservations: (v.reservations || []).filter((r) => r.id !== resId) } : v));
    persist(next); refreshSelected(next, id);
    notify("予約を取り消しました");
  };

  const startMaintenance = (id, type) => {
    const next = vehicles.map((v) => (v.id === id ? { ...v, specialStatus: { type, stage: "wait", note: "", startedAt: Date.now() }, updatedAt: Date.now() } : v));
    persist(next); refreshSelected(next, id);
    notify(`${type}提出待ちにしました`);
  };
  const advanceMaintenance = (id) => {
    const target = vehicles.find((v) => v.id === id);
    const next = vehicles.map((v) => (v.id === id ? { ...v, specialStatus: { ...v.specialStatus, stage: "in" }, updatedAt: Date.now() } : v));
    persist(next); refreshSelected(next, id);
    notify(`${(target && target.specialStatus && target.specialStatus.type) || ""}中にしました`);
  };
  const completeMaintenance = (id) => {
    const next = vehicles.map((v) => (v.id === id ? { ...v, specialStatus: null, status: "available", currentDispatch: null, pickupSchedule: null, updatedAt: Date.now() } : v));
    persist(next); refreshSelected(next, id);
    notify("完了・在庫ありに戻しました");
  };
  const cancelMaintenance = (id) => {
    const next = vehicles.map((v) => (v.id === id ? { ...v, specialStatus: null } : v));
    persist(next); refreshSelected(next, id);
    notify("取り消しました");
  };

  const isToday = selectedDate === todayStr();
  const enriched = useMemo(() => vehicles.map((v) => ({ ...v, view: getViewStatus(v, selectedDate), next: nextReservation(v) })), [vehicles, selectedDate]);
  const filtered = enriched.filter((v) => {
    const matchesQuery = !query || v.number.includes(query) || (v.model || "").includes(query) || (v.note || "").includes(query);
    const matchesFilter = activeFilter === "all" || v.view.status === activeFilter;
    return matchesQuery && matchesFilter;
  });
  const counts = FILTER_ORDER.reduce((acc, s) => { acc[s] = enriched.filter((v) => v.view.status === s).length; return acc; }, {});
  const todaysReservation = selected ? (selected.reservations || []).find((r) => r.date <= todayStr()) : null;

  const selectTab = (tab) => {
    setActiveTab(tab);
    if (tab !== "board") { setSelectedDate(todayStr()); setActiveFilter("all"); }
  };

  const todayTasks = useMemo(() => {
    const t = todayStr();
    const tasks = [];
    vehicles.forEach((v) => {
      (v.reservations || []).forEach((r) => {
        if (r.date <= t) tasks.push({ id: `${v.id}-resv-${r.id}`, vehicleId: v.id, number: v.number, model: v.model, type: "配車", date: r.date, time: r.time, staff: r.staff, note: r.note, requester: r.requester, category: r.category });
      });
      if (v.status === "out" && v.pickupSchedule && v.pickupSchedule.date <= t) {
        tasks.push({ id: `${v.id}-pickup`, vehicleId: v.id, number: v.number, model: v.model, type: "引取", date: v.pickupSchedule.date, staff: v.pickupSchedule.staff, note: v.pickupSchedule.note, returnLocation: v.pickupSchedule.returnLocation });
      }
      if (v.transfer && v.transfer.date <= t) {
        tasks.push({ id: `${v.id}-transfer`, vehicleId: v.id, number: v.number, model: v.model, type: "回送", date: v.transfer.date, staff: v.transfer.staff, note: v.transfer.note, from: v.transfer.from, to: v.transfer.to });
      }
    });
    return tasks;
  }, [vehicles]);

  const tasksByStaff = useMemo(() => {
    const map = {};
    todayTasks.forEach((task) => {
      const names = task.staff ? task.staff.split(/[、,，\s]+/).map((s) => s.trim()).filter(Boolean) : [];
      const groupNames = names.length ? names : ["未アサイン"];
      groupNames.forEach((n) => { if (!map[n]) map[n] = []; map[n].push(task); });
    });
    return map;
  }, [todayTasks]);
  const staffNames = Object.keys(tasksByStaff).sort((a, b) => (a === "未アサイン" ? 1 : b === "未アサイン" ? -1 : a.localeCompare(b, "ja")));

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#EEF0F1", minHeight: "100vh" }}>
      <style>{`
        .plate { font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace; letter-spacing: 0.03em; }
        .tag-card { transition: transform 120ms ease; }
        .tag-card:active { transform: scale(0.98); }
      `}</style>

      <header style={{ background: "#1E2126", color: "#F4F4F2", padding: "18px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "#9BA3AE", textTransform: "uppercase", fontWeight: 600 }}>オートスピリット</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: "2px 0 0" }}>配車・在庫ボード</h1>
          </div>
          <button onClick={load} style={{ background: "#2C3038", border: "none", borderRadius: 10, padding: 10, color: "#F4F4F2" }} aria-label="更新"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
          {[["board", "在庫ボード"], ["tasks", "今日のタスク"], ["master", "車両マスタ"]].map(([key, label]) => (
            <button key={key} onClick={() => selectTab(key)} style={{ flex: 1, padding: "9px 6px", borderRadius: 10, border: "none", background: activeTab === key ? "#F4F4F2" : "#2C3038", color: activeTab === key ? "#1E2126" : "#9BA3AE", fontSize: 12, fontWeight: 700 }}>{label}</button>
          ))}
        </div>

        {activeTab === "board" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, background: "#2C3038", borderRadius: 10, padding: "8px 12px" }}>
              <CalendarDays size={16} color="#9BA3AE" />
              <input type="date" value={selectedDate} min={todayStr()} onChange={(e) => setSelectedDate(e.target.value)} style={{ background: "transparent", border: "none", color: "#F4F4F2", fontSize: 14, outline: "none", flex: 1 }} />
              {!isToday && <button onClick={() => setSelectedDate(todayStr())} style={{ fontSize: 12, color: "#9BA3AE", background: "none", border: "none", textDecoration: "underline" }}>今日に戻る</button>}
            </div>
            {!isToday && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 8, fontSize: 11, color: "#C9AE6B", lineHeight: 1.5 }}>
                <Sparkles size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>{formatDate(selectedDate)}の表示は予測です。稼働中の車両は対物:特約15/30日、自費:仮抑え14日間、長期レンタル:上限なし、として算出しています。実際の操作は「今日」表示で行ってください。</span>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto", paddingBottom: 2 }}>
              <button onClick={() => setActiveFilter("all")} style={{ flex: "0 0 auto", padding: "8px 14px", borderRadius: 999, border: "1px solid #3A3F47", background: activeFilter === "all" ? "#F4F4F2" : "transparent", color: activeFilter === "all" ? "#1E2126" : "#F4F4F2", fontSize: 13, fontWeight: 700 }}>すべて {vehicles.length}</button>
              {FILTER_ORDER.map((s) => (
                <button key={s} onClick={() => setActiveFilter(s)} style={{ flex: "0 0 auto", padding: "8px 14px", borderRadius: 999, border: `1px solid ${ALL_STATUS[s].color}`, background: activeFilter === s ? ALL_STATUS[s].color : "transparent", color: activeFilter === s ? "#fff" : ALL_STATUS[s].color, fontSize: 13, fontWeight: 700 }}>{ALL_STATUS[s].label} {counts[s]}</button>
              ))}
            </div>
          </>
        )}
        {activeTab === "master" && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#9BA3AE", lineHeight: 1.6 }}>車両を選んで車検・故障・板金のステータスを変更できます</div>
        )}
      </header>

      {activeTab !== "tasks" && (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", background: "#fff", borderRadius: 10, padding: "8px 12px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
            <Search size={16} color="#8A8F98" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="車両番号・車種・依頼元で検索" style={{ border: "none", outline: "none", marginLeft: 8, fontSize: 14, flex: 1, background: "transparent" }} />
          </div>
        </div>
      )}
      <main style={{ padding: "12px 16px 100px" }}>
        {activeTab === "tasks" ? null : loading ? (
          <div style={{ textAlign: "center", color: "#8A8F98", padding: 40, fontSize: 13 }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "#8A8F98", padding: 40, fontSize: 13 }}>該当する車両がありません</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {filtered.slice().sort((a, b) => b.updatedAt - a.updatedAt).map((v) => {
              const cat = v.view.info && v.view.info.category;
              return (
                <button key={v.id} onClick={() => setSelected(v)} className="tag-card" style={{ textAlign: "left", background: "#fff", border: v.view.projected ? "1px dashed #C9AE6B" : "1px solid #E3E5E8", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                  <div style={{ width: 6, alignSelf: "stretch", borderRadius: 4, background: ALL_STATUS[v.view.status].color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span className="plate" style={{ fontSize: 18, fontWeight: 800, color: "#1E2126" }}>{v.number}</span>
                      <span style={{ fontSize: 13, color: "#5A616B" }}>{v.model}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#8A8F98", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.note || "—"}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                      {(() => { const loc = locationDisplay(v); return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: LOCATION_STYLE[loc.value].bg, color: LOCATION_STYLE[loc.value].color }}>{loc.label}:{loc.value}</span>; })()}
                      {v.transfer && <span style={{ fontSize: 11, color: "#8A5A2E" }}>回送予定: {v.transfer.from}→{v.transfer.to}({formatDate(v.transfer.date)})</span>}
                    </div>
                    {(v.view.status === "out" || v.view.status === "scheduled") && v.view.info && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                        {cat && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: CATEGORY[cat].bg, color: CATEGORY[cat].color }}>{cat}</span>}
                        <span style={{ fontSize: 11, color: "#5A616B" }}>{formatDeparture(v.view.info)}</span>
                      </div>
                    )}
                    {isToday && v.pickupSchedule && v.status === "out" && (
                      <div style={{ fontSize: 11, color: "#B5473A", marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}><PackageCheck size={11} /> 引取予定: {formatDate(v.pickupSchedule.date)}{v.pickupSchedule.staff ? `・${v.pickupSchedule.staff}` : ""}</div>
                    )}
                    {v.status === "cleaning" && v.pickupCompletedAt && (
                      <div style={{ fontSize: 11, color: "#C79A2A", marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}><Clock size={11} /> 引取完了: {formatDateTime(v.pickupCompletedAt)}</div>
                    )}
                    {v.next && (
                      <div style={{ fontSize: 11, color: "#2C6E8F", marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}><CalendarDays size={11} /> 次の予約: {formatDeparture(v.next)}</div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: ALL_STATUS[v.view.status].bg, color: ALL_STATUS[v.view.status].color }}>{ALL_STATUS[v.view.status].label}{v.view.projected ? "(予測)" : ""}</span>
                    {!v.view.projected && <div style={{ fontSize: 10, color: "#B0B5BB", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}><Clock size={10} /> {timeAgo(v.updatedAt)}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {activeTab === "tasks" && (
          staffNames.length === 0 ? (
            <div style={{ textAlign: "center", color: "#8A8F98", padding: 40, fontSize: 13 }}>今日のタスクはありません</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
              {staffNames.map((name) => (
                <div key={name}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1E2126", marginBottom: 8 }}>{name} <span style={{ color: "#B0B5BB", fontWeight: 700 }}>({tasksByStaff[name].length})</span></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {tasksByStaff[name].map((task) => {
                      const iconColor = task.type === "配車" ? STATUS.out.color : task.type === "引取" ? STATUS.pending_pickup.color : "#3A5A78";
                      const Icon = task.type === "配車" ? Car : task.type === "引取" ? Wrench : ArrowRight;
                      return (
                        <button key={task.id} onClick={() => { const v = vehicles.find((x) => x.id === task.vehicleId); if (v) setSelected(v); }} style={{ textAlign: "left", background: "#fff", border: "1px solid #E3E5E8", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${iconColor}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={15} color={iconColor} /></div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: iconColor }}>{task.type}</span>
                              <span className="plate" style={{ fontSize: 14, fontWeight: 800, color: "#1E2126" }}>{task.number}</span>
                              <span style={{ fontSize: 12, color: "#5A616B" }}>{task.model}</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#8A8F98", marginTop: 2 }}>
                              {task.type === "配車" && `${task.time ? task.time + "出発" : "出発時刻未定"}${task.requester ? `・${task.requester}` : ""}`}
                              {task.type === "引取" && `返却場所: ${task.returnLocation || "未設定"}`}
                              {task.type === "回送" && `${task.from}→${task.to}`}
                              {task.note ? `・${task.note}` : ""}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>

      <button onClick={() => setShowAdd(true)} style={{ position: "fixed", right: 18, bottom: 18, width: 54, height: 54, borderRadius: 27, background: "#1E2126", color: "#fff", border: "none", boxShadow: "0 6px 16px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="車両を追加"><Plus size={24} /></button>

      {toast && <div style={{ position: "fixed", bottom: 84, left: "50%", transform: "translateX(-50%)", background: "#1E2126", color: "#fff", padding: "8px 16px", borderRadius: 999, fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>{toast}</div>}

      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,21,24,0.5)", display: "flex", alignItems: "flex-end", zIndex: 40 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", borderRadius: "18px 18px 0 0", padding: "20px 18px 28px", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="plate" style={{ fontSize: 24, fontWeight: 800, color: "#1E2126" }}>{selected.number}</div>
                <div style={{ fontSize: 13, color: "#5A616B", marginTop: 2 }}>{selected.model} ・ {selected.note || "—"}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "#F0F1F2", border: "none", borderRadius: 8, padding: 6 }}><X size={18} /></button>
            </div>

            {(() => {
              const vs = getViewStatus(selected, todayStr());
              return <div style={{ marginTop: 6, fontSize: 12, color: "#B0B5BB" }}>現在(今日): <span style={{ color: ALL_STATUS[vs.status].color, fontWeight: 700 }}>{ALL_STATUS[vs.status].label}</span>{" "}・ 最終更新 {timeAgo(selected.updatedAt)}{selected.updatedBy ? ` (${selected.updatedBy})` : ""}</div>;
            })()}

            {selected.status === "out" && selected.currentDispatch && (
              <div style={{ marginTop: 14, background: "#FBEEE4", borderRadius: 10, padding: 12, fontSize: 12, color: "#5A3A1E", lineHeight: 1.7, position: "relative" }}>
                <button onClick={() => setShowEditDispatch(true)} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: "#8A5A2E", display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700 }}><Pencil size={12} /> 編集</button>
                <div><span style={{ fontWeight: 700, padding: "1px 8px", borderRadius: 999, background: CATEGORY[selected.currentDispatch.category].bg, color: CATEGORY[selected.currentDispatch.category].color, marginRight: 6 }}>{selected.currentDispatch.category}</span>{contractLabel(selected.currentDispatch.category, selected.currentDispatch.contractDays)} ・ {formatDeparture(selected.currentDispatch)}</div>
                {selected.currentDispatch.staff && <div>担当: {selected.currentDispatch.staff}</div>}
                {selected.currentDispatch.requester && <div>依頼元: {selected.currentDispatch.requester}</div>}
                {selected.currentDispatch.note && <div>メモ: {selected.currentDispatch.note}</div>}
              </div>
            )}

            {isToday && selected.status === "out" && selected.pickupSchedule && (
              <div style={{ marginTop: 10, background: "#FBEAE8", borderRadius: 10, padding: 12, fontSize: 12, color: "#7A2E24", lineHeight: 1.7, position: "relative" }}>
                <button onClick={() => setShowEditPickup(true)} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: "#B5473A", display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700 }}><Pencil size={12} /> 編集</button>
                <div style={{ fontWeight: 700 }}>引取予定: {formatDate(selected.pickupSchedule.date)}</div>
                {selected.pickupSchedule.staff && <div>担当: {selected.pickupSchedule.staff}</div>}
                {selected.pickupSchedule.note && <div>メモ: {selected.pickupSchedule.note}</div>}
              </div>
            )}

            {selected.status === "cleaning" && selected.pickupCompletedAt && (
              <div style={{ marginTop: 14, background: "#FBF3DF", borderRadius: 10, padding: 12, fontSize: 12, color: "#5A4A1E" }}>
                引取完了日時: {formatDateTime(selected.pickupCompletedAt)}
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1E2126" }}>{locationDisplay(selected).label}</div>
                {isToday && selected.status === "available" && !selected.transfer && (
                  <button onClick={() => setShowTransferForm(true)} style={{ fontSize: 12, fontWeight: 700, color: "#3A5A78", background: "none", border: "none" }}>回送を入力</button>
                )}
              </div>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: LOCATION_STYLE[locationDisplay(selected).value].bg, color: LOCATION_STYLE[locationDisplay(selected).value].color }}>{locationDisplay(selected).value}</span>
              </div>
              {selected.status === "available" && selected.transfer && (
                <div style={{ marginTop: 8, background: "#F6F1E9", borderRadius: 10, padding: 12, fontSize: 12, color: "#5A4A2E", lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 700 }}>回送予定: {selected.transfer.from} → {selected.transfer.to}({formatDate(selected.transfer.date)})</div>
                  {selected.transfer.staff && <div>担当: {selected.transfer.staff}</div>}
                  {selected.transfer.note && <div>メモ: {selected.transfer.note}</div>}
                  {isToday && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => completeTransfer(selected.id)} style={{ ...actionBtnStyle("#3A5A78"), flex: 1, justifyContent: "center", padding: "8px 10px", fontSize: 13 }}>回送完了</button>
                      <button onClick={() => cancelTransfer(selected.id)} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #E3E5E8", background: "#fff", color: "#8A8F98", fontSize: 13, fontWeight: 700 }}>取消</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1E2126" }}>今後の予約</div>
                <button onClick={() => setShowReserve(true)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#2C6E8F", background: "none", border: "none" }}><CalendarPlus size={14} /> 予約を追加</button>
              </div>
              {(selected.reservations || []).length === 0 ? (
                <div style={{ fontSize: 12, color: "#B0B5BB", marginTop: 8 }}>予約はありません</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {selected.reservations.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map((r) => (
                    <div key={r.id} style={{ background: "#F6F7F8", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 12, color: "#3A3F47", lineHeight: 1.6 }}>
                          <span style={{ fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: CATEGORY[r.category].bg, color: CATEGORY[r.category].color, marginRight: 4 }}>{r.category}</span>
                          {contractLabel(r.category, r.contractDays)} ・ {formatDeparture(r)}
                          {r.requester ? <><br />依頼元: {r.requester}</> : null}
                          {r.staff ? <><br />担当: {r.staff}</> : null}
                          {r.note ? <><br />メモ: {r.note}</> : null}
                        </div>
                        <button onClick={() => removeReservation(selected.id, r.id)} style={{ background: "none", border: "none", color: "#B0B5BB", flexShrink: 0 }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1E2126", marginBottom: 8 }}>車検・故障・板金</div>
              {!selected.specialStatus ? (
                isToday && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {Object.keys(MAINT_TYPES).map((type) => (
                      <button key={type} onClick={() => startMaintenance(selected.id, type)} style={{ flex: 1, padding: "10px 6px", borderRadius: 10, border: `1px solid ${MAINT_TYPES[type].color}`, background: "transparent", color: MAINT_TYPES[type].color, fontSize: 13, fontWeight: 700 }}>{type}</button>
                    ))}
                  </div>
                )
              ) : (
                <div style={{ background: MAINT_TYPES[selected.specialStatus.type].bg, borderRadius: 10, padding: 12, fontSize: 12, color: MAINT_TYPES[selected.specialStatus.type].color, lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 700 }}>{ALL_STATUS[`${TYPE_KEY[selected.specialStatus.type]}_${selected.specialStatus.stage}`].label}</div>
                  {isToday && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      {selected.specialStatus.stage === "wait" && (
                        <button onClick={() => advanceMaintenance(selected.id)} style={{ ...actionBtnStyle(MAINT_TYPES[selected.specialStatus.type].color), flex: 1, justifyContent: "center", padding: "8px 10px", fontSize: 13 }}>{selected.specialStatus.type}中にする</button>
                      )}
                      <button onClick={() => completeMaintenance(selected.id)} style={{ ...actionBtnStyle("#3F9142"), flex: 1, justifyContent: "center", padding: "8px 10px", fontSize: 13 }}>完了・在庫に戻す</button>
                      <button onClick={() => cancelMaintenance(selected.id)} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #E3E5E8", background: "#fff", color: "#8A8F98", fontSize: 13, fontWeight: 700 }}>取消</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isToday ? (
              <div style={{ marginTop: 18, fontSize: 12, color: "#B0B5BB", background: "#F6F7F8", borderRadius: 10, padding: 12 }}>操作は「今日」表示のときのみ行えます。</div>
            ) : selected.specialStatus ? null : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
                {selected.status === "available" && (
                  <button onClick={() => setShowDispatchForm(true)} style={actionBtnStyle(STATUS.out.color)}><Car size={18} /> 配車完了にする <ArrowRight size={14} style={{ marginLeft: "auto" }} /></button>
                )}
                {selected.status === "out" && (
                  <>
                    {!selected.pickupSchedule && (
                      <button onClick={() => setShowPickupForm(true)} style={{ ...actionBtnStyle("#B5473A"), opacity: 0.9 }}><PackageCheck size={18} /> 引取連絡を登録</button>
                    )}
                    <button onClick={() => setShowPickupConfirm(true)} style={actionBtnStyle(STATUS.pending_pickup.color)}><Wrench size={18} /> 引取完了にする(清掃待ちへ) <ArrowRight size={14} style={{ marginLeft: "auto" }} /></button>
                  </>
                )}
                {selected.status === "cleaning" && (
                  <button onClick={() => completeCleaning(selected.id)} style={actionBtnStyle(STATUS.available.color)}><CheckCircle2 size={18} /> 清掃完了・在庫に戻す <ArrowRight size={14} style={{ marginLeft: "auto" }} /></button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showAdd && <AddVehicleModal onClose={() => setShowAdd(false)} onSave={addVehicle} />}
      {showReserve && selected && <DispatchInfoModal title="予約を登録" submitLabel="この予約を確定する" onClose={() => setShowReserve(false)} onSave={(data) => addReservation(selected.id, data)} />}
      {showDispatchForm && selected && (
        <DispatchInfoModal title="配車情報を入力" submitLabel="配車完了にする" initial={todaysReservation || { date: todayStr() }} onClose={() => setShowDispatchForm(false)} onSave={(data) => dispatchWith(selected.id, data, todaysReservation ? todaysReservation.id : undefined)} />
      )}
      {showEditDispatch && selected && selected.currentDispatch && (
        <DispatchInfoModal title="配車情報を編集" submitLabel="保存する" initial={selected.currentDispatch} allowPastDate onClose={() => setShowEditDispatch(false)} onSave={(data) => updateCurrentDispatch(selected.id, data)} />
      )}
      {showPickupForm && selected && <PickupInfoModal title="引取連絡を登録" submitLabel="登録する" defaultReturnLocation={selected.currentDispatch && selected.currentDispatch.departureLocation} onClose={() => setShowPickupForm(false)} onSave={(data) => schedulePickup(selected.id, data)} />}
      {showEditPickup && selected && selected.pickupSchedule && (
        <PickupInfoModal title="引取連絡を編集" submitLabel="保存する" initial={selected.pickupSchedule} onClose={() => setShowEditPickup(false)} onSave={(data) => schedulePickup(selected.id, data)} />
      )}
      {showPickupConfirm && selected && (
        <PickupCompleteModal
          defaultLocation={(selected.pickupSchedule && selected.pickupSchedule.returnLocation) || (selected.currentDispatch && selected.currentDispatch.departureLocation) || selected.location}
          onCancel={() => setShowPickupConfirm(false)}
          onConfirm={(loc) => completePickup(selected.id, loc)}
        />
      )}
      {showTransferForm && selected && (
        <TransferModal currentLocation={selected.location} onClose={() => setShowTransferForm(false)} onSave={(data) => scheduleTransfer(selected.id, data)} />
      )}

    </div>
  );
}

function actionBtnStyle(color) { return { display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 12, border: "none", background: color, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }; }

function AddVehicleModal({ onClose, onSave }) {
  const [number, setNumber] = useState(""); const [model, setModel] = useState(""); const [note, setNote] = useState(""); const [location, setLocation] = useState("川和");
  const submit = () => { if (!number.trim()) return; onSave({ number: number.trim(), model: model.trim(), note: note.trim(), location }); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,21,24,0.5)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", borderRadius: "18px 18px 0 0", padding: "20px 18px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>車両を追加</h2><button onClick={onClose} style={{ background: "#F0F1F2", border: "none", borderRadius: 8, padding: 6 }}><X size={18} /></button></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input placeholder="車両番号 (例: 6643)" value={number} onChange={(e) => setNumber(e.target.value)} style={inputStyle} />
          <input placeholder="車種 (例: ポロ)" value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle} />
          <div>
            <label style={labelStyle}>基本拠点</label>
            <div style={{ display: "flex", gap: 6 }}>
              {LOCATIONS.map((l) => (<button key={l} onClick={() => setLocation(l)} style={{ ...pillStyle(location === l, LOCATION_STYLE[l].color), fontSize: 13 }}>{l}</button>))}
            </div>
          </div>
          <input placeholder="メモ" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
          <button onClick={submit} style={{ ...actionBtnStyle("#1E2126"), justifyContent: "center", marginTop: 6 }}>追加する</button>
        </div>
      </div>
    </div>
  );
}

function TransferModal({ currentLocation, onClose, onSave }) {
  const others = LOCATIONS.filter((l) => l !== currentLocation);
  const [to, setTo] = useState(others[0]);
  const [date, setDate] = useState(todayStr());
  const [staff, setStaff] = useState("");
  const [note, setNote] = useState("");
  const submit = () => { if (!to || !date) return; onSave({ to, date, staff: staff.trim(), note: note.trim() }); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,21,24,0.5)", display: "flex", alignItems: "flex-end", zIndex: 60 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", borderRadius: "18px 18px 0 0", padding: "20px 18px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>回送を入力</h2><button onClick={onClose} style={{ background: "#F0F1F2", border: "none", borderRadius: 8, padding: 6 }}><X size={18} /></button></div>
        <div style={{ fontSize: 12, color: "#8A8F98", marginBottom: 10 }}>現在の拠点: <span style={{ fontWeight: 700 }}>{currentLocation}</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={labelStyle}>移動先</label>
            <div style={{ display: "flex", gap: 6 }}>
              {others.map((l) => (<button key={l} onClick={() => setTo(l)} style={{ ...pillStyle(to === l, LOCATION_STYLE[l].color), fontSize: 13 }}>{l}</button>))}
            </div>
          </div>
          <div><label style={labelStyle}>回送予定日</label><input type="date" value={date} min={todayStr()} onChange={(e) => setDate(e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>担当者(複数可)</label><input placeholder="例: 松、羽" value={staff} onChange={(e) => setStaff(e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>メモ</label><input placeholder="例: 個人予約対応のため" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} /></div>
          <button onClick={submit} style={{ ...actionBtnStyle("#3A5A78"), justifyContent: "center", marginTop: 6 }}>回送を登録する</button>
        </div>
      </div>
    </div>
  );
}

function DispatchInfoModal({ title, submitLabel, initial = {}, allowPastDate, onClose, onSave }) {
  const [date, setDate] = useState(initial.date || todayStr());
  const [time, setTime] = useState(initial.time || "");
  const [category, setCategory] = useState(initial.category || "対物");
  const [contractDays, setContractDays] = useState(initial.category === "対物" ? (initial.contractDays || 15) : 15);
  const [staff, setStaff] = useState(initial.staff || "");
  const [requester, setRequester] = useState(initial.requester || "");
  const [note, setNote] = useState(initial.note || "");

  const submit = () => {
    if (!date) return;
    const finalDays = category === "対物" ? contractDays : category === "自費" ? JIHI_FIXED_DAYS : null;
    onSave({ date, time: time || "", category, contractDays: finalDays, staff: staff.trim(), requester: requester.trim(), note: note.trim() });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,21,24,0.5)", display: "flex", alignItems: "flex-end", zIndex: 60 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", borderRadius: "18px 18px 0 0", padding: "20px 18px 28px", maxHeight: "88vh", overflowY: "auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{title}</h2><button onClick={onClose} style={{ background: "#F0F1F2", border: "none", borderRadius: 8, padding: 6 }}><X size={18} /></button></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div><label style={labelStyle}>配車予定日</label><input type="date" value={date} min={allowPastDate ? undefined : todayStr()} onChange={(e) => setDate(e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>出発時刻(任意)</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} /></div>
          </div>
          {!time && <div style={{ fontSize: 11, color: "#B0B5BB", marginTop: -4 }}>空欄の場合「出発時刻未定」として登録されます</div>}

          <div>
            <label style={labelStyle}>区分</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["対物", "自費", "長期レンタル"].map((c) => (
                <button key={c} onClick={() => setCategory(c)} style={{ ...pillStyle(category === c, CATEGORY[c].color), flex: "1 1 30%", fontSize: 12, padding: "10px 6px" }}>{c}</button>
              ))}
            </div>
          </div>

          {category === "対物" && (
            <div>
              <label style={labelStyle}>特約</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[15, 30].map((d) => (<button key={d} onClick={() => setContractDays(d)} style={pillStyle(contractDays === d, "#2C6E8F")}>{d}日特約</button>))}
              </div>
            </div>
          )}
          {category === "自費" && (
            <div style={{ fontSize: 12, color: "#8A8F98", background: "#F6F7F8", borderRadius: 8, padding: "8px 10px" }}>自費のため特約はありません。仮抑えは{JIHI_FIXED_DAYS}日間で計算されます</div>
          )}
          {category === "長期レンタル" && (
            <div style={{ fontSize: 12, color: "#8A8F98", background: "#F6F7F8", borderRadius: 8, padding: "8px 10px" }}>長期レンタルのため、返却まで期限を設けず先の在庫をすべて抑えます</div>
          )}

          <div><label style={labelStyle}>担当者(複数可)</label><input placeholder="例: 松、羽" value={staff} onChange={(e) => setStaff(e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>依頼元</label><input placeholder="例: BMW江東" value={requester} onChange={(e) => setRequester(e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>メモ</label><input value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} /></div>
          <button onClick={submit} style={{ ...actionBtnStyle("#2C6E8F"), justifyContent: "center", marginTop: 6 }}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}

function PickupInfoModal({ title, submitLabel, initial = {}, defaultReturnLocation, onClose, onSave }) {
  const [date, setDate] = useState(initial.date || todayStr());
  const [returnLocation, setReturnLocation] = useState(initial.returnLocation || defaultReturnLocation || LOCATIONS[0]);
  const [staff, setStaff] = useState(initial.staff || "");
  const [note, setNote] = useState(initial.note || "");
  const submit = () => { if (!date || !returnLocation) return; onSave({ date, returnLocation, staff: staff.trim(), note: note.trim() }); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,21,24,0.5)", display: "flex", alignItems: "flex-end", zIndex: 60 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", borderRadius: "18px 18px 0 0", padding: "20px 18px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{title}</h2><button onClick={onClose} style={{ background: "#F0F1F2", border: "none", borderRadius: 8, padding: 6 }}><X size={18} /></button></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div><label style={labelStyle}>引取予定日</label><input type="date" value={date} min={todayStr()} onChange={(e) => setDate(e.target.value)} style={inputStyle} /></div>
          <div>
            <label style={labelStyle}>返却場所</label>
            <div style={{ display: "flex", gap: 6 }}>
              {LOCATIONS.map((l) => (<button key={l} onClick={() => setReturnLocation(l)} style={{ ...pillStyle(returnLocation === l, LOCATION_STYLE[l].color), fontSize: 13 }}>{l}</button>))}
            </div>
          </div>
          <div><label style={labelStyle}>担当者(複数可)</label><input placeholder="例: 志、高" value={staff} onChange={(e) => setStaff(e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>メモ</label><input value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} /></div>
          <button onClick={submit} style={{ ...actionBtnStyle("#B5473A"), justifyContent: "center", marginTop: 6 }}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}

function PickupCompleteModal({ defaultLocation, onCancel, onConfirm }) {
  const [loc, setLoc] = useState(defaultLocation || LOCATIONS[0]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,21,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 24 }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 22, maxWidth: 340, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><AlertCircle size={22} color="#B5473A" /></div>
        <div style={{ fontSize: 14, color: "#1E2126", textAlign: "center", lineHeight: 1.6, marginBottom: 14 }}>現在時刻({nowTimeStr()})で引取完了とします。</div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ ...labelStyle, textAlign: "center", display: "block" }}>返却場所</label>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {LOCATIONS.map((l) => (<button key={l} onClick={() => setLoc(l)} style={{ ...pillStyle(loc === l, LOCATION_STYLE[l].color), fontSize: 13 }}>{l}</button>))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #E3E5E8", background: "#fff", color: "#5A616B", fontSize: 14, fontWeight: 700 }}>キャンセル</button>
          <button onClick={() => onConfirm(loc)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#B5473A", color: "#fff", fontSize: 14, fontWeight: 700 }}>引取完了にする</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ icon, message, confirmLabel, confirmColor, onCancel, onConfirm }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,21,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 24 }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 22, maxWidth: 320, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>{icon}</div>
        <div style={{ fontSize: 14, color: "#1E2126", textAlign: "center", lineHeight: 1.6, marginBottom: 18 }}>{message}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #E3E5E8", background: "#fff", color: "#5A616B", fontSize: 14, fontWeight: 700 }}>キャンセル</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: confirmColor, color: "#fff", fontSize: 14, fontWeight: 700 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function pillStyle(active, color) { return { flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${color}`, background: active ? color : "transparent", color: active ? "#fff" : color, fontSize: 13, fontWeight: 700 }; }
const labelStyle = { fontSize: 11, color: "#8A8F98", fontWeight: 700, display: "block", marginBottom: 4 };
const inputStyle = { border: "1px solid #E3E5E8", borderRadius: 10, padding: "12px 14px", fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box" };
