"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  user_id: string;
  name: string;
  role: "patient" | "receptionist" | "doctor" | "admin";
  access_token: string;
}

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => {
        localStorage.setItem("queuecare_token", user.access_token);
        if (typeof window !== "undefined") {
          document.cookie = `queuecare_token=${user.access_token}; path=/; max-age=86400; SameSite=Lax`;
          document.cookie = `queuecare_role=${user.role}; path=/; max-age=86400; SameSite=Lax`;
        }
        set({ user });
      },
      logout: () => {
        localStorage.removeItem("queuecare_token");
        localStorage.removeItem("queuecare_user");
        if (typeof window !== "undefined") {
          document.cookie = "queuecare_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax";
          document.cookie = "queuecare_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax";
        }
        set({ user: null });
        window.location.href = "/login";
      },
      isAuthenticated: () => !!get().user,
    }),
    { name: "queuecare_user" }
  )
);
