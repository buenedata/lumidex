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
          usersName = json.name;
        }
      } catch {
        // Network error — continue without JWT
      }

      // ── Embed widget (inline Featurebase board) ──────────────────────────
      win.Featurebase("init_embed_widget", {
        organization: "lumidex",
        embedOptions: {
          path: "/",
          filters: "",
        },
        stylingOptions: {
          theme: "dark",
          hideMenu: false,
          hideLogo: false,
        },
        locale: "en",
        ...(featurebaseJwt
          ? { user: { jwt: featurebaseJwt } }
          : {}),
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
    <>
      <Script
        src="https://do.featurebase.app/js/sdk.js"
        id="featurebase-sdk"
        strategy="afterInteractive"
      />
      <div data-featurebase-embed></div>
    </>
  );
};

export default FeaturebaseWidget;
