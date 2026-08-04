import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import argon2 from 'argon2';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name, username } = body;
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Basic validation
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || undefined,
        username: username || undefined
      }
    });

    // Do not return the password hash
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Registration error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
