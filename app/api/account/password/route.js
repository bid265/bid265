import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function PATCH(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in to change your password." }, { status: 401 });
    }
    if (session.user.role !== "AUCTIONEER") {
      return NextResponse.json({ error: "Only auctioneer accounts can use this password form." }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    if (!currentPassword || newPassword.length < 12 || newPassword.length > 128) {
      return NextResponse.json({
        error: "Enter your current password and a new password between 12 and 128 characters.",
      }, { status: 400 });
    }

    const userId = Number(session.user.id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Your account session is invalid. Sign in again." }, { status: 401 });
    }

    const [user] = await db.select({
      id: users.id,
      password: users.password,
    }).from(users)
      .where(and(eq(users.id, userId), eq(users.role, "AUCTIONEER")))
      .limit(1);
    if (!user || !user.password.startsWith("$2")) {
      return NextResponse.json({ error: "Password changes require a password-based auctioneer account." }, { status: 400 });
    }

    const currentPasswordIsValid = await bcrypt.compare(currentPassword, user.password);
    if (!currentPasswordIsValid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      return NextResponse.json({ error: "Choose a new password that differs from your current password." }, { status: 400 });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    const [updated] = await db.update(users)
      .set({ password: newPasswordHash, mustChangePassword: false })
      .where(and(
        eq(users.id, user.id),
        eq(users.role, "AUCTIONEER"),
        eq(users.password, user.password),
      ))
      .returning({ id: users.id });
    if (!updated) {
      return NextResponse.json({ error: "Your password changed in another request. Sign in again and retry." }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Auctioneer password change]", error);
    return NextResponse.json({ error: "Could not change your password. Please try again." }, { status: 500 });
  }
}
