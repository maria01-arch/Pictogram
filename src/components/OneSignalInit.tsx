"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

declare global {
  interface Window {
    OneSignalDeferred?: any[];
  }
}

export default function OneSignalInit() {
  const [debug, setDebug] = useState<string>("starting…");

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

    if (!appId) {
      setDebug("NEXT_PUBLIC_ONESIGNAL_APP_ID is undefined at build time — env var missing or added after last build.");
      return;
    }
    setDebug(`appId present (${appId.slice(0, 8)}…). Loading SDK script…`);

    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.defer = true;
    script.onerror = () => setDebug((d) => d + " | SCRIPT FAILED TO LOAD (blocked or network error).");
    document.head.appendChild(script);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        setDebug((d) => d + " | Script loaded, calling init()…");
        await OneSignal.init({ appId });
        setDebug((d) => d + " | init() done.");

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await OneSignal.login(user.id);
          setDebug((d) => d + ` | logged in as ${user.id.slice(0, 8)}…`);
        } else {
          setDebug((d) => d + " | no logged-in user found.");
        }

        const supported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
        setDebug((d) => d + ` | Notification API supported: ${supported}`);

        const currentPermission = OneSignal.Notifications.permission;
        setDebug((d) => d + ` | current permission: ${currentPermission}`);

        if (!currentPermission) {
          const result = await OneSignal.Notifications.requestPermission();
          setDebug((d) => d + ` | requestPermission() result: ${result}`);
        }
      } catch (e) {
        setDebug((d) => d + ` | ERROR: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  }, []);

  return (
    <div className="fixed bottom-20 left-2 right-2 z-[200] break-words rounded-xl2 bg-black/80 p-2 text-[10px] text-white">
      {debug}
    </div>
  );
}
