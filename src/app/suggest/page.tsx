"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

type Step =
  | "submitter_name" | "event_url" | "event_name" | "business_unit" | "event_type" | "region"
  | "start_date" | "end_date" | "location" | "why_attend" | "confirm" | "done";

interface Message { from: "bot" | "user"; text: string; step?: Step }

interface SuggestionData {
  submitter_name: string; event_url: string; event_name: string; business_unit: string; event_type: string;
  region: string; start_date: string; end_date: string; city: string; country: string; why_attend: string;
}

const BUSINESS_UNITS = ["Redline", "Baines Simmons", "Kenyon", "TrustFlight"];
const EVENT_TYPES = ["Conference", "Trade Show", "Forum", "Workshop", "Dinner/Reception"];
const REGIONS = ["EMEA", "NA", "LATAM"];

const STEP_PROMPTS: Partial<Record<Step, string>> = {
  submitter_name: "What's your name?",
  event_url: "Do you have a link to the event website? I can use it to auto-fill the details for you. (optional — skip if not)",
  event_name: "What's the name of the event?",
  business_unit: "Which business unit is this for?",
  event_type: "What type of event is it?",
  region: "Which region?",
  start_date: "When does it start? (optional)",
  end_date: "When does it end? (optional)",
  location: "Where is it? e.g. London, UK (optional)",
  why_attend: "Why should TrustFlight attend? (optional)",
};

const STEPS: Step[] = ["submitter_name","event_url","event_name","business_unit","event_type","region","start_date","end_date","location","why_attend","confirm","done"];
const AUTO_SKIPPABLE: Step[] = ["event_name","start_date","end_date","location"];

function getNextStep(s: Step): Step {
  const i = STEPS.indexOf(s); return STEPS[i + 1] ?? "done";
}

function getStepValue(step: Step, data: SuggestionData): string {
  if (step === "event_name") return data.event_name;
  if (step === "start_date") return data.start_date;
  if (step === "end_date") return data.end_date;
  if (step === "location") return [data.city, data.country].filter(Boolean).join(", ");
  return "";
}

function clearFromStep(step: Step, data: SuggestionData): SuggestionData {
  const idx = STEPS.indexOf(step);
  const next = { ...data };
  const fieldMap: Partial<Record<Step, (keyof SuggestionData)[]>> = {
    submitter_name: ["submitter_name"], event_url: ["event_url"], event_name: ["event_name"], business_unit: ["business_unit"],
    event_type: ["event_type"], region: ["region"], start_date: ["start_date"],
    end_date: ["end_date"], location: ["city","country"], why_attend: ["why_attend"],
  };
  STEPS.slice(idx).forEach(s => {
    (fieldMap[s] ?? []).forEach(f => { next[f] = ""; });
  });
  return next;
}

function BotAvatar() {
  return (
    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="https://www.trustflight.com/wp-content/uploads/2025/09/cropped-tf-favicon.jpg" alt="TF" width={28} height={28} className="w-full h-full object-cover" />
    </div>
  );
}

const EMPTY: SuggestionData = { submitter_name:"", event_url:"", event_name:"", business_unit:"", event_type:"", region:"", start_date:"", end_date:"", city:"", country:"", why_attend:"" };

