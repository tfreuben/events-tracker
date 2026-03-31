"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

type Step =
  | "event_name" | "submitter_name" | "business_unit" | "event_type" | "region"
  | "start_date" | "end_date" | "location" | "venue" | "event_description" | "target_audience"
  | "key_topics" | "why_attend" | "confirm" | "done";

interface Message { from: "bot" | "user"; text: string; step?: Step }

interface SuggestionData {
  submitter_name: string; event_url: string; event_name: string; business_unit: string; event_type: string;
  region: string; start_date: string; end_date: string; city: string; country: string;
  venue: string; event_description: string; target_audience: string; key_topics: string; why_attend: string;
}

const BUSINESS_UNITS = ["Redline", "Baines Simmons", "Kenyon", "TrustFlight"];
const EVENT_TYPES = ["Conference/Trade Show", "Forum", "Workshop", "Dinner/Reception"];
const REGIONS = ["EMEA", "NA", "LATAM", "APAC"];

const STEP_PROMPTS: Partial<Record<Step, string>> = {
  event_name: "What's the name of the event?",
  submitter_name: "And your name?",
  business_unit: "Which brand is this for?",
  event_type: "What type of event is it?",
  region: "Which region?",
  start_date: "When does it start? (optional)",
  end_date: "When does it end? (optional)",
  location: "Where is it? e.g. London, UK (optional)",
  venue: "What's the venue name? Skip if you're not sure.",
  event_description: "Briefly describe what this event is about. Skip if you're not sure.",
  target_audience: "Who typically attends? Skip if you're not sure.",
  key_topics: "What are the main topics or themes? Skip if you're not sure.",
  why_attend: "Why should TrustFlight attend? (optional)",
};

const STEPS: Step[] = [
  "event_name", "submitter_name", "business_unit", "event_type", "region",
  "start_date", "end_date", "location", "venue", "event_description", "target_audience",
  "key_topics", "why_attend", "confirm", "done",
];
const AUTO_SKIPPABLE: Step[] = ["business_unit", "event_type", "region", "start_date", "end_date", "location", "venue", "event_description", "target_audience", "key_topics"];

function getNextStep(s: Step): Step {
  const i = STEPS.indexOf(s); return STEPS[i + 1] ?? "done";
}

function getStepValue(step: Step, data: SuggestionData): string {
  if (step === "business_unit") return data.business_unit;
  if (step === "event_type") return data.event_type;
  if (step === "region") return data.region;
  if (step === "start_date") return data.start_date;
  if (step === "end_date") return data.end_date;
  if (step === "location") return [data.city, data.country].filter(Boolean).join(", ");
  if (step === "venue") return data.venue;
  if (step === "event_description") return data.event_description;
  if (step === "target_audience") return data.target_audience;
  if (step === "key_topics") return data.key_topics;
  return "";
}

