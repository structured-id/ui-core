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
    expect(store.displayName).toBeNull();
    expect(store.email).toBeNull();
  });

  it("setBffSession sets sessionValid and profile data", () => {
    const store = useAuthStore();
    store.setBffSession({
      sub: "subject-123",
      email: "alice@example.com",
      name: "Alice Smith",
      preferred_username: "alice",
      acr: "urn:sid:acr:mfa",
    });

    expect(store.isAuthenticated).toBe(true);
    expect(store.sessionValid).toBe(true);
    expect(store.displayName).toBe("Alice Smith");
    expect(store.email).toBe("alice@example.com");
    expect(store.preferredUsername).toBe("alice");
  });

  // Regression: the userinfo `sub` was kept as the user's ProfileId, though
  // it is the subject this application knows the user by. The store keeps
  // no Profile id at all.
  it("never reads the subject as a Profile id", () => {
    const store = useAuthStore();
    store.setBffSession({ sub: "subject-456" });

    expect(store.isAuthenticated).toBe(true);
    expect("profileId" in store).toBe(false);
    expect(store.displayName).toBeNull();
    expect(store.email).toBeNull();
    expect(store.preferredUsername).toBeNull();
  });

  it("setProfile updates display data", () => {
    const store = useAuthStore();
    store.setBffSession({ sub: "subject-1" });

    store.setProfile({
      displayName: "Bob Jones",
      email: "bob@example.com",
    });

    expect(store.displayName).toBe("Bob Jones");
    expect(store.email).toBe("bob@example.com");
  });

  it("logout clears all state", () => {
    const store = useAuthStore();
    store.setBffSession({
      sub: "subject-1",
      name: "Alice",
      email: "alice@example.com",
      preferred_username: "alice",
    });

    store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(store.sessionValid).toBe(false);
    expect(store.displayName).toBeNull();
    expect(store.email).toBeNull();
    expect(store.preferredUsername).toBeNull();
  });
});
