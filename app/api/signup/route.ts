import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Organization, User } from "@/models";

const signupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
  organizationName: z.string().trim().min(2).max(120),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Please submit valid form data." }, { status: 400 });
  }

  const validation = signupSchema.safeParse(payload);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Enter a name, valid email, organization, and password of at least 8 characters." },
      { status: 400 },
    );
  }

  const { name, email, password, organizationName } = validation.data;
  if (email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
    return NextResponse.json({ error: "That email cannot be registered as a user." }, { status: 409 });
  }

  await connectToDatabase();
  if (await User.exists({ email })) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const organization = await Organization.create({
    name: organizationName,
    orgId: randomUUID(),
    status: "pending",
  });

  try {
    await User.create({
      name,
      email,
      passwordHash,
      role: "Organization Owner",
      organizationId: organization._id,
    });
  } catch (error) {
    await Organization.deleteOne({ _id: organization._id });
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true, pendingApproval: true }, { status: 201 });
}
