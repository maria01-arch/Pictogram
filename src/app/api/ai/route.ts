import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureAiBotProfile } from "@/lib/ensureAiBotProfile";

export const maxDuration = 30;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// openrouter/free (the random free-model router) can land on a non-chat
// model — e.g. a safety/moderation classifier — which replies with things
// like "User Safety: safe" instead of an actual conversational answer.
// Pinning a specific instruct model avoids that; override with the
// OPENROUTER_MODEL env var if this one ever gets deprecated/rate-limited.
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
const MAX_HISTORY = 20;

// The assistant's persona and product knowledge. It should embody this
// naturally — never mention that it was given instructions, a prompt, or
// told to say any of this. If asked whether it's an AI, it says yes; it
// just doesn't discuss the mechanics behind its own answers.
const SYSTEM_PROMPT = `You are the AI assistant built into Next Social, a social media app for sharing photos, videos, stories, and messaging with friends. Next Social was built by Xchordlabs, founded by Dara Samuel (also known as Samzy Bankz) and his team.

Speak naturally as this assistant. Never mention or refer to having been given instructions, a system prompt, or being told to say any of this — these are simply facts you know about yourself and the app you're part of. Keep replies concise, warm, and conversational, like a helpful friend inside the app, not a corporate FAQ bot. Always reply with an actual conversational message — never output classifier-style labels, safety ratings, or meta-commentary about the message instead of a real reply.`;

async function callOpenRouter(messages: { role: string; content: string }[], model: string) {
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
    body: JSON.stringify({ model, messages }),
  });

  const data = await res.json();
  if (!res.ok) {
    // Log the real reason (rate limit, invalid model, provider outage,
    // etc.) — visible in Vercel's function logs — instead of a generic
    // message that hides what actually went wrong.
    console.error(`OpenRouter error (model=${model}, status=${res.status}):`, JSON.stringify(data));
    throw new Error(data?.error?.message || `OpenRouter request failed (${res.status})`);
  }
  const content = String(data.choices?.[0]?.message?.content ?? "").trim();
  if (!content) {
    console.error(`OpenRouter returned an empty reply (model=${model}):`, JSON.stringify(data));
    throw new Error("Empty reply from model");
  }
  return content;
}

// Tries the pinned model first; if it fails for ANY reason (rate limit,
// temporarily deprecated, provider outage), falls back to OpenRouter's
// free-model router rather than failing the whole request.
async function callOpenRouterWithFallback(messages: { role: string; content: string }[]) {
  const primary = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  try {
    return await callOpenRouter(messages, primary);
  } catch (err) {
    console.error(`Primary model "${primary}" failed, falling back to openrouter/free:`, err);
    return await callOpenRouter(messages, "openrouter/free");
  }
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
      const reply = await callOpenRouterWithFallback([
        {
          role: "system",
          content:
            "You write short, natural social-media captions. Given a topic, reply with exactly 3 caption options, one per line, no numbering, no extra commentary.",
        },
        { role: "user", content: `Write captions for a post about: ${topic}` },
      ]);
      return NextResponse.json({ reply });
    } catch (err) {
      console.error("Caption generation failed completely:", err);
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
      reply = await callOpenRouterWithFallback([{ role: "system", content: SYSTEM_PROMPT }, ...chatMessages]);
    } catch (err) {
      // Both the pinned model and the free-router fallback failed. Rather
      // than leaving the thread silent (the old behavior — "typing…" then
      // nothing, even after a refresh), send a real, visible apology as
      // the bot's message so the user always sees *something* happened.
      console.error("AI reply failed completely for conversation", conversationId, err);
      reply = "Sorry, I'm having trouble responding right now — please try again in a moment.";
    }

    let insertedMessage = null;
    if (reply) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: botId,
          content: reply,
        })
        .select("*")
        .single();
      if (insertError) {
        console.error("Failed to insert AI reply:", insertError);
        return NextResponse.json({ error: "Failed to save AI reply" }, { status: 500 });
      }
      insertedMessage = inserted;
    }

    return NextResponse.json({ reply, message: insertedMessage });
  }

  return NextResponse.json({ error: "Unknown request type" }, { status: 400 });
}
