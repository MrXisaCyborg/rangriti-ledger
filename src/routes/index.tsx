import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { supabase, type Order } from "@/lib/supabase";
import { PinGate, getStoredPin, setStoredPin, lockSession } from "@/components/PinGate";

export const Route = createFileRoute("/")({
  component: () => (
    <PinGate>
      <Ledger />
    </PinGate>
  ),
});

type Filter = "all" | "pending" | "fulfilled" | "cash";

const PAYMENT_METHODS = ["Cash", "UPI", "Bank Transfer", "Card", "Other"];

function fmtDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
function inr(n: number) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function Ledger() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showRecap, setShowRecap] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("isArchived", false)
      .order("createdAt", { ascending: false });
    if (!error && data) setOrders(data as Order[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filter === "pending") return o.status === "pending";
      if (filter === "fulfilled") return o.status === "fulfilled";
      if (filter === "cash")
        return o.status === "pending" && o.paymentMethod?.toLowerCase() === "cash";
      return true;
    });
  }, [orders, filter]);

  const totals = useMemo(() => {
    let revenue = 0, profit = 0, pendingAmt = 0, cashToReceive = 0;
    for (const o of orders) {
      if (o.status === "fulfilled") {
        revenue += Number(o.sellingPrice) - Number(o.discount || 0);
        profit += Number(o.profit);
      } else {
        pendingAmt += Number(o.sellingPrice) - Number(o.discount || 0);
        if (o.paymentMethod?.toLowerCase() === "cash") {
          cashToReceive += Number(o.sellingPrice) - Number(o.discount || 0);
        }
      }
    }
    return { revenue, profit, pendingAmt, cashToReceive };
  }, [orders]);

  const toggleStatus = async (o: Order) => {
    const next = o.status === "fulfilled" ? "pending" : "fulfilled";
    await supabase.from("orders").update({ status: next }).eq("id", o.id);
    load();
  };
  const removeOrder = async (id: string) => {
    if (!confirm("Delete this order? This cannot be undone.")) return;
    await supabase.from("orders").delete().eq("id", id);
    load();
  };

  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto">
      <Header
        onAdd={() => setShowForm(true)}
        onPin={() => setShowPin(true)}
        onRecap={() => setShowRecap(true)}
      />

      <Stats totals={totals} />

      <Filters filter={filter} setFilter={setFilter} counts={{
        all: orders.length,
        pending: orders.filter(o => o.status === "pending").length,
        fulfilled: orders.filter(o => o.status === "fulfilled").length,
        cash: orders.filter(o => o.status === "pending" && o.paymentMethod?.toLowerCase() === "cash").length,
      }} />

      {loading ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">Loading orders…</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          No orders here yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} onToggle={() => toggleStatus(o)} onDelete={() => removeOrder(o.id)} />
          ))}
        </div>
      )}

      {showForm && <OrderForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {showPin && <PinModal onClose={() => setShowPin(false)} />}
      {showRecap && <RecapModal orders={orders} onClose={() => setShowRecap(false)} />}
    </div>
  );
}

function Header({ onAdd, onPin, onRecap }: { onAdd: () => void; onPin: () => void; onRecap: () => void; }) {
  return (
    <header className="mb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-1">Ledger</div>
          <h1 className="font-display text-3xl md:text-5xl text-foreground">Rangriti Creations</h1>
        </div>
        <button
          onClick={lockSession}
          aria-label="Lock"
          className="glass w-11 h-11 rounded-full grid place-items-center text-base hover:bg-white/10 transition"
          title="Lock"
        >🔒</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={onAdd} className="flex-1 min-w-[180px] px-5 py-3.5 rounded-2xl bg-primary text-primary-foreground text-base font-semibold hover:opacity-90 transition shadow-lg shadow-primary/10">
          + New Order
        </button>
        <button onClick={onRecap} className="glass px-5 py-3.5 rounded-2xl text-sm font-medium hover:bg-white/10 transition">
          Monthly Recap
        </button>
        <button onClick={onPin} className="glass px-5 py-3.5 rounded-2xl text-sm font-medium hover:bg-white/10 transition">
          Change PIN
        </button>
      </div>
    </header>
  );
}

