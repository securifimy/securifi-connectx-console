import { createConsumer, type Cable } from "@rails/actioncable";

let consumer: Cable | null = null;
let currentToken: string | null = null;

export function getCable(token: string | null) {
  if (typeof window === "undefined") {
    if (!consumer) {
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
      consumer = createConsumer(`${base.replace(/\/$/, "")}/cable`);
    }
    return consumer;
  }

  if (consumer && currentToken === token) {
    return consumer;
  }

  if (consumer) {
    consumer.disconnect();
  }

  const origin = window.location.origin;
  const base = (process.env.NEXT_PUBLIC_API_URL || origin || "http://localhost:3000").replace(/\/$/, "");
  const secureBase = base.startsWith("http://") && origin.startsWith("https://")
    ? base.replace(/^http:/, "https:")
    : base;
  const url = `${secureBase}/cable?token=${token || ""}`;
  consumer = createConsumer(url);
  currentToken = token || null;
  return consumer;
}
