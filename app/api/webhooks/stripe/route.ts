import { NextRequest, NextResponse } from "next/server";
import { stripe } from "../../../../src/lib/stripe";
import { prisma } from "../../../../src/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as { id: string; metadata?: Record<string, string> };
    const orderId = invoice.metadata?.orderId;

    if (orderId) {
      await prisma.ibsaGroupOrder.update({
        where: { id: orderId },
        data: {
          status: "complete",
          paidAt: new Date(),
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
