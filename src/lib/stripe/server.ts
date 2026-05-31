import Stripe from "stripe";

interface CreateStripePaymentLinkParams {
  apiKey: string;
  storeId?: string;
  variantId?: string;
  email: string;
  customerName: string;
  amount: number;
  currency: string;
  productName: string;
  productDescription?: string;
  redirectUrl: string;
  customData?: Record<string, string>;
}

interface CreateStripePaymentLinkResult {
  link: string;
  reference: string;
}

export async function createStripePaymentLink({
  apiKey,
  email,
  customerName,
  amount,
  currency,
  productName,
  productDescription,
  redirectUrl,
  customData,
}: CreateStripePaymentLinkParams): Promise<CreateStripePaymentLinkResult> {
  const stripe = new Stripe(apiKey, { apiVersion: "2026-05-27.dahlia" });

  // Create a one-time price on the fly
  const price = await stripe.prices.create({
    currency: currency.toLowerCase(),
    unit_amount: Math.round(amount * 100),
    product_data: {
      name: productName,
      ...(productDescription ? { description: productDescription } : {}),
    },
  });

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    after_completion: {
      type: "redirect",
      redirect: { url: redirectUrl },
    },
    metadata: customData ?? {},
  });

  return {
    link: paymentLink.url,
    reference: paymentLink.id,
  };
}
