import cors from "cors";
import { onRequest, Request as FunctionsRequest, HttpsError } from "firebase-functions/v2/https";
import { Response as ExpressResponse } from "express";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import { v4 as uuidv4 } from 'uuid'; // Import uuid

// --- Lazy Initializers ---
// We use 'require' inside functions to load these SDKs only when needed,
// which avoids the deployment timeout.

// Firebase Admin SDK (initialized once per function instance)
let adminInitialized = false;
function ensureAdminInitialized() {
  if (!adminInitialized) {
    const admin = require("firebase-admin/app");
    if (admin.getApps().length === 0) {
      admin.initializeApp();
    }
    adminInitialized = true;
  }
}

// Firestore Client (lazy getter)
let dbInstance: ReturnType<typeof import("firebase-admin/firestore").getFirestore> | null = null;
function getDb() {
  if (!dbInstance) {
    ensureAdminInitialized();
    const { getFirestore } = require("firebase-admin/firestore");
    dbInstance = getFirestore();
  }
  return dbInstance;
}

// Auth Client (lazy getter)
let authInstance: ReturnType<typeof import("firebase-admin/auth").getAuth> | null = null;
function getFirebaseAuth() {
  if (!authInstance) {
    ensureAdminInitialized();
    const { getAuth } = require("firebase-admin/auth");
    authInstance = getAuth();
  }
  return authInstance;
}

// Storage Client (lazy getter)
let storageInstance: ReturnType<typeof import("firebase-admin/storage").getStorage> | null = null;
function getStorageAdmin() {
    if (!storageInstance) {
        ensureAdminInitialized();
        const { getStorage } = require("firebase-admin/storage");
        storageInstance = getStorage();
    }
    return storageInstance;
}
function getBucket() {
    // We can safely use the non-null assertion '!' because our logic ensures it's initialized.
    return getStorageAdmin()!.bucket();
}

// Speech Client (lazy getter)
let speechClientInstance: import("@google-cloud/speech").SpeechClient | null = null;
function getSpeechClient() {
    if (!speechClientInstance) {
        const { SpeechClient } = require("@google-cloud/speech");
        speechClientInstance = new SpeechClient();
    }
    return speechClientInstance;
}

