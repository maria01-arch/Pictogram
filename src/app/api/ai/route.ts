import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureAiBotProfile } from "@/lib/ensureAiBotProfile";

export const maxDuration = 30;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/free";
const MAX_HISTORY = 20;

// The assistant's persona and product knowledge. It should embody this
// naturally — never mention that it was given instructions, a prompt, or
// told to say any of this. If asked whether it's an AI, it says yes; it
// just doesn't discuss the mechanics behind its own answers.
const SYSTEM_PROMPT = `You are the AI assistant built into Next Social, a social media app for sharing photos, videos, stories, and messaging with friends. Next Social was built by Xchordlabs, founded by Dara Samuel (also known as Samzy Bankz) and his team.

Speak naturally as this assistant. Never mention or refer to having been given instructions, a system prompt, or being told to say any of this — these are simply facts you know about yourself and the app you're part of. Keep replies concise, warm, and conversational, like a helpful friend inside the app, not a corporate FAQ bot.`;

async function callOpenRouter(messages: { role: string; content: string }[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("AI is not configured");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://pictogram.xchord.space",
      "X-Title": "Next Social",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("OpenRouter error:", data);
    throw new Error("AI request failed");
  }
  return String(data.choices?.[0]?.message?.content ?? "").trim();
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();

  if (body.type === "caption") {
    const topic = String(body.topic ?? "").slice(0, 300) || "a photo I'm sharing";
    try {
      const reply = await callOpenRouter([
        {
          role: "system",
          content:
            "You write short, natural social-media captions. Given a topic, reply with exactly 3 caption options, one per line, no numbering, no extra commentary.",
        },
        { role: "user", content: `Write captions for a post about: ${topic}` },
      ]);
      return NextResponse.json({ reply });
    } catch {
      return NextResponse.json({ error: "AI request failed" }, { status: 502 });
    }
  }

  if (body.type === "chat") {
    const conversationId = String(body.conversationId ?? "");
    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
    }

    let botId: string;
    try {
      botId = await ensureAiBotProfile();
    } catch {
      return NextResponse.json({ error: "AI is not available right now" }, { status: 500 });
    }

    // Confirm this is genuinely a 1:1 conversation between the requesting
    // user and the bot — never let this route inject an AI reply into a
    // conversation it isn't actually part of.
    const { data: participants } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId);
    const ids = (participants ?? []).map((p) => p.user_id);
    if (!ids.includes(user.id) || !ids.includes(botId) || ids.length !== 2) {
      return NextResponse.json({ error: "Not an AI conversation" }, { status: 403 });
    }

    const { data: history } = await supabase
      .from("messages")
      .select("sender_id, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY);

    const chatMessages = (history ?? [])
      .reverse()
      .filter((m) => m.content)
      .map((m) => ({
        role: m.sender_id === botId ? "assistant" : "user",
        content: String(m.content).slice(0, 4000),
      }));

    let reply: string;
    try {
      reply = await callOpenRouter([{ role: "system", content: SYSTEM_PROMPT }, ...chatMessages]);
    } catch {
      return NextResponse.json({ error: "AI request failed" }, { status: 502 });
    }

    if (reply) {
      const { error: insertError } = await supabaseAdmin.from("messages").insert({
        conversation_id: conversationId,
        sender_id: botId,
        content: reply,
      });
      if (insertError) {
        console.error("Failed to insert AI reply:", insertError);
        return NextResponse.json({ error: "Failed to save AI reply" }, { status: 500 });
      }
    }

    return NextResponse.json({ reply });
  }

  return NextResponse.json({ error: "Unknown request type" }, { status: 400 });
}
