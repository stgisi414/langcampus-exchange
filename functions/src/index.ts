import cors from "cors";
import { onRequest, Request } from "firebase-functions/v2/https";
import { Response } from "express";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

initializeApp();

// This is the list of all websites allowed to call your function.
const allowedOrigins = [
  "https://langcampus-exchange.web.app",
  "https://practicefor.fun",
  "https://www.practicefor.fun",
  // Added for local development
  "http://127.0.0.1:5000",
  "http://localhost:5000",
];

const corsHandler = cors({origin: allowedOrigins});

export const geminiProxy = onRequest(
  {secrets: ["GEMINI_API_KEY"]},
  (request: Request, response: Response) => {
    // This uses the cors middleware to handle all the CORS logic for us.
    corsHandler(request, response, async () => {
      logger.info("Function started, CORS check passed.");

      if (request.method !== "POST") {
        response.status(405).send("Method Not Allowed");
        return;
      }

      const {prompt} = request.body;
      if (!prompt) {
        response.status(400).send("Bad Request: Missing prompt");
        return;
      }

      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        response.status(500).send("Internal Server Error: API key not configured.");
        return;
      }

      try {
        const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const geminiResponse = await fetch(
          modelUrl,
          {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
              contents: [{parts: [{text: prompt}]}],
            }),
          }
        );

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          logger.error("Error from Gemini API:", errorText);
          response.status(geminiResponse.status).send(errorText);
          return;
        }

        const data = await geminiResponse.json();
        response.json(data);
      } catch (error) {
        logger.error("Catastrophic error calling Gemini API:", error);
        response.status(500).send("Internal Server Error");
      }
    });
  }
);

export const geminiTTS = onRequest(
  {secrets: ["GEMINI_API_KEY"]},
  (request: Request, response: Response) => {
    corsHandler(request, response, async () => {
      logger.info("TTS Function started, CORS check passed.");

      if (request.method !== "POST") {
        response.status(405).send("Method Not Allowed");
        return;
      }

      const {text, languageCode} = request.body;
      if (!text || !languageCode) {
        response.status(400).send("Bad Request: Missing text or languageCode");
        return;
      }

      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        response.status(500).send("Internal Server Error: API key not configured.");
        return;
      }

      // High-quality voice mapping based on your working example
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
              "voiceConfig": voiceConfig, // Corrected line
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
          response.status(ttsResponse.status).send(errorText);
          return;
        }

        const result = await ttsResponse.json();
        const candidate = result?.candidates?.[0];

        if (!candidate?.content?.parts) {
          throw new Error("Invalid TTS API response structure.");
        }

        const audioPart = candidate.content.parts.find((part: any) => part.inlineData);

        if (audioPart?.inlineData) {
          response.status(200).send({audioContent: audioPart.inlineData.data});
        } else {
          throw new Error("No audio data received from TTS API.");
        }
      } catch (error: any) {
        logger.error(`Error generating TTS for text "${text}" in language "${languageCode}":`, error.message);
        response.status(500).send("Failed to generate audio.");
      }
    });
  },
);

export const createStripeCheckout = onRequest(
  { cors: true, secrets: ["STRIPE_SECRET_KEY"] },
  async (request: Request, response: Response) => {
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
          //price: "price_1SAGshGYNyUbUaQ6L3QynrgC",
          quantity: 1,
        }],
        success_url: `${request.headers.origin}?checkout_success=true`,
        cancel_url: `${request.headers.origin}`,
        customer_email: userEmail,
        // Pass the Firebase UID to Stripe's metadata
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

export const stripeWebhook = onRequest(
  { secrets: ["STRIPE_SECRET_KEY"] },
  async (request: Request, response: Response) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-08-27.basil",
    });
    
    const signature = request.headers["stripe-signature"];
    if (!signature) {
      response.status(400).send("No signature provided.");
      return;
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        process.env.STRIPE_SECRET_KEY!
      );
    } catch (err: any) {
      logger.error("Webhook signature verification failed.", err.message);
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const firebaseUID = session.metadata?.firebaseUID;

      if (firebaseUID) {
        try {
          const userRef = getFirestore().collection("users").doc(firebaseUID);
          await userRef.update({ subscription: "subscriber" });
          logger.info(`User ${firebaseUID} successfully subscribed.`);
        } catch (error) {
          logger.error(`Failed to update user ${firebaseUID} in Firestore`, error);
        }
      }
    }
    
    response.status(200).send({ received: true });
  }
);