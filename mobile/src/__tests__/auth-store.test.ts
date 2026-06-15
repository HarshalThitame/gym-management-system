import { useAuthStore } from "@/state/auth/auth-store";

describe("AuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      isInitialized: false,
      isLoading: false,
      isAuthenticated: false,
      user: null,
      error: null,
    });
  });

  it("should initialize with default state", () => {
    const state = useAuthStore.getState();
    expect(state.isInitialized).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.error).toBeNull();
  });

  it("should clear error", () => {
    useAuthStore.setState({ error: "Test error" });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });

  it("should update user", () => {
    const mockUser = {
      userId: "test-id",
      email: "test@test.com",
      roles: ["member"],
      primaryRole: "member" as const,
      isAuthenticated: true,
      isActive: true,
      profile: null,
      organizationId: null,
    };

    useAuthStore.setState({ isAuthenticated: true, user: mockUser as any });
    useAuthStore.getState().updateUser({ email: "updated@test.com" });
    expect(useAuthStore.getState().user?.email).toBe("updated@test.com");
  });

  it("should handle logout", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { userId: "test" } as any,
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });
});