function clearFromStep(step: Step, data: SuggestionData): SuggestionData {
  const idx = STEPS.indexOf(step);
  const next = { ...data };
  const fieldMap: Partial<Record<Step, (keyof SuggestionData)[]>> = {
    event_name: ["event_name", "event_url"], submitter_name: ["submitter_name"], business_unit: ["business_unit"],
    event_type: ["event_type"], region: ["region"], start_date: ["start_date"],
    end_date: ["end_date"], location: ["city", "country"], venue: ["venue"],
    event_description: ["event_description"], target_audience: ["target_audience"],
    key_topics: ["key_topics"], why_attend: ["why_attend"],
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

const NON_ANSWER = /^(i?\s*don'?t\s*know|not?\s*sure|n\/?a|none|no\s*idea|unsure|unknown|idk|no|skip|pass|-+|\.+|\?+)$/i;

const CLEANSABLE_FIELDS: (keyof SuggestionData)[] = [
  "venue", "event_description", "target_audience", "key_topics", "why_attend",
  "city", "country", "start_date", "end_date",
];

function cleanseData(data: SuggestionData): SuggestionData {
  const cleaned = { ...data };
  for (const field of CLEANSABLE_FIELDS) {
    if (cleaned[field] && NON_ANSWER.test(cleaned[field].trim())) {
      cleaned[field] = "";
    }
  }
  return cleaned;
}

const EMPTY: SuggestionData = {
  submitter_name: "", event_url: "", event_name: "", business_unit: "", event_type: "",
  region: "", start_date: "", end_date: "", city: "", country: "",
  venue: "", event_description: "", target_audience: "", key_topics: "", why_attend: "",
};

export default function SuggestPage() {
  const [messages, setMessages] = useState<Message[]>([
    { from: "bot", text: "Hi! Suggest an event for TrustFlight to attend. I'll look it up and fill in the details for you." },
    { from: "bot", text: STEP_PROMPTS.event_name! },
  ]);
  const [step, setStep] = useState<Step>("event_name");
  const [input, setInput] = useState("");
  const [formData, setFormData] = useState<SuggestionData>(EMPTY);
  const [prefilled, setPrefilled] = useState<Set<Step>>(new Set());
  const [checking, setChecking] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [aiLookup, setAiLookup] = useState<{ data: SuggestionData; prefilled: Set<Step> } | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
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
            { from: "user", text: `${val} \u2713`, step: next },
          ]);
          const nn = getNextStep(next);
          setStep(nn);
          goTo(nn, data, pf);
        }, 350);
        return;
      }
    }
    if (next === "confirm") {
      setFormData(prev => cleanseData(prev));
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
    setAiLookup(null);
    setSelectedBrands(new Set());
    setInput("");
    setStep(editStep);
  };

  const handleEventName = async (name: string) => {
    setMessages(p => [...p, { from: "user", text: name, step: "event_name" }]);
    setFormData(p => ({ ...p, event_name: name }));
    setInput(""); setChecking(true);

    // Run duplicate check and AI web search in parallel
    const dupPromise = fetch(`/api/events?search=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then((events: Array<{ event_name: string }>) => events)
      .catch(() => [] as Array<{ event_name: string }>);

    const aiPromise = fetch("/api/enrich-event", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_name: name }),
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    const [events, aiData] = await Promise.all([dupPromise, aiPromise]);

    // Build AI lookup data
    let hasAiData = false;
    const newData = { ...formData, event_name: name };
    const newPf = new Set(prefilled);
    if (aiData) {
      if (aiData.event_name) { newData.event_name = aiData.event_name; }
      if (aiData.start_date) { newData.start_date = aiData.start_date; newPf.add("start_date"); hasAiData = true; }
      if (aiData.end_date) { newData.end_date = aiData.end_date; newPf.add("end_date"); hasAiData = true; }
      if (aiData.city || aiData.country) {
        if (aiData.city) newData.city = aiData.city;
        if (aiData.country) newData.country = aiData.country;
        newPf.add("location"); hasAiData = true;
      }
      if (aiData.venue) { newData.venue = aiData.venue; newPf.add("venue"); hasAiData = true; }
      if (aiData.event_description) { newData.event_description = aiData.event_description; newPf.add("event_description"); hasAiData = true; }
      if (aiData.target_audience) { newData.target_audience = aiData.target_audience; newPf.add("target_audience"); hasAiData = true; }
      if (aiData.key_topics) { newData.key_topics = aiData.key_topics; newPf.add("key_topics"); hasAiData = true; }
      if (aiData.region && REGIONS.includes(aiData.region)) { newData.region = aiData.region; newPf.add("region"); hasAiData = true; }
      if (aiData.event_type && EVENT_TYPES.includes(aiData.event_type)) { newData.event_type = aiData.event_type; newPf.add("event_type"); hasAiData = true; }
    }

    setChecking(false);

    // Show AI confirmation card (with duplicate note if applicable)
    if (hasAiData) {
      const dupNote = events.length > 0
        ? `Note: similar events already on the calendar (${Array.from(new Set(events.map(e => e.event_name))).slice(0, 3).join(", ")}). `
        : "";
      setTimeout(() => {
        setMessages(p => [...p, { from: "bot", text: `${dupNote}I found this event. Is this right?` }]);
        setAiLookup({ data: newData, prefilled: newPf });
      }, 350);
      return;
    }

    // No AI data - just show duplicate warning if applicable
    if (events.length > 0) {
      const names = Array.from(new Set(events.map(e => e.event_name))).slice(0, 3).join(", ");
      setTimeout(() => {
        setMessages(p => [...p, { from: "bot", text: `Heads up - similar events are already on the calendar: ${names}. Would you like to continue anyway or start over?` }]);
        setDuplicateWarning(true);
      }, 350);
      return;
    }

    setFormData(newData);
    goTo("submitter_name", newData, prefilled);
  };

  const handleAiConfirm = () => {
    if (!aiLookup) return;
    const { data, prefilled: pf } = aiLookup;
    setFormData(data);
    setPrefilled(pf);
    setAiLookup(null);
    setMessages(p => [...p, { from: "user", text: "Yes, that's it \u2713" }]);
    setTimeout(() => goTo("submitter_name", data, pf), 350);
  };

  const handleAiReject = () => {
    if (!aiLookup) return;
    const newData = { ...formData, event_name: aiLookup.data.event_name };
    setFormData(newData);
    setAiLookup(null);
    setMessages(p => [...p, { from: "user", text: "No, I'll fill in the details" }]);
    setTimeout(() => goTo("submitter_name", newData, prefilled), 350);
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
    } else if (currentStep === "venue") newData.venue = value;
    else if (currentStep === "event_description") newData.event_description = value;
    else if (currentStep === "target_audience") newData.target_audience = value;
    else if (currentStep === "key_topics") newData.key_topics = value;
    else if (currentStep === "why_attend") newData.why_attend = value;
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
    if (step === "event_name") handleEventName(input.trim());
    else advance(step, input.trim());
  };

  const handleSubmit = async () => {
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/events/suggest", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cleanseData(formData)),
      });
      if (!res.ok) throw new Error();
      setStep("done");
      setMessages(p => [...p, { from: "bot", text: "Your suggestion has been submitted! The team will review it and add it to the events calendar. Thank you!" }]);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setSubmitting(false); }
  };

  const handleStartOver = () => {
    setMessages([
      { from: "bot", text: "Hi! Suggest an event for TrustFlight to attend. I'll look it up and fill in the details for you." },
      { from: "bot", text: STEP_PROMPTS.event_name! },
    ]);
    setStep("event_name"); setInput(""); setDuplicateWarning(false); setChecking(false); setAiLookup(null); setSelectedBrands(new Set());
    setFormData(EMPTY); setPrefilled(new Set());
  };

  const isMultiChoice = step === "business_unit";
  const isChoice = ["event_type", "region"].includes(step);
  const isOptional = ["start_date", "end_date", "location", "venue", "event_description", "target_audience", "key_topics", "why_attend"].includes(step);
  const isTextarea = ["why_attend", "event_description", "target_audience"].includes(step);
  const isDate = ["start_date", "end_date"].includes(step);
  const getChoices = () => step === "event_type" ? EVENT_TYPES : step === "region" ? REGIONS : [];
  const showInput = !checking && !duplicateWarning && !aiLookup && step !== "done" && step !== "confirm";
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 space-y-4" style={{ background: "#f8fafc" }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
              {msg.from === "bot" && <BotAvatar />}
              {msg.from === "user" ? (
                <div className="flex flex-col items-end gap-1 group pr-2">
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
              <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="text-xs text-slate-400 ml-1">Searching...</span>
              </div>
            </div>
          )}

          {aiLookup && (
            <div className="flex gap-2.5 justify-start">
              <BotAvatar />
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm shadow-sm p-4 w-full max-w-xs space-y-2.5">
                {aiLookup.data.event_name && <SummaryRow label="Event" value={aiLookup.data.event_name} />}
                {aiLookup.data.event_type && <SummaryRow label="Type" value={aiLookup.data.event_type} />}
                {aiLookup.data.start_date && <SummaryRow label="Start" value={aiLookup.data.start_date} />}
                {aiLookup.data.end_date && <SummaryRow label="End" value={aiLookup.data.end_date} />}
                {(aiLookup.data.city || aiLookup.data.country) && <SummaryRow label="Location" value={[aiLookup.data.city, aiLookup.data.country].filter(Boolean).join(", ")} />}
                {aiLookup.data.venue && <SummaryRow label="Venue" value={aiLookup.data.venue} />}
                {aiLookup.data.region && <SummaryRow label="Region" value={aiLookup.data.region} />}
                {aiLookup.data.event_description && <SummaryRow label="About" value={aiLookup.data.event_description} />}
                {aiLookup.data.target_audience && <SummaryRow label="Audience" value={aiLookup.data.target_audience} />}
                {aiLookup.data.key_topics && <SummaryRow label="Topics" value={aiLookup.data.key_topics} />}
              </div>
            </div>
          )}

          {isDone && (
            <div className="flex gap-2.5 justify-start">
              <BotAvatar />
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm shadow-sm p-4 w-full max-w-xs space-y-2.5">
                {formData.submitter_name && <SummaryRow label="Submitted by" value={formData.submitter_name} />}
                {formData.event_name && <SummaryRow label="Event" value={formData.event_name} />}
                {formData.business_unit && <SummaryRow label="Brand" value={formData.business_unit} />}
                {formData.event_type && <SummaryRow label="Type" value={formData.event_type} />}
                {formData.region && <SummaryRow label="Region" value={formData.region} />}
                {formData.start_date && <SummaryRow label="Start" value={formData.start_date} />}
                {formData.end_date && <SummaryRow label="End" value={formData.end_date} />}
                {(formData.city || formData.country) && <SummaryRow label="Location" value={[formData.city, formData.country].filter(Boolean).join(", ")} />}
                {formData.venue && <SummaryRow label="Venue" value={formData.venue} />}
                {formData.event_description && <SummaryRow label="About" value={formData.event_description} />}
                {formData.target_audience && <SummaryRow label="Audience" value={formData.target_audience} />}
                {formData.key_topics && <SummaryRow label="Topics" value={formData.key_topics} />}
                {formData.why_attend && <SummaryRow label="Why Attend" value={formData.why_attend} />}
              </div>
            </div>
          )}

          {step === "confirm" && (
            <div className="flex gap-2.5 justify-start">
              <BotAvatar />
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm shadow-sm p-4 w-full max-w-xs space-y-3">
                <EditableRow label="Event" value={formData.event_name} onChange={v => setFormData(p => ({ ...p, event_name: v }))} />
                <EditableRow label="Submitted by" value={formData.submitter_name} onChange={v => setFormData(p => ({ ...p, submitter_name: v }))} />
                <EditableRow label="Brand" value={formData.business_unit} onChange={v => setFormData(p => ({ ...p, business_unit: v }))} />
                <EditableRow label="Type" value={formData.event_type} onChange={v => setFormData(p => ({ ...p, event_type: v }))} />
                <EditableRow label="Region" value={formData.region} onChange={v => setFormData(p => ({ ...p, region: v }))} />
                <EditableRow label="Start" value={formData.start_date} onChange={v => setFormData(p => ({ ...p, start_date: v }))} type="date" />
                <EditableRow label="End" value={formData.end_date} onChange={v => setFormData(p => ({ ...p, end_date: v }))} type="date" />
                <EditableRow label="Location" value={[formData.city, formData.country].filter(Boolean).join(", ")} onChange={v => {
                  const i = v.indexOf(",");
                  setFormData(p => ({ ...p, city: i !== -1 ? v.slice(0, i).trim() : v.trim(), country: i !== -1 ? v.slice(i + 1).trim() : "" }));
                }} />
                <EditableRow label="Venue" value={formData.venue} onChange={v => setFormData(p => ({ ...p, venue: v }))} />
                <EditableRow label="About" value={formData.event_description} onChange={v => setFormData(p => ({ ...p, event_description: v }))} />
                <EditableRow label="Audience" value={formData.target_audience} onChange={v => setFormData(p => ({ ...p, target_audience: v }))} />
                <EditableRow label="Topics" value={formData.key_topics} onChange={v => setFormData(p => ({ ...p, key_topics: v }))} />
                <EditableRow label="Why Attend" value={formData.why_attend} onChange={v => setFormData(p => ({ ...p, why_attend: v }))} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 bg-white border-t border-slate-100 px-4 py-3">
          {aiLookup && (
            <div className="flex gap-2">
              <button onClick={handleAiConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity" style={{ background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" }}>{"Yes, that's it"}</button>
              <button onClick={handleAiReject} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">{"No, I'll fill in manually"}</button>
            </div>
          )}
          {duplicateWarning && (
            <div className="flex gap-2">
              <button onClick={() => { setDuplicateWarning(false); const d = { ...formData }; goTo("submitter_name", d, prefilled); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity" style={{ background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" }}>Continue anyway</button>
              <button onClick={handleStartOver} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Start over</button>
            </div>
          )}
          {step === "confirm" && (
            <div className="space-y-2">
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-opacity" style={{ background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" }}>
                  {submitting ? "Submitting..." : "Submit"}
                </button>
                <button onClick={handleStartOver} className="flex-1 py-3 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                  Start over
                </button>
              </div>
            </div>
          )}
          {isDone && (
            <div className="flex gap-2">
              <button onClick={handleStartOver} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors">Submit another</button>
              <button onClick={() => window.close()} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity" style={{ background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" }}>Close</button>
            </div>
          )}
          {showInput && (
            isMultiChoice ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {BUSINESS_UNITS.map(c => {
                    const selected = selectedBrands.has(c);
                    return (
                      <button key={c} onClick={() => setSelectedBrands(prev => { const next = new Set(prev); if (next.has(c)) next.delete(c); else next.add(c); return next; })}
                        className={`px-4 py-2 border rounded-xl text-sm font-medium transition-colors ${selected ? "text-white border-[#0b1a3b]" : "bg-slate-50 border-slate-200 text-slate-700 hover:border-[#0b1a3b] hover:text-[#0b1a3b] hover:bg-blue-50"}`}
                        style={selected ? { background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" } : undefined}
                      >{c}</button>
                    );
                  })}
                </div>
                {selectedBrands.size > 0 && (
                  <button onClick={() => { const val = Array.from(selectedBrands).join(", "); setSelectedBrands(new Set()); advance("business_unit", val); }}
                    className="w-full py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity"
                    style={{ background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" }}
                  >Done</button>
                )}
              </div>
            ) : isChoice ? (
              <div className="flex flex-wrap gap-2">
                {getChoices().map(c => (
                  <button key={c} onClick={() => advance(step, c)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-[#0b1a3b] hover:text-[#0b1a3b] hover:bg-blue-50 transition-colors">{c}</button>
                ))}
              </div>
            ) : (
              <form onSubmit={handleTextSubmit} className="flex gap-2">
                {isTextarea ? (
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

function EditableRow({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="text-slate-400 text-xs w-20 shrink-0 pt-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="-"
        className="flex-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-300"
      />
    </div>
  );
}
