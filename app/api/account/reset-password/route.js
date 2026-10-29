import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { hashResetToken } from "@/lib/passwordReset";

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json({ error: "This reset link is invalid." }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Choose a password between 8 and 128 characters." }, { status: 400 });
    }

    const tokenHash = hashResetToken(token);
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.transaction(async (tx) => {
      // Claim the token atomically so a link can only be used once.
      const [claimed] = await tx.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ))
        .returning({ userId: passwordResetTokens.userId });
      if (!claimed) return null;
      await tx.update(users)
        .set({ password: passwordHash, mustChangePassword: false })
        .where(eq(users.id, claimed.userId));
      return claimed;
    });

    if (!result) {
      return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Reset password]", error);
    return NextResponse.json({ error: "Could not reset your password. Please try again." }, { status: 500 });
  }
}
