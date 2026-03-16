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
  start_date: "When does it start? (optional — you can skip if you're not sure)",
  end_date: "When does it end? (optional)",
  location: "Where is it? Enter city and country, e.g. London, UK (optional)",
  why_attend: "Why should TrustFlight attend? (optional)",
  event_url: "Do you have a link to the event website? (optional)",
};

const STEPS: Step[] = [
  "event_name",
  "business_unit",
  "event_type",
  "region",
  "start_date",
  "end_date",
  "location",
  "why_attend",
  "event_url",
  "confirm",
  "done",
];

function getNextStep(current: Step): Step {
  const idx = STEPS.indexOf(current);
  return STEPS[idx + 1] ?? "done";
}

export default function SuggestPage() {
  const [messages, setMessages] = useState<Message[]>([
    { from: "bot", text: "Hi! Use this form to suggest an event for TrustFlight to attend. I'll ask you a few questions." },
    { from: "bot", text: STEP_PROMPTS.event_name! },
  ]);
  const [step, setStep] = useState<Step>("event_name");
  const [input, setInput] = useState("");
  const [formData, setFormData] = useState<SuggestionData>({
    event_name: "",
    business_unit: "",
    event_type: "",
    region: "",
    start_date: "",
    end_date: "",
    city: "",
    country: "",
    why_attend: "",
    event_url: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step, checking]);

  const addBotMessage = (text: string, delay = 300) => {
    setTimeout(() => {
      setMessages((prev) => [...prev, { from: "bot", text }]);
    }, delay);
  };

  const moveToStep = (nextStep: Step) => {
    setStep(nextStep);
    if (nextStep === "confirm") {
      addBotMessage("Here's a summary of your suggestion:");
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
        const uniqueNames = [...new Set(events.map((e) => e.event_name))];
        const nameList = uniqueNames.slice(0, 3).join(", ");
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              from: "bot",
              text: `Heads up — we found similar events already on the calendar: ${nameList}. Would you like to continue with your suggestion anyway, or start over?`,
            },
          ]);
          setDuplicateWarning(true);
          setChecking(false);
        }, 300);
        return;
      }
    } catch {
      // proceed anyway if check fails
    }
    setChecking(false);
    moveToStep("business_unit");
  };

  const advance = (currentStep: Step, value: string, displayValue?: string) => {
    const display = displayValue !== undefined ? displayValue : value;
    if (display) {
      setMessages((prev) => [...prev, { from: "user", text: display }]);
    }
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
    const nextStep = getNextStep(currentStep);
    setInput("");
    moveToStep(nextStep);
  };

  const handleSkip = () => {
    setMessages((prev) => [...prev, { from: "user", text: "Skip" }]);
    const nextStep = getNextStep(step);
    setInput("");
    moveToStep(nextStep);
  };

  const handleTextSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (step === "event_name") {
      handleEventName(input.trim());
    } else {
      advance(step, input.trim());
    }
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
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "Your suggestion has been submitted! The team will review it and add it to the events calendar. Thank you!" },
      ]);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartOver = () => {
    setMessages([
      { from: "bot", text: "Hi! Use this form to suggest an event for TrustFlight to attend. I'll ask you a few questions." },
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
    <div className="flex flex-col h-full min-h-[calc(100vh-56px)] bg-slate-100">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-800 text-white px-6 py-4 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://www.trustflight.com/wp-content/uploads/2025/09/cropped-tf-favicon.jpg"
          alt="TrustFlight"
          width={32}
          height={32}
          className="rounded"
        />
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">TrustFlight</p>
          <p className="text-base font-semibold">Event Submissions</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-xl mx-auto space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.from === "bot"
                  ? "bg-white text-slate-800 shadow-sm rounded-tl-sm"
                  : "bg-slate-700 text-white rounded-tr-sm"
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {checking && (
            <div className="flex justify-start">
              <div className="bg-white px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm text-sm text-slate-400 italic">
                Checking calendar...
              </div>
            </div>
          )}

          {(step === "confirm" || step === "done") && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm p-4 w-full max-w-sm space-y-2">
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
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 bg-slate-50 border-t border-slate-200 px-4 py-4">
        <div className="max-w-xl mx-auto">
          {duplicateWarning && (
            <div className="flex gap-2">
              <button
                onClick={() => { setDuplicateWarning(false); moveToStep("business_unit"); }}
                className="flex-1 py-2.5 bg-slate-700 text-white rounded-full text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Continue anyway
              </button>
              <button
                onClick={handleStartOver}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-full text-sm hover:bg-slate-50 transition-colors"
              >
                Start over
              </button>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-2">
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 bg-slate-700 text-white rounded-full font-medium hover:bg-slate-800 transition-colors disabled:opacity-60 text-sm"
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
                    className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
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
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                  />
                ) : (
                  <input
                    type={isDateStep ? "date" : "text"}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isDateStep ? undefined : "Type here..."}
                    autoFocus
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                )}
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-slate-700 text-white rounded-full text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                  Send
                </button>
                {isOptionalStep && (
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="px-4 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-full text-sm hover:bg-slate-50 transition-colors"
                  >
                    Skip
                  </button>
                )}
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-slate-500 w-24 shrink-0 text-xs">{label}</span>
      <span className="text-slate-800 font-medium text-xs break-all">{value}</span>
    </div>
  );
}
