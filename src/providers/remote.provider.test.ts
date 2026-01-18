import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { RemoteProvider } from "./remote.provider.js";

const endpoint = "https://salt.example.com/get_salt";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("RemoteProvider", () => {
  it("retries and returns salt on success", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ salt: "0xabc" }),
    });

    const provider = new RemoteProvider({
      type: "remote",
      endpoint,
      retryCount: 1,
    });

    const salt = await provider.getSalt("user-1", "aud-1", "jwt-token");

    expect(salt).toBe("0xabc");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({ sub: "user-1", aud: "aud-1", jwt: "jwt-token" })
    );
  });

  it("returns unhealthy result when health endpoint fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });

    const provider = new RemoteProvider({ type: "remote", endpoint });
    const result = await provider.healthCheck();

    expect(result.healthy).toBe(false);
    expect(result.message).toContain("503");
  });
});