// TextToSpeech Client (lazy getter)
let ttsClientInstance: import("@google-cloud/text-to-speech").TextToSpeechClient | null = null;
function getTtsClient() {
    if (!ttsClientInstance) {
        const { TextToSpeechClient } = require("@google-cloud/text-to-speech");
        ttsClientInstance = new TextToSpeechClient();
    }
    return ttsClientInstance;
}
// --- End Lazy Initializers ---

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

      try {
        const { prompt, model } = request.body;
        if (!prompt) {
          return response.status(400).send("Bad Request: Missing prompt");
        }
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
          return response.status(500).send("Internal Server Error: API key not configured.");
        }
        
        const modelToUse = model || "gemini-2.5-flash"; // Using a more recent model
        const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${GEMINI_API_KEY}`;

        // --- FIX: ADD SAFETY SETTINGS TO THE REQUEST BODY ---
        const requestBody = {
          contents: [{ parts: [{ text: prompt }] }],
          safetySettings: [
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE",
            },
          ],
        };
        // --- END OF FIX ---

        let geminiResponse;
        try {
          geminiResponse = await fetch(modelUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody), // Use the new request body
          });
        } catch (fetchError: any) {
            logger.error("Network error calling Gemini API:", fetchError.message);
            return response.status(502).send("Bad Gateway: Error contacting Gemini API.");
        }


        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          logger.error("Error from Gemini API:", errorText);
          return response.status(geminiResponse.status).send(errorText);
        }

        const data = await geminiResponse.json();
        
        // Log if the response was blocked despite the settings
        if (!data.candidates || data.candidates.length === 0) {
            logger.warn("Gemini response was blocked or empty. Finish Reason:", data.promptFeedback?.blockReason);
            logger.warn("Safety Ratings:", data.promptFeedback?.safetyRatings);
            return response.status(500).json({
              error: "Gemini response blocked or empty",
              details: data.promptFeedback || "No candidates returned."
            });
        }

        return response.status(200).json(data);

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
      
      const db = getDb()!; // Use the lazy getter with non-null assertion
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

            const { audioBytes, languageCode, mimeType } = request.body;
            if (!audioBytes || !languageCode || !mimeType) {
                return response.status(400).send("Bad Request: Missing audioBytes, languageCode, or mimeType");
            }

            const baseMimeType = mimeType.split(';')[0].trim().toLowerCase();
            logger.info(`Received transcription request. Original MimeType: "${mimeType}", Base MimeType: "${baseMimeType}", LanguageCode: ${languageCode}`);

            let encoding: any;
            let sampleRateHertz: number | undefined = undefined;

            if (baseMimeType === 'audio/webm' || baseMimeType === 'video/webm') {
                encoding = 'WEBM_OPUS';
            } else if (baseMimeType === 'audio/mp4' || baseMimeType === 'audio/aac' || baseMimeType === 'audio/x-m4a') {
                encoding = 'MP4A';
            } else if (baseMimeType === 'audio/wav' || baseMimeType === 'audio/wave' || baseMimeType === 'audio/x-wav') {
                encoding = 'LINEAR16';
                sampleRateHertz = 48000;
            } else if (baseMimeType === 'audio/ogg') {
                encoding = 'OGG_OPUS';
            } else {
                logger.warn(`Unsupported base audio format received: ${baseMimeType}`);
                return response.status(400).send("Unsupported audio format");
            }

            const config: any = {
                encoding: encoding,
                languageCode: languageCode,
            };
            if (sampleRateHertz) {
                config.sampleRateHertz = sampleRateHertz;
            }

            try {
                const speechClient = getSpeechClient()!; // Use lazy getter with non-null assertion
                const audio = { content: audioBytes };

                logger.info("Sending config to Speech API:", config);
                const requestPayload = { audio: audio, config: config };

                const [operation] = await speechClient.longRunningRecognize(requestPayload);
                const [transcriptionResponse] = await operation.promise();

                const transcription = transcriptionResponse.results
                    ?.map((result) => result.alternatives?.[0].transcript)
                    .join("\n");

                logger.info("Transcription successful:", transcription ? `"${transcription.substring(0, 50)}..."` : "(Empty)");
                return response.json({ transcription: transcription || "" });

            } catch (error) {
                logger.error("Error transcribing audio:", error);
                const errorMessage = error instanceof Error ? error.message : "Could not transcribe audio.";
                if (error instanceof Error && error.message.includes('INVALID_ARGUMENT')) {
                    logger.error("Speech API Error: Invalid argument. Config sent was:", config);
                    return response.status(400).send(`Speech API Error: Invalid argument. Please check audio format compatibility.`);
                }
                return response.status(500).send(`Internal Server Error: ${errorMessage}`);
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
    "eo": { male: "eo-XA-Standard-A", female: "eo-XA-Standard-A" },
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
        const ttsClient = getTtsClient()!; // Use lazy getter with non-null assertion

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
        const decodedToken = await getFirebaseAuth()!.verifyIdToken(idToken); // Use lazy getter
        const uid = decodedToken.uid;
        
        const db = getDb()!; // Use lazy getter

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

export const imagenProxy = onRequest(
  { timeoutSeconds: 120 },
  (request: FunctionsRequest, response: ExpressResponse) => {
    corsHandler(request, response, async () => {
      logger.info("imagenProxy started, CORS check passed.");
      if (request.method !== "POST") {
        return response.status(405).send("Method Not Allowed");
      }

      const { prompt } = request.body;
      if (!prompt) {
        return response.status(400).send("Bad Request: Missing prompt");
      }
      
      const imageModelUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/langcampus-exchange/locations/us-central1/publishers/google/models/imagen-4.0-fast-generate-001:predict`;

      try {
        const tokenResponse = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" } });
        if (!tokenResponse.ok) {
           logger.error("Error fetching access token:", { status: tokenResponse.status, text: await tokenResponse.text() });
           throw new HttpsError("internal", "Could not obtain access token for Imagen API.");
        }
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            throw new HttpsError("internal", "Access token was empty.");
        }

        const imageApiRequest = {
          instances: [{
            prompt: prompt,
            negativePrompt: "text, words, letters, writing, captions, headlines, titles, signs, numbers, fonts, blurry, unclear, abstract, complex background",
          }],
          parameters: {
              sampleCount: 1,
              aspectRatio: "1:1",
              mimeType: "image/jpeg"
          },
        };

        logger.info("Sending request to Imagen API:", { url: imageModelUrl, prompt: prompt.substring(0, 100) + '...' });

        const imageApiResponse = await fetch(imageModelUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify(imageApiRequest),
        });

        if (!imageApiResponse.ok) {
          const errorText = await imageApiResponse.text();
          logger.error("Error from Imagen API:", { status: imageApiResponse.status, text: errorText });
          throw new HttpsError("internal", `Imagen API failed with status ${imageApiResponse.status}`);
        }

        const imageData = await imageApiResponse.json();
        logger.info("Received response from Imagen API");

        const base64ImageBytes = imageData.predictions?.[0]?.bytesBase64Encoded;
        if (!base64ImageBytes) {
          logger.error("No image data found in Imagen response", imageData);
          throw new HttpsError("internal", "Failed to generate image data from Imagen.");
        }

        const imageBuffer = Buffer.from(base64ImageBytes, 'base64');
        const fileName = `flashcard_images/${uuidv4()}.jpeg`; // This is fine, it's scoped to this function
        const file = getBucket()!.file(fileName); // Use lazy getter

        logger.info(`Uploading image to Storage: ${fileName}`);
        await file.save(imageBuffer, {
          metadata: {
            contentType: 'image/jpeg',
            cacheControl: 'public, max-age=31536000',
          },
        });

        await file.makePublic();
        const imageUrl = file.publicUrl();
        logger.info(`Image successfully uploaded: ${imageUrl}`);

        return response.json({ imageUrl });

      } catch (error: any) {
        logger.error("Error in imagenProxy function:", error);
        if (error instanceof HttpsError) {
            return response.status(error.httpErrorCode.status).send(error.message);
        }
        return response.status(500).send("Internal Server Error: Image generation failed.");
      }
    });
  }
);

