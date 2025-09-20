import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {defineString} from "firebase-functions/params";

const GEMINI_API_KEY = defineString("GEMINI_API_KEY");

export const geminiProxy = onRequest(
  {secrets: ["GEMINI_API_KEY"]},
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    const {prompt} = request.body;
    if (!prompt) {
      response.status(400).send("Bad Request: Missing prompt");
      return;
    }

    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY.value()}`,
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