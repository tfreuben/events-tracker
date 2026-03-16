"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

type Step =
  | "event_name"
  | "business_unit"
  | "event_type"
  | "region"
  | "start_date"
  | "end_date"
  | "location"
  | "why_attend"
  | "event_url"
  | "confirm"
  | "done";

interface Message {
  from: "bot" | "user";
  text: string;
}

interface SuggestionData {
  event_name: string;
  business_unit: string;
  event_type: string;
  region: string;
  start_date: string;
  end_date: string;
  city: string;
  country: string;
  why_attend: string;
  event_url: string;
}

const BUSINESS_UNITS = ["Redline", "Baines Simmons", "Kenyon", "TrustFlight"];
const EVENT_TYPES = ["Conference", "Trade Show", "Forum", "Workshop", "Dinner/Reception"];
const REGIONS = ["EMEA", "NA", "LATAM"];

const STEP_PROMPTS: Partial<Record<Step, string>> = {
  event_name: "What's the name of the event you'd like to suggest?",
  business_unit: "Which business unit is this for?",
  event_type: "What type of event is it?",
  region: "Which region?",
  start_date: "When does it start? (optional — skip if you're not sure)",
  end_date: "When does it end? (optional)",
  location: "Where is it? Enter city and country, e.g. London, UK (optional)",
  why_attend: "Why should TrustFlight attend? (optional)",
  event_url: "Do you have a link to the event website? (optional)",
};

const STEPS: Step[] = [
  "event_name", "business_unit", "event_type", "region",
  "start_date", "end_date", "location", "why_attend", "event_url",
  "confirm", "done",
];

function getNextStep(current: Step): Step {
  const idx = STEPS.indexOf(current);
  return STEPS[idx + 1] ?? "done";
}

function BotAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-[#0b1a3b] flex items-center justify-center flex-shrink-0 mt-0.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://www.trustflight.com/wp-content/uploads/2025/09/cropped-tf-favicon.jpg"
        alt="TF"
        width={28}
        height={28}
        className="w-7 h-7 rounded-full object-cover"
      />
    </div>
  );
}