export default function SuggestPage() {
  const [messages, setMessages] = useState<Message[]>([
    { from: "bot", text: "Hi! Use this form to suggest an event for TrustFlight to attend." },
    { from: "bot", text: STEP_PROMPTS.submitter_name! },
  ]);
  const [step, setStep] = useState<Step>("event_url");
  const [input, setInput] = useState("");
  const [formData, setFormData] = useState<SuggestionData>(EMPTY);
  const [prefilled, setPrefilled] = useState<Set<Step>>(new Set());
  const [checking, setChecking] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, step, checking]);

  const addBot = (text: string, delay = 350) =>
    setTimeout(() => setMessages(p => [...p, { from: "bot", text }]), delay);

  const goTo = (next: Step, data: SuggestionData, pf: Set<Step>) => {
    if (AUTO_SKIPPABLE.includes(next) && pf.has(next)) {
      const val = getStepValue(next, data);
      if (val) {
        setStep(next);
        setTimeout(() => {
          setMessages(p => [...p,
            { from: "bot", text: STEP_PROMPTS[next]! },
            { from: "user", text: `${val} ✓`, step: next },
          ]);
          const nn = getNextStep(next);
          setStep(nn);
          goTo(nn, data, pf);
        }, 350);
        return;
      }
    }
    setStep(next);
    if (next === "confirm") addBot("Here's a summary of your suggestion. Does everything look right?");
    else if (next !== "done" && STEP_PROMPTS[next]) addBot(STEP_PROMPTS[next]!);
  };

  const handleEdit = (msgIndex: number, editStep: Step) => {
    setMessages(prev => prev.slice(0, msgIndex));
    setFormData(prev => clearFromStep(editStep, prev));
    setPrefilled(prev => {
      const pf = new Set(prev);
      STEPS.slice(STEPS.indexOf(editStep)).forEach(s => pf.delete(s));
      return pf;
    });
    setDuplicateWarning(false);
    setChecking(false);
    setInput("");
    setStep(editStep);
  };

  const handleEventUrl = async (url: string) => {
    setMessages(p => [...p, { from: "user", text: url, step: "event_url" }]);
    setInput(""); setChecking(true);
    try {
      const res = await fetch("/api/fetch-event-url", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const d = await res.json();
        const newData = { ...formData, event_url: url };
        const newPf = new Set<Step>();
        const found: string[] = [];
        if (d.event_name) { newData.event_name = d.event_name; newPf.add("event_name"); found.push(`Name: ${d.event_name}`); }
        if (d.start_date) { newData.start_date = d.start_date; newPf.add("start_date"); found.push(`Start: ${d.start_date}`); }
        if (d.end_date) { newData.end_date = d.end_date; newPf.add("end_date"); found.push(`End: ${d.end_date}`); }
        if (d.city || d.country) {
          if (d.city) newData.city = d.city;
          if (d.country) newData.country = d.country;
          newPf.add("location");
          found.push(`Location: ${[d.city, d.country].filter(Boolean).join(", ")}`);
        }
        if (d.description) newData.why_attend = d.description;
        setFormData(newData); setPrefilled(newPf); setChecking(false);
        setTimeout(() => {
          setMessages(p => [...p, { from: "bot", text: found.length > 0 ? `Found it! I've pre-filled: ${found.join(" · ")}. I'll auto-fill those steps — just confirm or update anything that looks off.` : "I couldn't extract details from that page, but I've saved the URL. Let's continue manually." }]);
          setTimeout(() => goTo("event_name", newData, newPf), 600);
        }, 350);
        return;
      }
    } catch { /* fall through */ }
    setChecking(false);
    const newData = { ...formData, event_url: url };
    setFormData(newData);
    addBot("I couldn't fetch that page, but I've saved the URL. Let's continue.");
    setTimeout(() => goTo("event_name", newData, prefilled), 700);
  };

  const handleEventName = async (name: string) => {
    setMessages(p => [...p, { from: "user", text: name, step: "event_name" }]);
    setFormData(p => ({ ...p, event_name: name }));
    setInput(""); setChecking(true);
    try {
      const res = await fetch(`/api/events?search=${encodeURIComponent(name)}`);
      const events: Array<{ event_name: string }> = await res.json();
      if (events.length > 0) {
        const names = Array.from(new Set(events.map(e => e.event_name))).slice(0, 3).join(", ");
        setTimeout(() => {
          setMessages(p => [...p, { from: "bot", text: `Heads up — similar events are already on the calendar: ${names}. Would you like to continue anyway or start over?` }]);
          setDuplicateWarning(true); setChecking(false);
        }, 350);
        return;
      }
    } catch { /* proceed */ }
    setChecking(false);
    const newData = { ...formData, event_name: name };
    setFormData(newData);
    goTo("business_unit", newData, prefilled);
  };

  const advance = (currentStep: Step, value: string, display?: string) => {
    const shown = display !== undefined ? display : value;
    if (shown) setMessages(p => [...p, { from: "user", text: shown, step: currentStep }]);
    const newData = { ...formData };
    if (currentStep === "submitter_name") newData.submitter_name = value;
    else if (currentStep === "business_unit") newData.business_unit = value;
    else if (currentStep === "event_type") newData.event_type = value;
    else if (currentStep === "region") newData.region = value;
    else if (currentStep === "start_date") newData.start_date = value;
    else if (currentStep === "end_date") newData.end_date = value;
    else if (currentStep === "location") {
      const i = value.indexOf(",");
      newData.city = i !== -1 ? value.slice(0, i).trim() : value.trim();
      newData.country = i !== -1 ? value.slice(i + 1).trim() : "";
    } else if (currentStep === "why_attend") newData.why_attend = value;
    setFormData(newData); setInput("");
    goTo(getNextStep(currentStep), newData, prefilled);
  };

  const handleSkip = () => {
    setMessages(p => [...p, { from: "user", text: "Skip", step }]);
    setInput("");
    goTo(getNextStep(step), { ...formData }, prefilled);
  };

  const handleTextSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (step === "event_url") handleEventUrl(input.trim());
    else if (step === "event_name") handleEventName(input.trim());
    else advance(step, input.trim());
  };

  const handleSubmit = async () => {
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/events/suggest", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error();
      setStep("done");
      setMessages(p => [...p, { from: "bot", text: "Your suggestion has been submitted! The team will review it and add it to the events calendar. Thank you! 🎉" }]);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setSubmitting(false); }
  };

  const handleStartOver = () => {
    setMessages([
      { from: "bot", text: "Hi! Use this form to suggest an event for TrustFlight to attend." },
      { from: "bot", text: STEP_PROMPTS.submitter_name! },
    ]);
    setStep("event_url"); setInput(""); setDuplicateWarning(false); setChecking(false);
    setFormData(EMPTY); setPrefilled(new Set());
  };

  const isChoice = ["business_unit","event_type","region"].includes(step);
  const isOptional = ["event_url","start_date","end_date","location","why_attend"].includes(step);
  const isDate = ["start_date","end_date"].includes(step);
  const getChoices = () => step === "business_unit" ? BUSINESS_UNITS : step === "event_type" ? EVENT_TYPES : step === "region" ? REGIONS : [];
  const showInput = !checking && !duplicateWarning && step !== "done" && step !== "confirm";
  const isDone = step === "done";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6" style={{ background: "linear-gradient(135deg, #0b1a3b 0%, #162850 60%, #0f2240 100%)" }}>
      <div className="w-full max-w-lg flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10" style={{ height: "min(680px, 90vh)" }}>

        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 flex items-center gap-3" style={{ background: "linear-gradient(90deg, #0b1a3b 0%, #1a305f 100%)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://www.trustflight.com/wp-content/uploads/2025/09/cropped-tf-favicon.jpg" alt="TrustFlight" width={40} height={40} className="w-10 h-10 rounded-xl shadow-md" />
          <div>
            <p className="text-white font-semibold text-base leading-tight">Event Submissions</p>
            <p className="text-blue-300 text-xs mt-0.5">Suggest an event for TrustFlight to attend</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs">Online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4" style={{ background: "#f8fafc" }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
              {msg.from === "bot" && <BotAvatar />}
              {msg.from === "user" ? (
                <div className="flex flex-col items-end gap-1 group">
                  <div className="max-w-[78%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed shadow-sm text-white" style={{ background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" }}>
                    {msg.text}
                  </div>
                  {msg.step && !isDone && (
                    <button
                      onClick={() => handleEdit(i, msg.step!)}
                      className="text-xs text-slate-400 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100 px-1"
                    >
                      Edit
                    </button>
                  )}
                </div>
              ) : (
                <div className="max-w-[78%] px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed shadow-sm bg-white text-slate-700 border border-slate-100">
                  {msg.text}
                </div>
              )}
            </div>
          ))}

          {checking && (
            <div className="flex gap-2.5 justify-start">
              <BotAvatar />
              <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {(step === "confirm" || isDone) && (
            <div className="flex gap-2.5 justify-start">
              <BotAvatar />
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm shadow-sm p-4 w-full max-w-xs space-y-2.5">
                {formData.submitter_name && <SummaryRow label="Submitted by" value={formData.submitter_name} />}
                {formData.event_name && <SummaryRow label="Event" value={formData.event_name} />}
                {formData.business_unit && <SummaryRow label="Business Unit" value={formData.business_unit} />}
                {formData.event_type && <SummaryRow label="Type" value={formData.event_type} />}
                {formData.region && <SummaryRow label="Region" value={formData.region} />}
                {formData.start_date && <SummaryRow label="Start" value={formData.start_date} />}
                {formData.end_date && <SummaryRow label="End" value={formData.end_date} />}
                {(formData.city || formData.country) && <SummaryRow label="Location" value={[formData.city, formData.country].filter(Boolean).join(", ")} />}
                {formData.why_attend && <SummaryRow label="Why Attend" value={formData.why_attend} />}
                {formData.event_url && <SummaryRow label="URL" value={formData.event_url} />}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 bg-white border-t border-slate-100 px-4 py-3">
          {duplicateWarning && (
            <div className="flex gap-2">
              <button onClick={() => { setDuplicateWarning(false); const d = { ...formData }; goTo("business_unit", d, prefilled); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity" style={{ background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" }}>Continue anyway</button>
              <button onClick={handleStartOver} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Start over</button>
            </div>
          )}
          {step === "confirm" && (
            <div className="space-y-2">
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button onClick={handleSubmit} disabled={submitting} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity" style={{ background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" }}>
                {submitting ? "Submitting..." : "Submit Suggestion"}
              </button>
            </div>
          )}
          {isDone && (
            <button onClick={handleStartOver} className="w-full py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors">Submit another suggestion</button>
          )}
          {showInput && (
            isChoice ? (
              <div className="flex flex-wrap gap-2">
                {getChoices().map(c => (
                  <button key={c} onClick={() => advance(step, c)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-[#0b1a3b] hover:text-[#0b1a3b] hover:bg-blue-50 transition-colors">{c}</button>
                ))}
              </div>
            ) : (
              <form onSubmit={handleTextSubmit} className="flex gap-2">
                {step === "why_attend" ? (
                  <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Type here..." rows={2} className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 resize-none" />
                ) : (
                  <input type={isDate ? "date" : "text"} value={input} onChange={e => setInput(e.target.value)} placeholder={isDate ? undefined : "Type a message..."} autoFocus className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300" />
                )}
                <button type="submit" className="px-4 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity flex-shrink-0" style={{ background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" }}>Send</button>
                {isOptional && <button type="button" onClick={handleSkip} className="px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0">Skip</button>}
              </form>
            )
          )}
        </div>
      </div>
      <p className="text-white/30 text-xs mt-5 tracking-wide">TrustFlight · Events Calendar</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="text-slate-400 text-xs w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-slate-700 text-xs font-medium break-all leading-relaxed">{value}</span>
    </div>
  );
}