function Stats({ totals }: { totals: { revenue: number; profit: number; pendingAmt: number; cashToReceive: number; } }) {
  const cards = [
    { label: "Revenue", value: inr(totals.revenue), hint: "Fulfilled only" },
    { label: "Profit", value: inr(totals.profit), hint: "Fulfilled only" },
    { label: "Pending", value: inr(totals.pendingAmt), hint: "Awaiting" },
    { label: "Cash to Receive", value: inr(totals.cashToReceive), hint: "Pending • cash", highlight: true },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className={`${c.highlight ? "glass-receivable" : "glass"} rounded-2xl p-4 md:p-5`}>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.label}</div>
          <div className={`font-display text-2xl md:text-3xl mt-1 ${c.highlight ? "text-[var(--receivable)]" : ""}`}>{c.value}</div>
          <div className="text-xs text-muted-foreground mt-1">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}

function Filters({ filter, setFilter, counts }: { filter: Filter; setFilter: (f: Filter) => void; counts: Record<Filter, number>; }) {
  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "fulfilled", label: "Fulfilled" },
    { id: "cash", label: "Cash" },
  ];
  return (
    <div className="glass rounded-2xl p-1.5 mb-5 flex gap-1 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setFilter(t.id)}
          className={`flex-1 min-w-fit px-4 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
            filter === t.id ? "bg-primary text-primary-foreground shadow" : "hover:bg-white/5 text-foreground"
          }`}
        >
          {t.label} <span className={`ml-1 text-xs ${filter === t.id ? "opacity-80" : "text-muted-foreground"}`}>{counts[t.id]}</span>
        </button>
      ))}
    </div>
  );
}

