"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

declare global {
  interface Window {
    OneSignalDeferred?: any[];
  }
}

export default function OneSignalInit() {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId) return;

    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.defer = true;
    document.head.appendChild(script);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      await OneSignal.init({ appId });

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await OneSignal.login(user.id);
      }

      if (!OneSignal.Notifications.permission) {
        await OneSignal.Notifications.requestPermission();
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      window.OneSignalDeferred?.push(async (OneSignal: any) => {
        if (session?.user) {
          await OneSignal.login(session.user.id);
          if (!OneSignal.Notifications.permission) {
            await OneSignal.Notifications.requestPermission();
          }
        } else {
          await OneSignal.logout();
        }
      });
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
