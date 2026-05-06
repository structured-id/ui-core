import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "./auth";

describe("useAuthStore (BFF cookie session)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts unauthenticated with empty state", () => {
    const store = useAuthStore();
    expect(store.isAuthenticated).toBe(false);
    expect(store.sessionValid).toBe(false);
    expect(store.profileId).toBeNull();
    expect(store.displayName).toBeNull();
    expect(store.email).toBeNull();
  });

  it("setBffSession sets sessionValid and profile data", () => {
    const store = useAuthStore();
    store.setBffSession({
      sub: "profile-uuid-123",
      email: "alice@example.com",
      name: "Alice Smith",
      preferred_username: "alice",
      groups: ["admins"],
      acr: "urn:sid:acr:mfa",
      roles: ["member"],
    });

    expect(store.isAuthenticated).toBe(true);
    expect(store.sessionValid).toBe(true);
    expect(store.profileId).toBe("profile-uuid-123");
    expect(store.displayName).toBe("Alice Smith");
    expect(store.email).toBe("alice@example.com");
    expect(store.preferredUsername).toBe("alice");
  });

  it("setBffSession handles null/missing optional fields", () => {
    const store = useAuthStore();
    store.setBffSession({ sub: "uuid-456" });

    expect(store.isAuthenticated).toBe(true);
    expect(store.profileId).toBe("uuid-456");
    expect(store.displayName).toBeNull();
    expect(store.email).toBeNull();
    expect(store.preferredUsername).toBeNull();
  });

  it("setProfile updates display data", () => {
    const store = useAuthStore();
    store.setBffSession({ sub: "uuid-1" });

    store.setProfile({
      id: "uuid-1",
      displayName: "Bob Jones",
      email: "bob@example.com",
    });

    expect(store.profileId).toBe("uuid-1");
    expect(store.displayName).toBe("Bob Jones");
    expect(store.email).toBe("bob@example.com");
  });

  it("logout clears all state", () => {
    const store = useAuthStore();
    store.setBffSession({
      sub: "uuid-1",
      name: "Alice",
      email: "alice@example.com",
      preferred_username: "alice",
    });

    store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(store.sessionValid).toBe(false);
    expect(store.profileId).toBeNull();
    expect(store.displayName).toBeNull();
    expect(store.email).toBeNull();
    expect(store.preferredUsername).toBeNull();
  });
});
