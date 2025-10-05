import cors from "cors";
import { onRequest, Request as FunctionsRequest } from "firebase-functions/v2/https";
import { Response as ExpressResponse } from "express";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { SpeechClient } from "@google-cloud/speech";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
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
      const { prompt, model } = request.body;
      if (!prompt) {
        return response.status(400).send("Bad Request: Missing prompt");
      }
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        return response.status(500).send("Internal Server Error: API key not configured.");
      }
      try {
        const modelToUse = model || "gemini-2.5-flash-lite";
        const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${GEMINI_API_KEY}`;
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

export const youtubeProxy = onRequest(
  { secrets: ["GEMINI_API_KEY"] },
  async (request: FunctionsRequest, response: ExpressResponse) => {
    corsHandler(request, response, async () => {
      if (request.method !== "POST") {
        return response.status(405).send("Method Not Allowed");
      }

      const { topic, languageName } = request.body;
      if (!topic || !languageName) {
        return response.status(400).send("Bad Request: Missing topic or languageName");
      }

      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        return response.status(500).send("Internal Server Error: API key not configured.");
      }
      
      const db = getFirestore();
      const cacheKey = `${languageName}_${topic}`.replace(/[^a-zA-Z0-9]/g, '_');
      const cacheRef = db.collection('videoCache').doc(cacheKey);
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      try {
        const cacheDoc = await cacheRef.get();
        if (cacheDoc.exists && cacheDoc.data()?.timestamp > sevenDaysAgo) {
          logger.info(`Serving YouTube search results from cache for key: ${cacheKey}`);
          return response.status(200).json(cacheDoc.data()?.videos || []);
        }

        logger.info(`Fetching new YouTube search results for key: ${cacheKey}`);
        const query = encodeURIComponent(`${languageName} lesson ${topic}`);
        const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&key=${GEMINI_API_KEY}&maxResults=6&type=video&relevanceLanguage=en`;
        
        const youtubeResponse = await fetch(youtubeApiUrl);
        if (!youtubeResponse.ok) {
          const errorText = await youtubeResponse.text();
          logger.error("Error from YouTube API:", errorText);
          return response.status(youtubeResponse.status).send(errorText);
        }

        const data = await youtubeResponse.json();
        
        const videos = data.items.map((item: any) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          thumbnailUrl: item.snippet.thumbnails.medium.url,
        }));
        
        // Save to cache
        await cacheRef.set({
          videos: videos,
          timestamp: Date.now(),
        });

        return response.status(200).json(videos);
      } catch (error) {
        logger.error("Error calling YouTube API or handling cache:", error);
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

const VOICE_MAP: Record<string, any> = {
    // These WaveNet models are required for SSML <voice> tag support
    "en-US": { male: "en-US-Wavenet-D", female: "en-US-Wavenet-F" },
    "es-ES": { male: "es-ES-Wavenet-B", female: "es-ES-Wavenet-C" },
    "fr-FR": { male: "fr-FR-Wavenet-B", female: "fr-FR-Wavenet-A" },
    "de-DE": { male: "de-DE-Wavenet-B", female: "de-DE-Wavenet-A" },
    "it-IT": { male: "it-IT-Wavenet-B", female: "it-IT-Wavenet-A" },
    "pt-BR": { male: "pt-BR-Wavenet-B", female: "pt-BR-Wavenet-A" },
    "ja-JP": { male: "ja-JP-Wavenet-C", female: "ja-JP-Wavenet-A" },
    "ko-KR": { male: "ko-KR-Wavenet-C", female: "ko-KR-Wavenet-A" },
    "cmn-CN": { male: "cmn-CN-Wavenet-B", female: "cmn-CN-Wavenet-A" },
    "ru-RU": { male: "ru-RU-Wavenet-B", female: "ru-RU-Wavenet-A" },
    "ar-XA": { male: "ar-XA-Wavenet-B", female: "ar-XA-Wavenet-A" },
    "hi-IN": { male: "hi-IN-Wavenet-B", female: "hi-IN-Wavenet-A" },
    "vi-VN": { male: "vi-VN-Wavenet-D", female: "vi-VN-Wavenet-A" },
    "pl-PL": { male: "pl-PL-Wavenet-B", female: "pl-PL-Wavenet-A" },
    "mn-MN": { male: "mn-MN-Standard-B", female: "mn-MN-Standard-A" }, 
};

export const googleCloudTTS = onRequest(
  (request: FunctionsRequest, response: ExpressResponse) => {
    corsHandler(request, response, async () => {
      logger.info("googleCloudTTS Function started, CORS check passed.");

      if (request.method !== "POST") {
        return response.status(405).send("Method Not Allowed");
      }

      const { text, languageCode, gender } = request.body;
      if (!text || !languageCode || !gender || (gender !== 'male' && gender !== 'female')) {
        return response.status(400).send("Bad Request: Missing text, languageCode, or invalid gender.");
      }

      try {
        const ttsClient = new TextToSpeechClient();

        // FIX: The voice lookup logic is now correctly placed here.
        const languageVoices = VOICE_MAP[languageCode] || VOICE_MAP["en-US"];
        const voiceName = languageVoices[gender] || languageVoices['male'];

        const isSsml = text.trim().startsWith('<speak>');
        const input = isSsml ? { ssml: text } : { text: text };

        const ttsRequest = {
          input: input,
          voice: { languageCode: languageCode, name: voiceName },
          audioConfig: { audioEncoding: "MP3" as const },
        };

        logger.info("TTS Request Payload:", ttsRequest);

        const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);
        
        if (ttsResponse.audioContent) {
          const audioContent = Buffer.from(ttsResponse.audioContent).toString('base64');
          return response.status(200).send({ audioContent: audioContent });
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