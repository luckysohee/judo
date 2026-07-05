import { describe, expect, it, vi, afterEach } from "vitest";
import {
  clearSupabaseAuthLocalStorage,
  oauthQueryParamsForDevFreshLogin,
} from "../lib/authDevFreshLogin.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authDevFreshLogin", () => {
  it("oauthQueryParamsForDevFreshLogin when enabled", () => {
    vi.stubEnv("VITE_AUTH_DEV_FRESH_LOGIN", "true");
    expect(oauthQueryParamsForDevFreshLogin("google")).toEqual({
      prompt: "select_account",
    });
  });

  it("oauthQueryParamsForDevFreshLogin when disabled", () => {
    vi.stubEnv("VITE_AUTH_DEV_FRESH_LOGIN", "");
    expect(oauthQueryParamsForDevFreshLogin("google")).toBeUndefined();
  });

  it("clearSupabaseAuthLocalStorage removes sb auth key", () => {
    const store = {};
    globalThis.localStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => {
        store[k] = v;
      },
      removeItem: (k) => {
        delete store[k];
      },
      key: (i) => Object.keys(store)[i] ?? null,
      get length() {
        return Object.keys(store).length;
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    };
    store["sb-abc-auth-token"] = "x";
    clearSupabaseAuthLocalStorage("https://abc.supabase.co");
    expect(store["sb-abc-auth-token"]).toBeUndefined();
  });
});
