import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAppUrl, renderEmail, sendEmail } from "@/lib/email";
import { generateTemporaryPassword } from "@/lib/passwords";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { response: NextResponse.json({ error: "Administrator access is required." }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  try {
    const access = await requireAdmin();
    if (access.response) return access.response;

    const auctioneers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      phoneNumber: users.phoneNumber,
      postalAddress: users.postalAddress,
      addressLine1: users.addressLine1,
      addressLine2: users.addressLine2,
      district: users.district,
      businessName: users.businessName,
      nationalId: users.nationalId,
      createdAt: users.createdAt,
    }).from(users).where(sql`${users.role} = 'AUCTIONEER'`)
      .orderBy(users.createdAt);

    return NextResponse.json({ auctioneers });
  } catch (error) {
    console.error("[Admin auctioneers GET]", error);
    return NextResponse.json({ error: "Could not load auctioneer accounts." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const access = await requireAdmin();
    if (access.response) return access.response;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
    const postalAddress = typeof body.postalAddress === "string" ? body.postalAddress.trim() : "";
    const addressLine1 = typeof body.addressLine1 === "string" ? body.addressLine1.trim() : "";
    const addressLine2 = typeof body.addressLine2 === "string" ? body.addressLine2.trim() : "";
    const district = typeof body.district === "string" ? body.district.trim() : "";
    const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
    const nationalId = typeof body.nationalId === "string" ? body.nationalId.trim() : "";

    if (
      !name ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !phoneNumber ||
      phoneNumber.length > 20 ||
      !postalAddress ||
      !addressLine1 ||
      !addressLine2
    ) {
      return NextResponse.json({
        error: "Name, valid email, phone (maximum 20 characters), postal address, address lines 1 and 2 are required.",
      }, { status: 400 });
    }

    const [existingUser] = await db.select({ id: users.id }).from(users)
      .where(sql`lower(trim(${users.email})) = ${email}`).limit(1);
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    // A random one-time password is emailed to the auctioneer, who must replace it on first sign-in.
    const temporaryPassword = generateTemporaryPassword();
    const [auctioneer] = await db.insert(users).values({
      name,
      email,
      password: await bcrypt.hash(temporaryPassword, 12),
      mustChangePassword: true,
      phoneNumber,
      postalAddress,
      addressLine1,
      addressLine2,
      district: district || null,
      businessName: businessName || null,
      nationalId: nationalId || null,
      role: "AUCTIONEER",
      isVerified: true,
    }).returning({
      id: users.id,
      name: users.name,
      email: users.email,
      phoneNumber: users.phoneNumber,
    });

    try {
      const { html, text } = renderEmail({
        heading: "Your TrustBid auctioneer account is ready",
        intro: `Hello ${name},\n\nAn administrator has registered you as an auctioneer. Sign in with the temporary password below. You will be asked to choose your own password before you can open your dashboard.`,
        rows: [["Email", email], ["Temporary password", temporaryPassword]],
        cta: { label: "Sign in to TrustBid", url: `${getAppUrl()}/login` },
        footer: "For your security, do not share this password. It stops working as soon as you set your own.",
      });
      await sendEmail({ to: email, subject: "Your TrustBid auctioneer account", text, html });
    } catch (emailError) {
      // Never leave an account whose password nobody knows: undo the registration.
      console.error("[Admin auctioneers POST] credentials email failed", emailError);
      await db.delete(users).where(eq(users.id, auctioneer.id));
      return NextResponse.json({
        error: "The auctioneer was not registered because the login email could not be sent. Check the email (SMTP) settings and try again.",
      }, { status: 502 });
    }

    return NextResponse.json({ auctioneer, credentialsEmailed: true }, { status: 201 });
  } catch (error) {
    console.error("[Admin auctioneers POST]", error);
    return NextResponse.json({ error: "Could not create the auctioneer account." }, { status: 500 });
  }
}
