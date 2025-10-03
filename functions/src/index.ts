import cors from "cors";
import { onRequest, Request as FunctionsRequest } from "firebase-functions/v2/https";
import { Response as ExpressResponse } from "express";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { SpeechClient } from "@google-cloud/speech";

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
        const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
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

export const transcribeAudio = onRequest(
    (request: FunctionsRequest, response: ExpressResponse) => {
        corsHandler(request, response, async () => {
            if (request.method !== "POST") {
                return response.status(405).send("Method Not Allowed");
            }

            const { audioBytes, languageCode } = request.body;
            if (!audioBytes || !languageCode) {
                return response.status(400).send("Bad Request: Missing audioBytes or languageCode");
            }

            try {
                // Initialize the client here, just before it's needed.
                const speechClient = new SpeechClient();

                const audio = {
                    content: audioBytes,
                };
                const config = {
                    encoding: "WEBM_OPUS" as const,
                    sampleRateHertz: 48000,
                    languageCode: languageCode,
                };
                const requestPayload = {
                    audio: audio,
                    config: config,
                };

                const [operation] = await speechClient.longRunningRecognize(requestPayload);
                const [transcriptionResponse] = await operation.promise();
                
                const transcription = transcriptionResponse.results
                    ?.map((result) => result.alternatives?.[0].transcript)
                    .join("\n");

                return response.json({ transcription });
            } catch (error) {
                logger.error("Error transcribing audio:", error);
                return response.status(500).send("Internal Server Error: Could not transcribe audio.");
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

export const createStripePortalLink = onRequest(
  { secrets: ["STRIPE_SECRET_KEY"] },
  (request: FunctionsRequest, response: ExpressResponse) => {
    corsHandler(request, response, async () => {
      if (request.method !== 'POST') {
        response.status(405).send('Method Not Allowed');
        return;
      }
      
      const authorization = request.headers.authorization;
      if (!authorization || !authorization.startsWith('Bearer ')) {
        response.status(403).send("Unauthorized: No token provided.");
        return;
      }

      const idToken = authorization.split('Bearer ')[1];
      
      try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        
        const db = getFirestore();

        if (!process.env.STRIPE_SECRET_KEY) {

          throw new Error("Stripe secret key not found.");

        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: "2025-08-27.basil",
        });

        const customerDoc = await db.collection("customers").doc(uid).get();
        const customerData = customerDoc.data();
        if (!customerData || !customerData.stripeId) {
          throw new Error("Stripe customer ID not found in Firestore.");
        }
        const stripeCustomerId = customerData.stripeId;

        const { returnUrl } = request.body;
        if (!returnUrl) {
            response.status(400).send("Bad Request: Missing returnUrl.");
            return;
        }

        const portalSession = await stripe.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: returnUrl,
        });

        response.status(200).send({ url: portalSession.url });

      } catch (error: any) {
        logger.error(`Error creating portal link:`, error);
        response.status(500).send({ error: "Failed to create portal link." });
      }
    });
  }
);