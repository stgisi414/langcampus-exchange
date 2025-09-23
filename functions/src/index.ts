import cors from "cors";
// Import Request from functions with an alias, and Response from express, as that's what the v2 onRequest uses.
import { onRequest, Request as FunctionsRequest } from "firebase-functions/v2/https";
import { Response as ExpressResponse } from "express";
import express from "express";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";

if (getApps().length === 0) {
  initializeApp();
}

const allowedOrigins = [
  "https://langcampus-exchange.web.app",
  "https://practicefor.fun",
  "https://www.practicefor.fun",
  "http://127.0.0.1:5000",
  "http://localhost:5000",
  "http://localhost:5173",
];

const corsHandler = cors({ origin: allowedOrigins });

// Use the correct, aliased types for Firebase onRequest handlers
export const geminiProxy = onRequest(
  { secrets: ["GEMINI_API_KEY"] },
  (request: FunctionsRequest, response: ExpressResponse) => {
    corsHandler(request, response, async () => {
      logger.info("geminiProxy started, CORS check passed.");
      if (request.method !== "POST") {
        return response.status(405).send("Method Not Allowed");
      }
      const { prompt } = request.body;
      if (!prompt) {
        return response.status(400).send("Bad Request: Missing prompt");
      }
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        return response.status(500).send("Internal Server Error: API key not configured.");
      }
      try {
        const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const geminiResponse = await fetch(modelUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          logger.error("Error from Gemini API:", errorText);
          return response.status(geminiResponse.status).send(errorText);
        }
        const data = await geminiResponse.json();
        return response.json(data);
      } catch (error) {
        logger.error("Catastrophic error calling Gemini API:", error);
        return response.status(500).send("Internal Server Error");
      }
    });
  }
);

const voiceConfigMap: Record<string, any> = {
    "en-US": {prebuiltVoiceConfig: {voiceName: "Kore"}},
    "es-ES": {prebuiltVoiceConfig: {voiceName: "Puck"}},
    "fr-FR": {prebuiltVoiceConfig: {voiceName: "Leda"}},
    "de-DE": {prebuiltVoiceConfig: {voiceName: "Charon"}},
    "ja-JP": {prebuiltVoiceConfig: {voiceName: "Aoede"}},
    "ko-KR": {prebuiltVoiceConfig: {voiceName: "Orus"}},
    "it-IT": {prebuiltVoiceConfig: {voiceName: "Fenrir"}},
    "pt-BR": {prebuiltVoiceConfig: {voiceName: "Umbriel"}},
    "ru-RU": {prebuiltVoiceConfig: {voiceName: "Iapetus"}},
    "ar-XA": {prebuiltVoiceConfig: {voiceName: "Algieba"}},
    "cmn-CN": {prebuiltVoiceConfig: {voiceName: "Achernar"}},
    "hi-IN": {prebuiltVoiceConfig: {voiceName: "Alnilam"}},
    "vi-VN": {prebuiltVoiceConfig: {voiceName: "Gacrux"}},
    "pl-PL": {prebuiltVoiceConfig: {voiceName: "Pulcherrima"}},
    "mn-MN": {prebuiltVoiceConfig: {voiceName: "Sadachbia"}},
};

// Use the correct, aliased types for Firebase onRequest handlers
export const geminiTTS = onRequest(
  { secrets: ["GEMINI_API_KEY"] },
  (request: FunctionsRequest, response: ExpressResponse) => {
    corsHandler(request, response, async () => {
      logger.info("TTS Function started, CORS check passed.");
      if (request.method !== "POST") {
        return response.status(405).send("Method Not Allowed");
      }
      const { text, languageCode } = request.body;
      if (!text || !languageCode) {
        return response.status(400).send("Bad Request: Missing text or languageCode");
      }
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        return response.status(500).send("Internal Server Error: API key not configured.");
      }
      try {
        let processedText = text;
        if (text.trim().length <= 2) {
          processedText = `<break time="150ms"/>${text}<break time="150ms"/>`;
        }
        const contentText = `<speak><lang xml:lang="${languageCode}">${processedText}</lang></speak>`;
        const voiceConfig = voiceConfigMap[languageCode] || voiceConfigMap["en-US"];
        const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
          "model": "gemini-2.5-flash-preview-tts",
          "contents": [{"parts": [{"text": contentText}]}],
          "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
              "voiceConfig": voiceConfig,
              "languageCode": languageCode,
            },
          },
        };
        const ttsResponse = await fetch(ttsUrl, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(payload),
        });
        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.text();
          logger.error("Error from Gemini TTS API:", errorText);
          return response.status(ttsResponse.status).send(errorText);
        }
        const result = await ttsResponse.json();
        const candidate = result?.candidates?.[0];
        if (!candidate?.content?.parts) {
          throw new Error("Invalid TTS API response structure.");
        }
        const audioPart = candidate.content.parts.find((part: any) => part.inlineData);
        if (audioPart?.inlineData) {
          return response.status(200).send({audioContent: audioPart.inlineData.data});
        } else {
          throw new Error("No audio data received from TTS API.");
        }
      } catch (error: any) {
        logger.error(`Error generating TTS for text "${text}" in language "${languageCode}":`, error.message);
        return response.status(500).send("Failed to generate audio.");
      }
    });
  }
);

// Use the correct, aliased types for Firebase onRequest handlers
export const createStripeCheckout = onRequest(
  { cors: true, secrets: ["STRIPE_SECRET_KEY"] },
  async (request: FunctionsRequest, response: ExpressResponse) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-08-27.basil",
    });

    const { userId, userEmail } = request.body.data;

    if (!userId || !userEmail) {
      response.status(400).send({ error: "Missing userId or userEmail" });
      return;
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [{
          price: "price_1SAIFpGYNyUbUaQ657RL4nVR", //Test price
          quantity: 1,
        }],
        success_url: `${request.headers.origin}?checkout_success=true`,
        cancel_url: `${request.headers.origin}`,
        customer_email: userEmail,
        metadata: {
            firebaseUID: userId,
        }
      });

      response.status(200).send({ sessionId: session.id });
    } catch (error) {
      logger.error("Stripe Checkout Error:", error);
      response.status(500).send({ error: "Failed to create Stripe session." });
    }
  }
);

const stripeWebhookApp = express();

stripeWebhookApp.post("/", express.raw({type: 'application/json'}), async (request: express.Request, response: express.Response) => {
    logger.info("Stripe webhook function triggered.");

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-08-27.basil",
    });

    const signature = request.headers["stripe-signature"];
    if (!signature) {
      logger.error("Webhook Error: Missing Stripe signature.");
      response.status(400).send("Webhook signature is missing.");
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
      logger.info(`Webhook event received successfully: ${event.type}`);
    } catch (err: any) {
      logger.error("Webhook signature verification failed.", err.message);
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const firebaseUID = session.metadata?.firebaseUID;

      if (firebaseUID) {
        try {
          logger.info(`Updating user ${firebaseUID} subscription status to 'subscriber'.`);
          const userRef = getFirestore().collection("users").doc(firebaseUID);
          await userRef.update({ subscription: "subscriber" });
          logger.info(`Successfully updated user ${firebaseUID}.`);
        } catch (dbError) {
          logger.error(`Firestore update failed for user ${firebaseUID}`, dbError);
        }
      } else {
        logger.warn("Webhook received checkout.session.completed event without a firebaseUID in metadata.");
      }
    }

    response.status(200).send({ received: true });
});

export const stripeWebhook = onRequest(
  { secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
  stripeWebhookApp
);