function OrderCard({ order, onToggle, onDelete }: { order: Order; onToggle: () => void; onDelete: () => void; }) {
  const sell = Number(order.sellingPrice) - Number(order.discount || 0);
  const pending = order.status !== "fulfilled";
  const isReceivable = pending && order.paymentMethod?.toLowerCase() === "cash";
  return (
    <div className={`${isReceivable ? "glass-receivable" : "glass"} rounded-2xl p-5 flex flex-col gap-3 group relative`}>
      {isReceivable && (
        <div className="absolute -top-2 -right-2 text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full bg-[var(--receivable)] text-[oklch(0.2_0.03_20)] shadow-lg">
          Cash to Receive
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{fmtDate(order.createdAt)}</div>
          <h3 className="font-display text-lg leading-tight mt-0.5">{order.itemDescription}</h3>
        </div>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap ${
          pending ? "bg-warning/25 text-foreground" : "bg-success/25 text-foreground"
        }`}>
          {pending ? "Pending" : "Fulfilled"}
        </span>
      </div>

      <div className="text-sm space-y-1">
        <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{order.customerName}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Vendor</span><span className="font-medium">{order.vendorName}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="font-medium">{order.paymentMethod}</span></div>
      </div>

      <div className="border-t border-white/15 pt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cost</div>
          <div className="text-sm font-semibold">{inr(order.finalCostPrice)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Sell</div>
          <div className={`text-sm font-semibold ${isReceivable ? "text-[var(--receivable)]" : ""}`}>{inr(sell)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Profit</div>
          <div className={`text-sm font-semibold ${Number(order.profit) >= 0 ? "text-foreground" : "text-destructive"}`}>{inr(order.profit)}</div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onToggle} className="flex-1 glass-input rounded-xl px-3 py-2 text-xs font-medium hover:bg-white/10 transition">
          Mark {pending ? "Fulfilled" : "Pending"}
        </button>
        <button onClick={onDelete} className="px-3 py-2 rounded-xl text-xs font-medium bg-destructive/20 text-destructive-foreground hover:bg-destructive/35 transition">
          Delete
        </button>
      </div>
    </div>
  );
}


function OrderForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void; }) {
  const [f, setF] = useState({
    customerName: "",
    vendorName: "",
    itemName: "",
    costPrice: "", vendorDiscount: "0",
    sellingPrice: "", customerDiscount: "0",
    paymentMethod: "Cash", status: "pending",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const update = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const cost = parseFloat(f.costPrice || "0");
  const sell = parseFloat(f.sellingPrice || "0");
  const vDisc = parseFloat(f.vendorDiscount || "0");
  const cDisc = parseFloat(f.customerDiscount || "0");
  const netCost = Math.max(cost - vDisc, 0);
  const netSell = Math.max(sell - cDisc, 0);
  const previewProfit = netSell - netCost;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!f.customerName.trim() || !f.vendorName.trim() || !f.itemName.trim()) {
      setErr("Customer, vendor and item are required."); return;
    }
    if (Number.isNaN(cost) || Number.isNaN(sell) || cost <= 0 || sell <= 0) {
      setErr("Enter valid cost and selling prices."); return;
    }

    // Store vendor discount inside itemDescription so we can show it on the card,
    // since the table has a single `discount` column (used for customer discount).
    const itemDescription =
      vDisc > 0
        ? `${f.itemName.trim()} [Vendor disc: ₹${vDisc}]`
        : f.itemName.trim();

    setSaving(true);
    const { error } = await supabase.from("orders").insert({
      customerName: f.customerName.trim(),
      vendorName: f.vendorName.trim(),
      itemDescription,
      costPrice: cost,
      sellingPrice: sell,
      discount: cDisc,
      finalCostPrice: netCost,
      profit: previewProfit,
      paymentMethod: f.paymentMethod,
      status: f.status,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  };

  return (
    <Modal onClose={onClose} title="New Order">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer Name"><Input value={f.customerName} onChange={(v) => update("customerName", v)} /></Field>
        <Field label="Vendor Name"><Input value={f.vendorName} onChange={(v) => update("vendorName", v)} /></Field>
        <Field label="Item Name" full><Input value={f.itemName} onChange={(v) => update("itemName", v)} /></Field>

        <Field label="Cost Price (₹)"><Input value={f.costPrice} onChange={(v) => update("costPrice", v)} type="number" /></Field>
        <Field label="Vendor Discount (₹)"><Input value={f.vendorDiscount} onChange={(v) => update("vendorDiscount", v)} type="number" /></Field>

        <Field label="Selling Price (₹)"><Input value={f.sellingPrice} onChange={(v) => update("sellingPrice", v)} type="number" /></Field>
        <Field label="Customer Discount (₹)"><Input value={f.customerDiscount} onChange={(v) => update("customerDiscount", v)} type="number" /></Field>

        <Field label="Payment Method">
          <select className="glass-input w-full rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/40"
            value={f.paymentMethod} onChange={(e) => update("paymentMethod", e.target.value)}>
            {PAYMENT_METHODS.map((p) => <option key={p} className="bg-background">{p}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <div className="flex gap-2">
            {(["pending", "fulfilled"] as const).map((s) => (
              <button type="button" key={s} onClick={() => update("status", s)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-medium capitalize transition ${
                  f.status === s ? "bg-primary text-primary-foreground" : "glass-input hover:bg-white/15"
                }`}>{s}</button>
            ))}
          </div>
        </Field>

        <div className="sm:col-span-2 glass-input rounded-xl p-3 text-sm grid grid-cols-3 gap-2 text-center">
          <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Net Cost</div><div className="font-semibold">{inr(netCost)}</div></div>
          <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Net Sell</div><div className="font-semibold">{inr(netSell)}</div></div>
          <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Profit</div><div className={`font-semibold ${previewProfit >= 0 ? "" : "text-destructive"}`}>{inr(previewProfit)}</div></div>
        </div>

        {err && <div className="sm:col-span-2 text-destructive text-sm">{err}</div>}
        <div className="sm:col-span-2 flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="glass px-4 py-2.5 rounded-xl text-sm">Cancel</button>
          <button disabled={saving} type="submit" className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60">
            {saving ? "Saving…" : "Save Order"}
          </button>
        </div>
      </form>
    </Modal>
  );

}

function PinModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (current !== getStoredPin()) { setMsg("Current PIN incorrect"); return; }
    if (!/^\d{4}$/.test(next)) { setMsg("New PIN must be 4 digits"); return; }
    if (next !== confirm) { setMsg("PINs do not match"); return; }
    setStoredPin(next);
    setMsg("PIN updated ✓");
    setTimeout(onClose, 800);
  };

  return (
    <Modal onClose={onClose} title="Change PIN">
      <form onSubmit={save} className="grid gap-3">
        <Field label="Current PIN"><Input value={current} onChange={(v) => setCurrent(v.replace(/\D/g,"").slice(0,4))} /></Field>
        <Field label="New PIN"><Input value={next} onChange={(v) => setNext(v.replace(/\D/g,"").slice(0,4))} /></Field>
        <Field label="Confirm New PIN"><Input value={confirm} onChange={(v) => setConfirm(v.replace(/\D/g,"").slice(0,4))} /></Field>
        {msg && <div className="text-sm">{msg}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="glass px-4 py-2.5 rounded-xl text-sm">Cancel</button>
          <button type="submit" className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium">Save</button>
        </div>
      </form>
    </Modal>
  );
}

function RecapModal({ orders, onClose }: { orders: Order[]; onClose: () => void }) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(first.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const generate = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");

    const start = new Date(from + "T00:00:00");
    const end = new Date(to + "T23:59:59");
    const inRange = orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= start && d <= end;
    }).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

    let revenue = 0, profit = 0, pendingAmt = 0;
    for (const o of inRange) {
      const sell = Number(o.sellingPrice) - Number(o.discount || 0);
      if (o.status === "fulfilled") { revenue += sell; profit += Number(o.profit); }
      else pendingAmt += sell;
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 50;

    doc.setFont("helvetica", "bold"); doc.setFontSize(20);
    doc.text("Rangriti Creations", 40, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    y += 18; doc.text(`Ledger Recap • ${fmtDate(start.toISOString())} to ${fmtDate(end.toISOString())}`, 40, y);
    y += 24;

    doc.setDrawColor(220); doc.line(40, y, W - 40, y); y += 18;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Summary", 40, y); y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    const summary = [
      ["Total Orders", String(inRange.length)],
      ["Total Revenue (fulfilled)", inr(revenue)],
      ["Total Profit (fulfilled)", inr(profit)],
      ["Pending Amount", inr(pendingAmt)],
    ];
    for (const [k, v] of summary) { doc.text(k, 40, y); doc.text(v, W - 40, y, { align: "right" }); y += 16; }
    y += 10; doc.setDrawColor(220); doc.line(40, y, W - 40, y); y += 18;

    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Orders", 40, y); y += 14;
    doc.setFontSize(9);

    for (const o of inRange) {
      if (y > 760) { doc.addPage(); y = 50; }
      const sell = Number(o.sellingPrice) - Number(o.discount || 0);
      doc.setFont("helvetica", "bold");
      doc.text(`${fmtDate(o.createdAt)}  •  ${o.itemDescription}`, 40, y); y += 12;
      doc.setFont("helvetica", "normal");
      doc.text(`Customer: ${o.customerName}   Vendor: ${o.vendorName}   Pay: ${o.paymentMethod}   Status: ${o.status}`, 40, y); y += 12;
      doc.text(`Cost ${inr(o.finalCostPrice)}   Sell ${inr(sell)}   Profit ${inr(o.profit)}`, 40, y); y += 8;
      doc.setDrawColor(235); doc.line(40, y, W - 40, y); y += 12;
    }

      doc.save(`rangriti-recap-${from}_to_${to}.pdf`);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Could not generate PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Monthly Recap">
      <div className="grid gap-3">
        <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="glass-input w-full rounded-xl px-3 py-2.5 [color-scheme:dark]" /></Field>
        <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="glass-input w-full rounded-xl px-3 py-2.5 [color-scheme:dark]" /></Field>
        {err && <div className="text-destructive text-sm">{err}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="glass px-4 py-2.5 rounded-xl text-sm">Cancel</button>
          <button disabled={busy} onClick={generate} className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60">{busy ? "Generating…" : "Download PDF"}</button>
        </div>
      </div>
    </Modal>
  );
}


function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-strong rounded-3xl p-6 md:p-7 w-full max-w-xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Input({ value, onChange, type = "text" }: { value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="glass-input w-full rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/40"
    />
  );
}