export const imageSearchProxy = onRequest(
  { secrets: ["CUSTOM_SEARCH_API_KEY", "CUSTOM_SEARCH_ENGINE_ID"], timeoutSeconds: 60 },
  (request: FunctionsRequest, response: ExpressResponse) => {
    corsHandler(request, response, async () => {
      logger.info("imageSearchProxy started, CORS check passed.");

      if (request.method !== "POST") {
        return response.status(405).send("Method Not Allowed");
      }

      const { query } = request.body;
      if (!query) {
        return response.status(400).send("Bad Request: Missing query");
      }

      const apiKey = process.env.CUSTOM_SEARCH_API_KEY;
      const cx = process.env.CUSTOM_SEARCH_ENGINE_ID;

      if (!apiKey || !cx) {
        logger.error("API Key or Custom Search Engine ID not configured.");
        return response.status(500).send("Internal Server Error: Search configuration missing.");
      }

      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&searchType=image&num=1&safe=active`;

      try {
        logger.info(`Performing image search for: "${query}"`);
        const searchResponse = await fetch(searchUrl);

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text();
          logger.error("Error from Google Custom Search API:", { status: searchResponse.status, text: errorText });
          const statusCode = searchResponse.status >= 400 && searchResponse.status < 600 ? searchResponse.status : 502;
          return response.status(statusCode).send(`Image search failed: ${errorText}`);
        }

        const searchData = await searchResponse.json();
        const imageUrl = searchData?.items?.[0]?.link;

        if (!imageUrl) {
          logger.warn("No image found in search results for:", query);
          return response.status(404).json({ imageUrl: null, message: "No image found for this query." });
        }

        logger.info(`Image found for "${query}": ${imageUrl.substring(0, 50)}...`);
        return response.status(200).json({ imageUrl });

      } catch (error: any) {
        logger.error("Error in imageSearchProxy function:", error);
        return response.status(500).send("Internal Server Error: Image search failed.");
      }
    });
  }
);