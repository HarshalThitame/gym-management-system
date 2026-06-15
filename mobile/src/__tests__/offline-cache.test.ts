import { offlineCache } from "@/offline/cache";

describe("OfflineCache", () => {
  const testKey = "test:cache:key";
  const testData = { name: "Test Member", id: "123" };

  afterEach(async () => {
    await offlineCache.evict(testKey);
  });

  it("should store and retrieve cached data", async () => {
    await offlineCache.set(testKey, testData, { ttlMs: 60000 });
    const result = await offlineCache.get<typeof testData>(testKey);
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(testData);
    expect(result!.stale).toBe(false);
  });

  it("should return null for missing keys", async () => {
    const result = await offlineCache.get("nonexistent:key");
    expect(result).toBeNull();
  });

  it("should support stale-while-revalidate", async () => {
    await offlineCache.set(testKey, testData, {
      ttlMs: -1,
      staleWhileRevalidate: true,
    });
    const result = await offlineCache.get<typeof testData>(testKey);
    expect(result).not.toBeNull();
    expect(result!.stale).toBe(true);
    expect(result!.data).toEqual(testData);
  });

  it("should build correct cache keys", () => {
    expect(offlineCache.memberKey("123", "dashboard")).toBe("member:123:dashboard");
    expect(offlineCache.trainerKey("456", "sessions")).toBe("trainer:456:sessions");
    expect(offlineCache.organizationKey("789", "offers")).toBe("org:789:offers");
  });

  it("should evict cached data", async () => {
    await offlineCache.set(testKey, testData);
    await offlineCache.evict(testKey);
    const result = await offlineCache.get(testKey);
    expect(result).toBeNull();
  });
});
