import { prisma } from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/resend";
import { getLocale } from "@/i18n/server";

export type InvitedUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  createdAt: Date;
};

export type InviteResult = { status: "created"; user: InvitedUser } | { status: "exists" };

/** Legt einen User an und verschickt die Willkommens-Mail; bestehende Mailadressen bleiben unverändert. */
export async function inviteUser({
  email,
  name,
  role,
  invitedById,
}: {
  email: string;
  name?: string | null;
  role: string;
  invitedById: string;
}): Promise<InviteResult> {
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingUser) return { status: "exists" };

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      role,
      locale: await getLocale(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  const invitingUser = await prisma.user.findUnique({
    where: { id: invitedById },
    select: { name: true, email: true },
  });

  try {
    const loginUrl = process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/login`
      : "https://dashboard.tasketeer.com/login";

    await sendWelcomeEmail({
      to: email,
      invitedBy: {
        name: invitingUser?.name || null,
        email: invitingUser?.email || "ein Administrator",
      },
      loginUrl,
    });
  } catch (emailError) {
    // Logge Fehler, aber verhindere nicht die User-Erstellung
    console.error("Error sending welcome email:", emailError);
  }

  return { status: "created", user };
}
