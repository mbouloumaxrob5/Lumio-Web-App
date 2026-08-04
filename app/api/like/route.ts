import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { sendNotificationEvent } from '../../../lib/sse';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any).id;

    const { imageId } = await req.json();
    if (!imageId) return NextResponse.json({ error: 'Missing imageId' }, { status: 400 });

    // Check existing
    const existing = await prisma.like.findUnique({ where: { userId_imageId: { userId, imageId } } }).catch(() => null);

    let action: 'liked' | 'unliked' = 'liked';

    if (existing) {
      // unlike
      await prisma.$transaction([ prisma.like.delete({ where: { id: existing.id } }), prisma.image.update({ where: { id: imageId }, data: { likesCount: { decrement: 1 } } }) ]);
      action = 'unliked';
    } else {
      // like
      const like = await prisma.like.create({ data: { userId, imageId } });
      // increment counts and create notification
      const img = await prisma.image.findUnique({ where: { id: imageId } });
      const ops: any[] = [ prisma.image.update({ where: { id: imageId }, data: { likesCount: { increment: 1 } } }) ];
      if (img) {
        ops.push(prisma.user.update({ where: { id: img.creatorId }, data: { likesReceived: { increment: 1 } } }));
        // create notification if liker is not the owner
        if (img.creatorId !== userId) {
          const notif = await prisma.notification.create({ data: { recipientId: img.creatorId, actorId: userId, type: 'LIKE', imageId, payload: { message: 'Someone liked your image' } } });
          // send SSE event if recipient connected
          sendNotificationEvent(img.creatorId, { type: 'LIKE', notif });
        }
      }
      await prisma.$transaction(ops);
      action = 'liked';
    }

    return NextResponse.json({ ok: true, action });
  } catch (err) {
    console.error('Like route error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
