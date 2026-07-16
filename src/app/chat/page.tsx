"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import ConversationList from "@/components/ConversationList";
import ChatWindow from "@/components/ChatWindow";

function ChatPageInner() {
  const searchParams = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(searchParams.get("conversation"));

  return (
    <div>
      {!activeId ? (
        <ConversationList activeId={activeId} onSelect={setActiveId} />
      ) : (
        <div>
          <button onClick={() => setActiveId(null)} className="flex items-center gap-1 px-4 py-3 text-sm font-medium text-brand-from">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <ChatWindow conversationId={activeId} />
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-sm text-ink-muted">Loading…</p>}>
      <ChatPageInner />
    </Suspense>
  );
}
