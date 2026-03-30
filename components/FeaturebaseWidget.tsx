"use client";

import { useEffect } from "react";
import Script from "next/script";

const FeaturebaseWidget = () => {
  useEffect(() => {
    const win = window as any;

    if (typeof win.Featurebase !== "function") {
      win.Featurebase = function () {
        // eslint-disable-next-line prefer-rest-params
        (win.Featurebase.q = win.Featurebase.q || []).push(arguments);
      };
    }

    const initWidgets = async () => {
      let featurebaseJwt: string | undefined;
      let usersName: string | undefined;

      try {
        const res = await fetch("/api/featurebase-jwt");
        if (res.ok) {
          const json = await res.json();
          featurebaseJwt = json.token;
          usersName = json.name; // passed through for the changelog popup greeting
        }
      } catch {
        // Network error — continue without JWT
      }

      // ── Feedback widget (floating button, right side) ────────────────────
      win.Featurebase("initialize_feedback_widget", {
        organization: "lumidex",
        theme: "dark",
        placement: "right",
        locale: "en",
        metadata: null,
        ...(featurebaseJwt ? { featurebaseJwt } : {}),
      });

      // ── Changelog widget (card + dropdown + popup for new updates) ────────
      win.Featurebase("init_changelog_widget", {
        organization: "lumidex",
        theme: "dark",
        locale: "en",
        changelogCard: {
          enabled: true,
        },
        dropdown: {
          enabled: true,
          placement: "right",
        },
        popup: {
          enabled: true,
          autoOpenForNewUpdates: true,
          ...(usersName ? { usersName } : {}),
        },
        ...(featurebaseJwt ? { featurebaseJwt } : {}),
      });
    };

    initWidgets();
  }, []);

  return (
    <Script
      src="https://do.featurebase.app/js/sdk.js"
      id="featurebase-sdk"
      strategy="afterInteractive"
    />
  );
};

export default FeaturebaseWidget;
