import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const geminiProxy = onRequest(
  {secrets: ["GEMINI_API_KEY"]},
  async (request, response) => {
    // ** START OF CORS FIX **
    // Set CORS headers to allow requests from any origin.
    // For more security, you could replace "*" with your website's URL:
    // 'https://langcampus-exchange.web.app'
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.set("Access-Control-Allow-Headers", "Content-Type");

    // Browsers send an OPTIONS request first to check CORS policy.
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }
    // ** END OF CORS FIX **

    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    const {prompt} = request.body;
    if (!prompt) {
      response.status(400).send("Bad Request: Missing prompt");
      return;
    }

    if (!GEMINI_API_KEY) {
        logger.error("GEMINI_API_KEY secret not loaded");
        response.status(500).send("Internal Server Error: API key not configured.");
        return;
    }

    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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
      logger.error("Error calling Gemini API:", error);
      response.status(500).send("Internal Server Error");
    }
  }
);