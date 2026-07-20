"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  getMyDatingProfile,
  enableDating,
  fetchCandidates,
  likeUser,
  fetchMatches,
  type DatingCandidate,
  type DatingMatchSummary,
} from "@/lib/dating";
import { getErrorMessage } from "@/lib/errorMessage";
import { getOrCreateDirectConversation } from "@/lib/conversations";
import VerifiedBadge from "./VerifiedBadge";

type Tab = "search" | "matches";
type SearchState = "idle" | "searching" | "results";

const SEARCH_DURATION_MS = 2400;

export default function DatingView() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("search");
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [candidates, setCandidates] = useState<DatingCandidate[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [matchedProfile, setMatchedProfile] = useState<DatingCandidate | null>(null);

  const [matches, setMatches] = useState<DatingMatchSummary[]>([]);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    getMyDatingProfile().then((profile) => {
      setEnabled(!!profile?.enabled);
      setBioDraft(profile?.bio ?? "");
      setLoading(false);
    });

    return () => {
      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current);
    };
  }, []);

  useEffect(() => {
    if (tab === "matches") fetchMatches().then(setMatches);
  }, [tab]);

  async function handleEnable() {
    setError(null);
    try {
      await enableDating(bioDraft);
      setEnabled(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleFindOnline() {
    setError(null);
    setSearchState("searching");
    setCandidateIndex(0);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const channel = supabase.channel("presence:dating", { config: { presence: { key: user.id } } });
    presenceChannelRef.current = channel;

    let latestOnlineIds: string[] = [];

    // The 'sync' event fires once the server has broadcast the current
    // presence set back to us — reading presenceState() cold right after
    // track() can miss that round trip.
    channel.on("presence", { event: "sync" }, () => {
      latestOnlineIds = Object.keys(channel.presenceState());
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    setTimeout(async () => {
      const onlineIds = latestOnlineIds;
      try {
        const results = await fetchCandidates(onlineIds);
        setCandidates(results);
        setSearchState("results");
      } catch (err) {
        setError(getErrorMessage(err));
        setSearchState("idle");
      }
    }, SEARCH_DURATION_MS);
  }

  async function handleLike(candidate: DatingCandidate) {
    setError(null);
    try {
      const isMatch = await likeUser(candidate.profile.id);
      if (isMatch) {
        setMatchedProfile(candidate);
      }
      advance();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function handlePass() {
    advance();
  }

  function advance() {
    setCandidateIndex((i) => i + 1);
  }

  async function handleMessageMatch(userId: string) {
    try {
      const conversationId = await getOrCreateDirectConversation(userId);
      router.push(`/chat/${conversationId}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (loading) return <p className="px-4 py-16 text-center text-sm text-ink-muted">Loading…</p>;

  if (!enabled) {
    return (
      <div className="px-4 pb-8 pt-6">
        <h2 className="text-lg font-bold">Dating</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Opt in to be discoverable by other people currently online, and find people looking to match right now.
        </p>

        <textarea
          value={bioDraft}
          onChange={(e) => setBioDraft(e.target.value)}
          placeholder="A short line about yourself…"
          rows={4}
          className="mt-4 w-full rounded-xl2 bg-black/5 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
        />

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <button onClick={handleEnable} className="mt-4 w-full rounded-full bg-brand-gradient py-3 text-sm font-semibold text-white">
          Start dating
        </button>
      </div>
    );
  }

  const currentCandidate = candidates[candidateIndex];

  return (
    <div className="px-4 pb-8 pt-4">
      <div className="mb-4 flex gap-2 rounded-full bg-black/5 p-1 dark:bg-white/10">
        {(["search", "matches"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold capitalize transition ${
              tab === t ? "bg-brand-gradient text-white" : "text-ink-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {tab === "search" && (
        <div>
          {searchState === "idle" && (
            <div className="flex flex-col items-center gap-4 py-16">
              <p className="text-center text-sm text-ink-muted">Ready to see who's online right now?</p>
              <button
                onClick={handleFindOnline}
                className="rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold text-white"
              >
                Find who is online
              </button>
            </div>
          )}

          {searchState === "searching" && (
            <div className="flex flex-col items-center gap-5 py-20">
              <div className="relative h-24 w-24">
                <div className="absolute inset-0 animate-ping rounded-full bg-brand-from/30" />
                <div className="absolute inset-3 animate-ping rounded-full bg-brand-from/40 [animation-delay:200ms]" />
                <div className="absolute inset-6 rounded-full bg-brand-gradient" />
              </div>
              <p className="text-sm text-ink-muted">Searching for people online…</p>
            </div>
          )}

          {searchState === "results" && (
            <div>
              {!currentCandidate ? (
                <div className="flex flex-col items-center gap-4 py-16">
                  <p className="text-center text-sm text-ink-muted">
                    {candidates.length === 0
                      ? "No one else is online right now. Try again in a bit."
                      : "That's everyone online right now."}
                  </p>
                  <button
                    onClick={() => setSearchState("idle")}
                    className="rounded-full bg-black/5 px-5 py-2.5 text-sm font-semibold dark:bg-white/10"
                  >
                    Search again
                  </button>
                </div>
              ) : (
                <div className="mx-auto max-w-xs overflow-hidden rounded-xl2 glass-card">
                  <div className="flex h-64 w-full items-center justify-center bg-brand-gradient">
                    <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white/80">
                      {currentCandidate.profile.avatar_url && (
                        <img src={currentCandidate.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="flex items-center gap-1 text-base font-bold">
                      {currentCandidate.profile.username}
                      {currentCandidate.profile.is_verified && <VerifiedBadge size={14} />}
                    </p>
                    {currentCandidate.bio && <p className="mt-1 text-sm text-ink-muted">{currentCandidate.bio}</p>}
                  </div>
                  <div className="flex border-t border-black/5 dark:border-white/5">
                    <button onClick={handlePass} className="flex-1 py-3 text-sm font-semibold text-ink-muted">
                      Pass
                    </button>
                    <button onClick={() => handleLike(currentCandidate)} className="flex-1 border-l border-black/5 py-3 text-sm font-semibold text-brand-from dark:border-white/5">
                      Like
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "matches" && (
        <div>
          {matches.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-muted">No matches yet.</p>
          ) : (
            matches.map((m) => (
              <div key={m.profile.id} className="mb-2 flex items-center gap-3 rounded-xl2 glass-card px-3 py-2.5">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-brand-gradient">
                  {m.profile.avatar_url && <img src={m.profile.avatar_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <p className="flex-1 text-sm font-semibold">{m.profile.username}</p>
                <button
                  onClick={() => handleMessageMatch(m.profile.id)}
                  className="rounded-full bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Message
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {matchedProfile && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/80 px-6" onClick={() => setMatchedProfile(null)}>
          <p className="bg-brand-gradient bg-clip-text text-3xl font-bold text-transparent">It's a match!</p>
          <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white">
            {matchedProfile.profile.avatar_url && (
              <img src={matchedProfile.profile.avatar_url} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <p className="text-white">You and {matchedProfile.profile.username} liked each other.</p>
          <button
            onClick={(e) => { e.stopPropagation(); handleMessageMatch(matchedProfile.profile.id); }}
            className="rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold text-white"
          >
            Send a message
          </button>
          <button onClick={() => setMatchedProfile(null)} className="text-sm text-white/70">
            Keep browsing
          </button>
        </div>
      )}
    </div>
  );
}
