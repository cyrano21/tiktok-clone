/**
 * Encapsulates the official-TikTok connection lifecycle for the UI:
 *  - reads current status from the backend (configured / connected)
 *  - handles the post-OAuth return redirect (?tiktok=connected|error)
 *  - exposes connect / disconnect / publish actions with typed feedback
 *
 * Keeping this here means screens stay presentational and don't duplicate the
 * orchestration logic. If a second surface needs TikTok publishing later
 * (e.g. the studio), it reuses this hook instead of re-implementing it.
 */

import { useCallback, useEffect, useState } from "react";
import {
  getTikTokStatus,
  connectTikTok,
  disconnectTikTok,
  publishToTikTok,
  readConnectRedirect,
  type TikTokStatus,
  type TikTokCapabilities,
  type PublishVideoInput,
  type PublishResult,
  type TikTokResult,
} from "@/services/tiktokOAuth";

const NO_CAPABILITIES: TikTokCapabilities = {
  canReadProfile: false,
  canListVideos: false,
  canPublish: false,
  canUploadDraft: false,
};

interface State {
  loading: boolean;
  configured: boolean;
  connected: boolean;
  displayName: string | null;
  capabilities: TikTokCapabilities;
  /** Last user-facing message (success or error). */
  message: string | null;
}

const initialState: State = {
  loading: true,
  configured: false,
  connected: false,
  displayName: null,
  capabilities: NO_CAPABILITIES,
  message: null,
};

export function useTikTokConnect() {
  const [state, setState] = useState<State>(initialState);

  const applyStatus = useCallback(
    (status: TikTokStatus, message?: string | null) => {
      setState(prev => ({
        ...prev,
        loading: false,
        configured: status.configured,
        connected: status.connected,
        displayName: status.account?.displayName ?? null,
        capabilities: status.capabilities ?? NO_CAPABILITIES,
        message: message ?? prev.message,
      }));
    },
    [],
  );

  const refresh = useCallback(async () => {
    const res = await getTikTokStatus();
    if (res.ok) {
      applyStatus(res.data);
    } else {
      // Network / not-authenticated → integration simply unavailable right now.
      setState(prev => ({
        ...prev,
        loading: false,
        configured: false,
        connected: false,
        capabilities: NO_CAPABILITIES,
        message: res.code === "NETWORK" ? null : prev.message,
      }));
    }
  }, [applyStatus]);

  // Handle the OAuth return redirect once on mount, then load status.
  useEffect(() => {
    const redirect = readConnectRedirect();
    if (redirect?.status === "connected") {
      setState(prev => ({ ...prev, message: "✓ Compte TikTok connecté." }));
    } else if (redirect?.status === "error") {
      setState(prev => ({
        ...prev,
        message: `Connexion TikTok échouée${redirect.reason ? ` (${redirect.reason})` : ""}.`,
      }));
    }
    refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, message: "Redirection vers TikTok…" }));
    const res = await connectTikTok();
    if (!res.ok) {
      setState(prev => ({ ...prev, message: res.message }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    const res = await disconnectTikTok();
    if (res.ok) {
      setState(prev => ({
        ...prev,
        connected: false,
        displayName: null,
        message: "Compte TikTok déconnecté.",
      }));
    } else {
      setState(prev => ({ ...prev, message: res.message }));
    }
  }, []);

  const publish = useCallback(
    async (input: PublishVideoInput): Promise<TikTokResult<PublishResult>> => {
      const res = await publishToTikTok(input);
      setState(prev => ({
        ...prev,
        message: res.ok
          ? res.data.mode === "direct_post"
            ? "✓ Vidéo envoyée à TikTok (publication directe)."
            : "✓ Vidéo envoyée dans tes brouillons TikTok."
          : res.message,
      }));
      return res;
    },
    [],
  );

  return {
    ...state,
    connect,
    disconnect,
    publish,
    refresh,
  };
}
