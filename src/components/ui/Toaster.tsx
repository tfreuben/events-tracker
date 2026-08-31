"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useToastStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// Errors stay up long enough to read a database message and act on it; successes
// are just an acknowledgement and get out of the way.
const DURATION: Record<string, number> = {
  error: 10000,
  success: 4000,
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((toast) => {
        const isError = toast.variant === "error";
        const Icon = isError ? AlertCircle : CheckCircle2;

        return (
          <ToastPrimitive.Root
            key={toast.id}
            duration={DURATION[toast.variant]}
            onOpenChange={(open) => {
              if (!open) dismiss(toast.id);
            }}
            className={cn(
              "flex items-start gap-3 w-full p-4 rounded-lg border shadow-lg bg-white",
              "data-[state=open]:animate-toast-in data-[state=closed]:animate-toast-out",
              "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
              "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
              "data-[swipe=end]:animate-toast-out",
              isError ? "border-red-200" : "border-green-200"
            )}
          >
            <Icon
              size={18}
              className={cn("shrink-0 mt-0.5", isError ? "text-red-600" : "text-green-600")}
            />
            <div className="flex-1 min-w-0">
              <ToastPrimitive.Title className="text-sm font-medium text-slate-900">
                {toast.title}
              </ToastPrimitive.Title>
              {toast.description && (
                <ToastPrimitive.Description className="mt-1 text-sm text-slate-600 break-words">
                  {toast.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className="shrink-0 p-1 -m-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X size={15} />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex flex-col gap-2 w-full max-w-sm p-4 m-0 list-none outline-none" />
    </ToastPrimitive.Provider>
  );
}
