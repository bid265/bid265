import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { getAppUrl, renderEmail, sendEmail } from "@/lib/email";
import { createResetToken, RESET_TOKEN_TTL_MINUTES } from "@/lib/passwordReset";

// Same response whether or not the email exists, so accounts cannot be enumerated.
const GENERIC = { success: true, message: "If an account exists for that email, a password reset link has been sent." };

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const [user] = await db.select({ id: users.id, name: users.name, email: users.email, password: users.password })
      .from(users).where(sql`lower(trim(${users.email})) = ${email}`).limit(1);

    // Google-only accounts have no password to recover; they sign in with Google.
    if (!user || !user.password?.startsWith("$2")) return NextResponse.json(GENERIC);

    // Invalidate older unused links, then issue a fresh one-hour token.
    await db.update(passwordResetTokens).set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
    const { token, tokenHash } = createResetToken();
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
    });

    const url = `${getAppUrl()}/reset-password?token=${token}`;
    try {
      const { html, text } = renderEmail({
        heading: "Reset your TrustBid password",
        intro: `Hello ${user.name},\n\nWe received a request to reset your password. This link works once and expires in ${RESET_TOKEN_TTL_MINUTES} minutes.`,
        cta: { label: "Choose a new password", url },
        footer: "If you did not request this, you can ignore this email - your password will not change.",
      });
      await sendEmail({ to: user.email, subject: "Reset your TrustBid password", text, html });
    } catch (emailError) {
      console.error("[Forgot password] email failed", emailError);
    }
    return NextResponse.json(GENERIC);
  } catch (error) {
    console.error("[Forgot password]", error);
    return NextResponse.json({ error: "Could not process the request. Please try again." }, { status: 500 });
  }
}
