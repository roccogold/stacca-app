import type { SessionOptions } from "iron-session";
import { getSessionSecret } from "@/lib/env";

export type SessionData = {
  userId?: string;
  handle?: string;
  displayName?: string;
  isLoggedIn: boolean;
  mustChangePassword?: boolean;
};

export const defaultSession: SessionData = {
  isLoggedIn: false,
};

export const sessionOptions: SessionOptions = {
  password: getSessionSecret(),
  cookieName: "stacca_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
  },
};
