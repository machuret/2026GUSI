"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Loader2, Search, Globe, Database, ArrowLeft, BookOpen, HelpCircle, ShieldCheck, ToggleLeft, ToggleRight, Pencil, Check } from "lucide-react";
import Link from "next/link";
interface KBItem { id: string; title: string; category: string; source: string; createdAt: string; }
interface FAQ { id: string; question: string; answer: string; category: string; tags?: string[]; active: boolean; createdAt: string; }
interface Rule { id: string; rule: string; category: string; priority: number; active: boolean; }
const CAT_CLS: Record<string, string> = { support:"bg-blue-100 text-blue-700", sales:"bg-green-100 text-green-700", general:"bg-gray-100 text-gray-600" };
const RULE_CLS: Record<string, string> = { behaviour:"bg-purple-100 text-purple-700", tone:"bg-indigo-100 text-indigo-700", escalation:"bg-orange-100 text-orange-700", restriction:"bg-red-100 text-red-700" };
type Tab = "articles" | "faq" | "rules";
export default function KnowledgePage({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState<Tab>("articles");
  const [items, setItems] = useState<KBItem[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [kbSearch, setKbSearch] = useState("");
  const [kbCat, setKbCat] = useState("all");
  const [showAddKB, setShowAddKB] = useState(false);
  const [addMode, setAddMode] = useState<"manual"|"url">("manual");
  const [kbSaving, setKbSaving] = useState(false);
  const [kbScraping, setKbScraping] = useState(false);
  const [kbImporting, setKbImporting] = useState(false);
  const [kbForm, setKbForm] = useState({ title:"", content:"", category:"general", source:"manual", sourceUrl:"" });
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqSearch, setFaqSearch] = useState("");
  const [faqCat, setFaqCat] = useState("all");
  const [showAddFAQ, setShowAddFAQ] = useState(false);
  const [faqSaving, setFaqSaving] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<FAQ|null>(null);
  const [faqForm, setFaqForm] = useState({ question:"", answer:"", category:"general", tags:"" });
  const [rules, setRules] = useState<Rule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleForm, setRuleForm] = useState({ rule:"", category:"behaviour", priority:50 });
  const [msg, setMsg] = useState<{type:"success"|"error";text:string}|null>(null);
  const showMsg = (type:"success"|"error", text:string) => { setMsg({type,text}); setTimeout(()=>setMsg(null),4000); };
  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
  const labelCls = "mb-1 block text-xs font-medium text-gray-700";
  const fetchArticles = useCallback(async () => {
    setKbLoading(true);
    const p = new URLSearchParams();
    if (kbSearch) p.set("search", kbSearch);
    if (kbCat !== "all") p.set("category", kbCat);
    const res = await fetch(`/api/chatbots/${params.id}/knowledge?${p}`);
    const d = await res.json(); setItems(d.items ?? []); setKbLoading(false);
  }, [params.id, kbSearch, kbCat]);
  const fetchFAQs = useCallback(async () => {
    setFaqLoading(true);
    const p = new URLSearchParams();
    if (faqSearch) p.set("search", faqSearch);
    if (faqCat !== "all") p.set("category", faqCat);
    const res = await fetch(`/api/chatbots/${params.id}/faq?${p}`);
    const d = await res.json(); setFaqs(d.faqs ?? []); setFaqLoading(false);
  }, [params.id, faqSearch, faqCat]);
  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    const res = await fetch(`/api/chatbots/${params.id}/rules`);
    const d = await res.json(); setRules(d.rules ?? []); setRulesLoading(false);
  }, [params.id]);
  useEffect(() => { fetchArticles(); }, [fetchArticles]);
  useEffect(() => { if (tab === "faq") fetchFAQs(); }, [tab, fetchFAQs]);
  useEffect(() => { if (tab === "rules") fetchRules(); }, [tab, fetchRules]);
  const handleScrapeUrl = async () => {
    if (!kbForm.sourceUrl) return; setKbScraping(true);
    try {
      const res = await fetch("/api/content/scrape-url", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({url:kbForm.sourceUrl}) });
      const d = await res.json();
      if (d.content) { setKbForm(p=>({...p,title:d.title||new URL(kbForm.sourceUrl).hostname,content:d.content,source:"url"})); showMsg("success","Scraped — review and save"); }
      else showMsg("error", d.error ?? "Could not scrape URL");
    } catch { showMsg("error","Scrape failed"); } finally { setKbScraping(false); }
  };
  const handleSaveArticle = async () => {
    if (!kbForm.title || !kbForm.content) return; setKbSaving(true);
    try {
      const res = await fetch(`/api/chatbots/${params.id}/knowledge`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(kbForm) });
      const d = await res.json();
      if (d.success) { showMsg("success","Article saved"); setKbForm({title:"",content:"",category:"general",source:"manual",sourceUrl:""}); setShowAddKB(false); fetchArticles(); }
    } finally { setKbSaving(false); }
  };
  const handleDeleteArticle = async (id:string) => {
    if (!confirm("Delete this article?")) return;
    await fetch(`/api/chatbots/${params.id}/knowledge?itemId=${id}`, { method:"DELETE" });
    setItems(p=>p.filter(i=>i.id!==id));
  };
  const handleImportVault = async () => {
    setKbImporting(true);
    try {
      const res = await fetch("/api/vault"); const d = await res.json(); const docs = d.documents ?? [];
      if (!docs.length) { showMsg("error","No vault documents found"); return; }
      const rows = docs.map((doc:{filename:string;content:string}) => ({title:doc.filename,content:doc.content,category:"general",source:"vault"}));
      const res2 = await fetch(`/api/chatbots/${params.id}/knowledge`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(rows) });
      const r = await res2.json();
      if (r.success) { showMsg("success",`Imported ${r.items?.length ?? docs.length} from Vault`); fetchArticles(); }
    } catch { showMsg("error","Import failed"); } finally { setKbImporting(false); }
  };
  const handleSaveFAQ = async () => {
    if (!faqForm.question || !faqForm.answer) return; setFaqSaving(true);
    try {
      const payload = { ...faqForm, tags: faqForm.tags ? faqForm.tags.split(",").map(t=>t.trim()).filter(Boolean) : [] };
      if (editingFAQ) {
        const res = await fetch(`/api/chatbots/${params.id}/faq`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id:editingFAQ.id,...payload}) });
        const d = await res.json(); if (d.success) { showMsg("success","FAQ updated"); setEditingFAQ(null); fetchFAQs(); }
      } else {
        const res = await fetch(`/api/chatbots/${params.id}/faq`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
        const d = await res.json(); if (d.success) { showMsg("success","FAQ added"); setShowAddFAQ(false); fetchFAQs(); }
      }
      setFaqForm({question:"",answer:"",category:"general",tags:""});
    } finally { setFaqSaving(false); }
  };
  const toggleFAQ = async (faq:FAQ) => {
    await fetch(`/api/chatbots/${params.id}/faq`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id:faq.id,active:!faq.active}) });
    setFaqs(p=>p.map(f=>f.id===faq.id?{...f,active:!f.active}:f));
  };
  const handleDeleteFAQ = async (id:string) => {
    if (!confirm("Delete this FAQ?")) return;
    await fetch(`/api/chatbots/${params.id}/faq?faqId=${id}`, { method:"DELETE" });
    setFaqs(p=>p.filter(f=>f.id!==id));
  };
  const startEditFAQ = (faq:FAQ) => {
    setEditingFAQ(faq); setFaqForm({question:faq.question,answer:faq.answer,category:faq.category,tags:(faq.tags??[]).join(", ")}); setShowAddFAQ(true);
  };
  const handleSaveRule = async () => {
    if (!ruleForm.rule) return; setRuleSaving(true);
    try {
      const res = await fetch(`/api/chatbots/${params.id}/rules`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(ruleForm) });
      const d = await res.json(); if (d.success) { showMsg("success","Rule added"); setRuleForm({rule:"",category:"behaviour",priority:50}); setShowAddRule(false); fetchRules(); }
    } finally { setRuleSaving(false); }
  };
  const toggleRule = async (rule:Rule) => {
    await fetch(`/api/chatbots/${params.id}/rules`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id:rule.id,active:!rule.active}) });
    setRules(p=>p.map(r=>r.id===rule.id?{...r,active:!r.active}:r));
  };
  const handleDeleteRule = async (id:string) => {
    if (!confirm("Delete this rule?")) return;
    await fetch(`/api/chatbots/${params.id}/rules?ruleId=${id}`, { method:"DELETE" });
    setRules(p=>p.filter(r=>r.id!==id));
  };
  const TABS = [
    {id:"articles" as Tab, label:"Knowledge Articles", icon:BookOpen, count:items.length},
    {id:"faq" as Tab, label:"FAQ", icon:HelpCircle, count:faqs.length},
    {id:"rules" as Tab, label:"Bot Rules", icon:ShieldCheck, count:rules.length},
  ];
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/chatbots" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Training Centre</h1>
          <p className="text-sm text-gray-500">Articles, FAQs, and rules that shape your chatbot responses</p>
        </div>
      </div>
      <div className="mb-6 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab===t.id?"bg-white text-brand-700 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
            <t.icon className="h-4 w-4" />{t.label}
            {t.count>0 && <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-semibold text-gray-600">{t.count}</span>}
          </button>
        ))}
      </div>
      {msg && <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.type==="success"?"bg-green-50 text-green-700":"bg-red-50 text-red-700"}`}>{msg.text}</div>}

      {tab === "articles" && (
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={handleImportVault} disabled={kbImporting} className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60">
              {kbImporting?<Loader2 className="h-4 w-4 animate-spin"/>:<Database className="h-4 w-4"/>} Import from Vault
            </button>
            <button onClick={()=>setShowAddKB(true)} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <Plus className="h-4 w-4"/> Add Article
            </button>
          </div>
          {showAddKB && (
            <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50 p-5">
              <div className="mb-4 flex gap-2">
                {(["manual","url"] as const).map(m=>(
                  <button key={m} onClick={()=>setAddMode(m)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${addMode===m?"bg-brand-600 text-white":"bg-white text-gray-600 border border-gray-200"}`}>
                    {m==="url"?<><Globe className="mr-1.5 inline h-3.5 w-3.5"/>From URL</>:<><BookOpen className="mr-1.5 inline h-3.5 w-3.5"/>Manual</>}
                  </button>
                ))}
              </div>
              {addMode==="url" && (
                <div className="mb-3 flex gap-2">
                  <input className={inputCls} placeholder="https://..." value={kbForm.sourceUrl} onChange={e=>setKbForm(p=>({...p,sourceUrl:e.target.value}))}/>
                  <button onClick={handleScrapeUrl} disabled={kbScraping||!kbForm.sourceUrl} className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 whitespace-nowrap">
                    {kbScraping?<Loader2 className="h-4 w-4 animate-spin"/>:<Globe className="h-4 w-4"/>} {kbScraping?"Scraping...":"Scrape"}
                  </button>
                </div>
              )}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><label className={labelCls}>Title</label><input className={inputCls} value={kbForm.title} onChange={e=>setKbForm(p=>({...p,title:e.target.value}))}/></div>
                  <div><label className={labelCls}>Category</label>
                    <select className={inputCls} value={kbForm.category} onChange={e=>setKbForm(p=>({...p,category:e.target.value}))}>
                      <option value="support">Support</option><option value="sales">Sales</option><option value="general">General</option>
                    </select></div>
                </div>
                <div><label className={labelCls}>Content</label><textarea rows={6} className={inputCls} value={kbForm.content} onChange={e=>setKbForm(p=>({...p,content:e.target.value}))}/></div>
                <div className="flex gap-2">
                  <button onClick={handleSaveArticle} disabled={kbSaving||!kbForm.title||!kbForm.content} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
                    {kbSaving?<Loader2 className="h-4 w-4 animate-spin"/>:<Plus className="h-4 w-4"/>} {kbSaving?"Saving...":"Save Article"}
                  </button>
                  <button onClick={()=>setShowAddKB(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-white">Cancel</button>
                </div>
              </div>
            </div>
          )}
          <div className="mb-4 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/>
              <input value={kbSearch} onChange={e=>setKbSearch(e.target.value)} placeholder="Search articles..." className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"/>
            </div>
            {["all","support","sales","general"].map(c=>(
              <button key={c} onClick={()=>setKbCat(c)} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${kbCat===c?"bg-brand-600 text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{c}</button>
            ))}
          </div>
          {kbLoading?<div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-brand-500"/></div>
            :items.length===0?<div className="rounded-xl border border-dashed border-gray-300 py-16 text-center"><BookOpen className="mx-auto mb-2 h-8 w-8 text-gray-300"/><p className="text-gray-400">No articles yet.</p></div>
            :<div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {items.map((item,i)=>(
                <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${i<items.length-1?"border-b border-gray-100":""}`}>
                  <div className="flex-1 min-w-0"><p className="truncate text-sm font-medium text-gray-900">{item.title}</p><p className="text-xs text-gray-400">{item.source} - {new Date(item.createdAt).toLocaleDateString("en-AU")}</p></div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAT_CLS[item.category]??CAT_CLS.general}`}>{item.category}</span>
                  <button onClick={()=>handleDeleteArticle(item.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4"/></button>
                </div>
              ))}
            </div>}
        </div>
      )}

      {tab === "faq" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">Short Q&A pairs used verbatim when a visitor asks a matching question.</p>
            <button onClick={()=>{setEditingFAQ(null);setFaqForm({question:"",answer:"",category:"general",tags:""});setShowAddFAQ(true);}} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <Plus className="h-4 w-4"/> Add FAQ
            </button>
          </div>
          {showAddFAQ && (
            <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50 p-5">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">{editingFAQ?"Edit FAQ":"New FAQ"}</h3>
              <div className="space-y-3">
                <div><label className={labelCls}>Question</label><input className={inputCls} placeholder="e.g. How long is the course?" value={faqForm.question} onChange={e=>setFaqForm(p=>({...p,question:e.target.value}))}/></div>
                <div><label className={labelCls}>Answer</label><textarea rows={4} className={inputCls} placeholder="The exact answer the bot should give..." value={faqForm.answer} onChange={e=>setFaqForm(p=>({...p,answer:e.target.value}))}/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Category</label>
                    <select className={inputCls} value={faqForm.category} onChange={e=>setFaqForm(p=>({...p,category:e.target.value}))}>
                      <option value="support">Support</option><option value="sales">Sales</option><option value="general">General</option>
                    </select></div>
                  <div><label className={labelCls}>Tags (comma-separated)</label><input className={inputCls} placeholder="pricing, enrolment, refund" value={faqForm.tags} onChange={e=>setFaqForm(p=>({...p,tags:e.target.value}))}/></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveFAQ} disabled={faqSaving||!faqForm.question||!faqForm.answer} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
                    {faqSaving?<Loader2 className="h-4 w-4 animate-spin"/>:<Check className="h-4 w-4"/>} {faqSaving?"Saving...":editingFAQ?"Update FAQ":"Save FAQ"}
                  </button>
                  <button onClick={()=>{setShowAddFAQ(false);setEditingFAQ(null);}} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-white">Cancel</button>
                </div>
              </div>
            </div>
          )}
          <div className="mb-4 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/>
              <input value={faqSearch} onChange={e=>setFaqSearch(e.target.value)} placeholder="Search FAQs..." className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none"/>
            </div>
            {["all","support","sales","general"].map(c=>(
              <button key={c} onClick={()=>setFaqCat(c)} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${faqCat===c?"bg-brand-600 text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{c}</button>
            ))}
          </div>
          {faqLoading?<div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-brand-500"/></div>
            :faqs.length===0?<div className="rounded-xl border border-dashed border-gray-300 py-16 text-center"><HelpCircle className="mx-auto mb-2 h-8 w-8 text-gray-300"/><p className="text-gray-400">No FAQs yet. Add your first one above.</p></div>
            :<div className="space-y-3">
              {faqs.map(faq=>(
                <div key={faq.id} className={`rounded-xl border bg-white p-4 ${faq.active?"border-gray-200":"border-gray-100 opacity-60"}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">Q: {faq.question}</p>
                      <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">A: {faq.answer}</p>
                      {faq.tags && faq.tags.length>0 && <div className="mt-2 flex flex-wrap gap-1">{faq.tags.map(tag=><span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{tag}</span>)}</div>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAT_CLS[faq.category]??CAT_CLS.general}`}>{faq.category}</span>
                      <button onClick={()=>toggleFAQ(faq)} className="text-gray-400 hover:text-brand-600">{faq.active?<ToggleRight className="h-5 w-5 text-green-500"/>:<ToggleLeft className="h-5 w-5"/>}</button>
                      <button onClick={()=>startEditFAQ(faq)} className="text-gray-400 hover:text-brand-600"><Pencil className="h-4 w-4"/></button>
                      <button onClick={()=>handleDeleteFAQ(faq.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4"/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>}
        </div>
      )}

      {tab === "rules" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">Rules are injected into every conversation. Higher priority rules are applied first. 8 default GUSI rules are pre-loaded.</p>
            <button onClick={()=>setShowAddRule(true)} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              <Plus className="h-4 w-4"/> Add Rule
            </button>
          </div>
          {showAddRule && (
            <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50 p-5">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">New Rule</h3>
              <div className="space-y-3">
                <div><label className={labelCls}>Rule</label><textarea rows={3} className={inputCls} placeholder="e.g. Never quote prices - always say contact us for pricing" value={ruleForm.rule} onChange={e=>setRuleForm(p=>({...p,rule:e.target.value}))}/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Category</label>
                    <select className={inputCls} value={ruleForm.category} onChange={e=>setRuleForm(p=>({...p,category:e.target.value}))}>
                      <option value="behaviour">Behaviour</option><option value="tone">Tone</option><option value="escalation">Escalation</option><option value="restriction">Restriction</option>
                    </select></div>
                  <div><label className={labelCls}>Priority: {ruleForm.priority} (higher = applied first)</label>
                    <input type="range" min={0} max={100} value={ruleForm.priority} onChange={e=>setRuleForm(p=>({...p,priority:parseInt(e.target.value)}))} className="w-full mt-2 accent-brand-600"/></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveRule} disabled={ruleSaving||!ruleForm.rule} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
                    {ruleSaving?<Loader2 className="h-4 w-4 animate-spin"/>:<Plus className="h-4 w-4"/>} {ruleSaving?"Saving...":"Add Rule"}
                  </button>
                  <button onClick={()=>setShowAddRule(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-white">Cancel</button>
                </div>
              </div>
            </div>
          )}
          {rulesLoading?<div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-brand-500"/></div>
            :rules.length===0?<div className="rounded-xl border border-dashed border-gray-300 py-16 text-center"><ShieldCheck className="mx-auto mb-2 h-8 w-8 text-gray-300"/><p className="text-gray-400">No rules yet.</p></div>
            :<div className="space-y-2">
              {rules.map(rule=>(
                <div key={rule.id} className={`flex items-start gap-3 rounded-xl border bg-white px-4 py-3 ${rule.active?"border-gray-200":"border-gray-100 opacity-50"}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{rule.rule}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RULE_CLS[rule.category]??RULE_CLS.behaviour}`}>{rule.category}</span>
                      <span className="text-xs text-gray-400">priority {rule.priority}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={()=>toggleRule(rule)} className="text-gray-400 hover:text-brand-600">{rule.active?<ToggleRight className="h-5 w-5 text-green-500"/>:<ToggleLeft className="h-5 w-5"/>}</button>
                    <button onClick={()=>handleDeleteRule(rule.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4"/></button>
                  </div>
                </div>
              ))}
            </div>}
        </div>
      )}
    </div>
  );
}
