"use client";

import { useState } from "react";
import ConversationList from "@/components/ConversationList";
import ChatWindow from "@/components/ChatWindow";

export default function ChatPage() {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div>
      {/* Mobile: show either the list or the active thread, never both */}
      {!activeId ? (
        <ConversationList activeId={activeId} onSelect={setActiveId} />
      ) : (
        <div>
          <button
            onClick={() => setActiveId(null)}
            className="flex items-center gap-1 px-4 py-3 text-sm font-medium text-brand-from"
          >
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
