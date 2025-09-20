import cors from "cors";
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// This is the list of all websites allowed to call your function.
const allowedOrigins = [
  "https://langcampus-exchange.web.app",
  "https://practicefor.fun",
  "https://www.practicefor.fun"
];

const corsHandler = cors({origin: allowedOrigins});

export const geminiProxy = onRequest(
  {secrets: ["GEMINI_API_KEY"]},
  (request, response) => {
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
        const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

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
  (request, response) => {
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

      try {
        const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GEMINI_API_KEY}`;
        const ttsResponse = await fetch(
          ttsUrl,
          {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
              input: {text},
              voice: {languageCode, model_name:"gemini-2.5-pro-preview-tts"},
              audioConfig: {audioEncoding: "MP3"},
            }),
          }
        );

        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.text();
          logger.error("Error from Text-to-Speech API:", errorText);
          response.status(ttsResponse.status).send(errorText);
          return;
        }

        const data = await ttsResponse.json();
        response.json(data);
      } catch (error) {
        logger.error("Error calling Text-to-Speech API:", error);
        response.status(500).send("Internal Server Error");
      }
    });
  }
);