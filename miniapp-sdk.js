(function () {
  "use strict";

  const MESSAGE_SOURCE = "miniapp-platform-widget";
  const DEFAULT_CONTEXT_TIMEOUT_MS = 700;
  const AUTH_TOKENS_STORAGE_KEY = "authTokens";

  const listeners = new Map();
  let currentContext = null;
  let lastInitOptions = null;

  function getSearchParams() {
    return new URLSearchParams(window.location.search);
  }

  function normalizeBaseUrl(value) {
    if (!value) {
      return "";
    }

    return String(value).replace(/\/$/, "");
  }

  function getReferrerOrigin() {
    try {
      if (!document.referrer) {
        return "";
      }

      return new URL(document.referrer).origin;
    } catch {
      return "";
    }
  }

  function getPlatformApiBase(options) {
    const params = getSearchParams();
    const configured =
      params.get("api_base") ||
      params.get("platform_origin") ||
      window.MINIAPP_PLATFORM_API ||
      options.apiBase ||
      getReferrerOrigin();

    return normalizeBaseUrl(configured);
  }

  function getLaunchToken() {
    const params = getSearchParams();

    return params.get("launch_token") || params.get("sessionId") || "";
  }

  function getStoredAccessToken() {
    try {
      const rawTokens = window.localStorage.getItem(AUTH_TOKENS_STORAGE_KEY);

      if (!rawTokens) {
        return "";
      }

      const tokens = JSON.parse(rawTokens);

      return typeof tokens?.access_token === "string" ? tokens.access_token : "";
    } catch {
      return "";
    }
  }

  function getAccessToken() {
    const params = getSearchParams();

    return (
      params.get("access_token") ||
      params.get("token") ||
      window.MINIAPP_ACCESS_TOKEN ||
      getStoredAccessToken()
    );
  }

  function postToHost(type, payload) {
    const message = {
      source: MESSAGE_SOURCE,
      miniappId: lastInitOptions?.miniappId || "unknown",
      type,
      payload: payload || {},
      timestamp: new Date().toISOString(),
    };

    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, "*");
    }

    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }

  function emitLocal(type, payload) {
    const handlers = listeners.get(type);

    if (!handlers) {
      return;
    }

    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.warn("MiniappSDK listener failed:", error);
      }
    });
  }

  function acceptHostContext(context, meta) {
    if (!context) {
      return;
    }

    currentContext = context;
    emitLocal("context", {
      context: currentContext,
      mode: meta?.mode || "host",
      source: "host",
    });
  }

  function waitForHostContext(timeoutMs) {
    return new Promise((resolve) => {
      let settled = false;

      const done = (context, meta) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(context ? { context, meta } : null);
      };

      const timer = window.setTimeout(() => done(null), timeoutMs);

      function onMessage(event) {
        const data = event.data;

        if (!data || typeof data !== "object") {
          return;
        }

        const type = data.type;

        if (type === "MINIAPP_CONTEXT" || type === "HOST_CONTEXT" || type === "miniapp:context") {
          const context = data.payload || data.context;
          const meta = {
            mode: "host",
            origin: event.origin,
          };

          acceptHostContext(context, meta);
          window.clearTimeout(timer);
          done(context, meta);
        }

        if (type === "MINIAPP_LOGOUT" || type === "HOST_LOGOUT" || type === "miniapp:logout") {
          emitLocal("logout", data.payload || {});
        }

        if (type === "MINIAPP_THEME" || type === "HOST_THEME" || type === "miniapp:theme") {
          emitLocal("theme", data.payload || {});
        }
      }

      window.addEventListener("message", onMessage);
      postToHost("MINIAPP_READY", {
        wantsContext: true,
        supports: ["context", "events", "logout", "resize"],
      });
      postToHost("MINIAPP_CONTEXT_REQUESTED", {});
    });
  }

  async function fetchContextByLaunchToken(options) {
    const launchToken = getLaunchToken();

    if (!launchToken) {
      return null;
    }

    const apiBase = getPlatformApiBase(options);
    const url = `${apiBase}/api/miniapp-sessions/${encodeURIComponent(launchToken)}`;

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Miniapp session request failed: ${response.status}`);
    }

    return {
      context: await response.json(),
      meta: {
        mode: "launch_token",
        apiBase: apiBase || window.location.origin,
      },
    };
  }

  async function fetchContextByAccessToken(options) {
    const accessToken = getAccessToken();

    if (!accessToken) {
      return null;
    }

    const apiBase = getPlatformApiBase(options);
    const url = `${apiBase}/api/auth/me`;

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Miniapp auth context request failed: ${response.status}`);
    }

    const user = await response.json();

    return {
      context: {
        user,
        miniapp: {
          id: lastInitOptions?.miniappId || "unknown",
          title: lastInitOptions?.miniappName || "Miniapp",
        },
        expires_at: null,
      },
      meta: {
        mode: "access_token",
        apiBase: apiBase || window.location.origin,
      },
    };
  }

  async function init(options) {
    lastInitOptions = {
      miniappId: options.miniappId,
      miniappName: options.miniappName,
      apiBase: options.apiBase || "",
    };

    const hostContext = await waitForHostContext(
      options.contextTimeoutMs || DEFAULT_CONTEXT_TIMEOUT_MS
    );

    if (hostContext?.context) {
      currentContext = hostContext.context;

      return {
        context: currentContext,
        mode: hostContext.meta.mode,
        source: "host",
      };
    }

    try {
      const session = await fetchContextByLaunchToken(options);

      if (session?.context) {
        currentContext = session.context;

        return {
          context: currentContext,
          mode: session.meta.mode,
          source: "api",
        };
      }
    } catch (error) {
      console.debug("Miniapp session context unavailable:", error);
    }

    try {
      const authContext = await fetchContextByAccessToken(options);

      if (authContext?.context) {
        currentContext = authContext.context;

        return {
          context: currentContext,
          mode: authContext.meta.mode,
          source: "api",
        };
      }
    } catch (error) {
      console.warn("Miniapp auth context unavailable:", error);
    }

    currentContext = options.mockContext;

    return {
      context: currentContext,
      mode: "mock",
      source: "mock",
    };
  }

  function on(type, handler) {
    if (!listeners.has(type)) {
      listeners.set(type, new Set());
    }

    listeners.get(type).add(handler);

    return () => off(type, handler);
  }

  function off(type, handler) {
    listeners.get(type)?.delete(handler);
  }

  function emit(type, payload) {
    emitLocal(type, payload);
    postToHost(type, payload);
  }

  function reportHeight() {
    const height = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );

    postToHost("MINIAPP_RESIZE", { height });
  }

  function getContext() {
    return currentContext;
  }

  function close(payload) {
    postToHost("MINIAPP_CLOSE_REQUESTED", payload || {});
  }

  window.MiniappSDK = {
    close,
    emit,
    getAccessToken,
    getContext,
    getLaunchToken,
    init,
    off,
    on,
    reportHeight,
  };
})();
