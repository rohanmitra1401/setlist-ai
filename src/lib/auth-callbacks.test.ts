import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession, type Account, type User } from "next-auth";
import { encode, type JWT } from "next-auth/jwt";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const secret = "test-secret-for-auth-callbacks";

const profile = {
    name: "Test Listener",
    email: "listener@example.com",
    picture: "https://i.scdn.co/image/avatar",
    sub: "spotify-user-id",
};

type JwtParams = Parameters<NonNullable<NonNullable<typeof authOptions.callbacks>["jwt"]>>[0];

// What next-auth hands the jwt callback right after Spotify's OAuth callback.
async function signIn(): Promise<JWT> {
    const account: Account = {
        provider: "spotify",
        type: "oauth",
        providerAccountId: profile.sub,
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    const user: User = { id: profile.sub, name: profile.name, email: profile.email, image: profile.picture };
    const params: JwtParams = { token: { ...profile }, account, user, trigger: "signIn" };

    return authOptions.callbacks!.jwt!(params);
}

describe("next-auth callbacks", () => {
    beforeEach(() => {
        vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("keeps the profile claims in the token on sign-in", async () => {
        const token = await signIn();

        expect(token).toMatchObject({ ...profile, accessToken: "access-token", refreshToken: "refresh-token" });
    });

    it("returns the Spotify name and avatar in session.user", async () => {
        const sessionToken = await encode({ token: await signIn(), secret });
        const req = { headers: { host: "localhost:3000" }, cookies: { "next-auth.session-token": sessionToken } };
        const res = { getHeader: () => undefined, setHeader: () => undefined };

        const session = await getServerSession(
            req as unknown as NextApiRequest,
            res as unknown as NextApiResponse,
            { ...authOptions, secret },
        );

        expect(session?.user).toEqual({ name: profile.name, email: profile.email, image: profile.picture });
    });
});