export default function SuggestPage() {
  const [messages, setMessages] = useState<Message[]>([
    { from: "bot", text: "Hi! Use this form to suggest an event for TrustFlight to attend. I'll ask you a few questions to get started." },
    { from: "bot", text: STEP_PROMPTS.event_name! },
  ]);
  const [step, setStep] = useState<Step>("event_name");
  const [input, setInput] = useState("");
  const [formData, setFormData] = useState<SuggestionData>({
    event_name: "", business_unit: "", event_type: "", region: "",
    start_date: "", end_date: "", city: "", country: "", why_attend: "", event_url: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step, checking]);

  const addBotMessage = (text: string, delay = 350) => {
    setTimeout(() => {
      setMessages((prev) => [...prev, { from: "bot", text }]);
    }, delay);
  };

  const moveToStep = (nextStep: Step) => {
    setStep(nextStep);
    if (nextStep === "confirm") {
      addBotMessage("Here's a summary of your suggestion. Everything look right?");
    } else if (nextStep !== "done" && STEP_PROMPTS[nextStep]) {
      addBotMessage(STEP_PROMPTS[nextStep]!);
    }
  };

  const handleEventName = async (value: string) => {
    setMessages((prev) => [...prev, { from: "user", text: value }]);
    setFormData((prev) => ({ ...prev, event_name: value }));
    setInput("");
    setChecking(true);
    try {
      const res = await fetch(`/api/events?search=${encodeURIComponent(value)}`);
      const events: Array<{ event_name: string }> = await res.json();
      if (events.length > 0) {
        const uniqueNames = Array.from(new Set(events.map((e) => e.event_name)));
        const nameList = uniqueNames.slice(0, 3).join(", ");
        setTimeout(() => {
          setMessages((prev) => [...prev, {
            from: "bot",
            text: `Heads up — we found similar events already on the calendar: ${nameList}. Would you like to continue with your suggestion anyway, or start over?`,
          }]);
          setDuplicateWarning(true);
          setChecking(false);
        }, 350);
        return;
      }
    } catch {
      // proceed anyway
    }
    setChecking(false);
    moveToStep("business_unit");
  };

  const advance = (currentStep: Step, value: string, displayValue?: string) => {
    const display = displayValue !== undefined ? displayValue : value;
    if (display) setMessages((prev) => [...prev, { from: "user", text: display }]);
    setFormData((prev: SuggestionData) => {
      const next = { ...prev };
      if (currentStep === "business_unit") next.business_unit = value;
      else if (currentStep === "event_type") next.event_type = value;
      else if (currentStep === "region") next.region = value;
      else if (currentStep === "start_date") next.start_date = value;
      else if (currentStep === "end_date") next.end_date = value;
      else if (currentStep === "location") {
        const commaIdx = value.indexOf(",");
        if (commaIdx !== -1) {
          next.city = value.slice(0, commaIdx).trim();
          next.country = value.slice(commaIdx + 1).trim();
        } else {
          next.city = value.trim();
        }
      } else if (currentStep === "why_attend") next.why_attend = value;
      else if (currentStep === "event_url") next.event_url = value;
      return next;
    });
    setInput("");
    moveToStep(getNextStep(currentStep));
  };

  const handleSkip = () => {
    setMessages((prev) => [...prev, { from: "user", text: "Skip" }]);
    setInput("");
    moveToStep(getNextStep(step));
  };

  const handleTextSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (step === "event_name") handleEventName(input.trim());
    else advance(step, input.trim());
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/events/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed");
      setStep("done");
      setMessages((prev) => [...prev, {
        from: "bot",
        text: "Your suggestion has been submitted! The team will review it and add it to the events calendar. Thank you! 🎉",
      }]);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartOver = () => {
    setMessages([
      { from: "bot", text: "Hi! Use this form to suggest an event for TrustFlight to attend. I'll ask you a few questions to get started." },
      { from: "bot", text: STEP_PROMPTS.event_name! },
    ]);
    setStep("event_name");
    setInput("");
    setDuplicateWarning(false);
    setChecking(false);
    setFormData({ event_name: "", business_unit: "", event_type: "", region: "", start_date: "", end_date: "", city: "", country: "", why_attend: "", event_url: "" });
  };

  const isChoiceStep = ["business_unit", "event_type", "region"].includes(step);
  const isOptionalStep = ["start_date", "end_date", "location", "why_attend", "event_url"].includes(step);
  const isDateStep = ["start_date", "end_date"].includes(step);
  const getChoices = (): string[] => {
    if (step === "business_unit") return BUSINESS_UNITS;
    if (step === "event_type") return EVENT_TYPES;
    if (step === "region") return REGIONS;
    return [];
  };
  const showInput = !checking && !duplicateWarning && step !== "done" && step !== "confirm";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6" style={{ background: "linear-gradient(135deg, #0b1a3b 0%, #162850 60%, #0f2240 100%)" }}>
      {/* Chat card */}
      <div
        className="w-full max-w-lg flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        style={{ height: "min(680px, 90vh)" }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 flex items-center gap-3" style={{ background: "linear-gradient(90deg, #0b1a3b 0%, #1a305f 100%)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.trustflight.com/wp-content/uploads/2025/09/cropped-tf-favicon.jpg"
            alt="TrustFlight"
            width={40}
            height={40}
            className="w-10 h-10 rounded-xl shadow-md"
          />
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
              <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.from === "bot"
                  ? "bg-white text-slate-700 rounded-tl-sm border border-slate-100"
                  : "text-white rounded-tr-sm"
              }`}
              style={msg.from === "user" ? { background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" } : {}}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {/* Checking indicator */}
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

          {/* Summary card */}
          {(step === "confirm" || step === "done") && (
            <div className="flex gap-2.5 justify-start">
              <BotAvatar />
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm shadow-sm p-4 w-full max-w-xs space-y-2.5">
                <SummaryRow label="Event" value={formData.event_name} />
                <SummaryRow label="Business Unit" value={formData.business_unit} />
                <SummaryRow label="Type" value={formData.event_type} />
                <SummaryRow label="Region" value={formData.region} />
                {formData.start_date && <SummaryRow label="Start Date" value={formData.start_date} />}
                {formData.end_date && <SummaryRow label="End Date" value={formData.end_date} />}
                {(formData.city || formData.country) && (
                  <SummaryRow label="Location" value={[formData.city, formData.country].filter(Boolean).join(", ")} />
                )}
                {formData.why_attend && <SummaryRow label="Why Attend" value={formData.why_attend} />}
                {formData.event_url && <SummaryRow label="Event URL" value={formData.event_url} />}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 bg-white border-t border-slate-100 px-4 py-3">
          {duplicateWarning && (
            <div className="flex gap-2">
              <button
                onClick={() => { setDuplicateWarning(false); moveToStep("business_unit"); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" }}
              >
                Continue anyway
              </button>
              <button
                onClick={handleStartOver}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Start over
              </button>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-2">
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" }}
              >
                {submitting ? "Submitting..." : "Submit Suggestion"}
              </button>
            </div>
          )}

          {showInput && (
            isChoiceStep ? (
              <div className="flex flex-wrap gap-2">
                {getChoices().map((choice) => (
                  <button
                    key={choice}
                    onClick={() => advance(step, choice)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-[#0b1a3b] hover:text-[#0b1a3b] hover:bg-blue-50 transition-colors"
                  >
                    {choice}
                  </button>
                ))}
              </div>
            ) : (
              <form onSubmit={handleTextSubmit} className="flex gap-2">
                {step === "why_attend" ? (
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type here..."
                    rows={2}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 resize-none"
                  />
                ) : (
                  <input
                    type={isDateStep ? "date" : "text"}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isDateStep ? undefined : "Type a message..."}
                    autoFocus
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
                  />
                )}
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #0b1a3b, #1e3a6e)" }}
                >
                  Send
                </button>
                {isOptionalStep && (
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
                  >
                    Skip
                  </button>
                )}
              </form>
            )
          )}

          {step === "done" && (
            <button
              onClick={handleStartOver}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Submit another suggestion
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
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
