import { Message, Partner, QuizQuestion } from '../types';

// Make sure this is the correct URL for your deployed Cloud Function.
const PROXY_URL = "https://us-central1-langcampus-exchange.cloudfunctions.net/geminiProxy"; // Replace if yours is different

/**
 * A helper function to safely parse JSON from the AI,
 * which might be wrapped in markdown code fences.
 * @param text The raw text response from the Gemini API.
 * @returns The parsed JSON object.
 */
const cleanAndParseJson = (text: string) => {
  // Remove the markdown fence (```json ... ```) if it exists
  const cleanedText = text.replace(/^```json\s*/, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Failed to parse cleaned JSON:", cleanedText);
    throw new Error("Invalid JSON response from AI.");
  }
};


/**
 * A helper function to call our secure Firebase Cloud Function proxy.
 * @param prompt The text prompt to send to the Gemini API.
 * @returns The JSON response from the API.
 */
const callGeminiProxy = async (prompt: string) => {
  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from proxy function:", errorText);
      throw new Error(`Proxy request failed: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error calling the proxy function:", error);
    throw error;
  }
};

export const generatePartners = async (nativeLanguage: string, targetLanguage: string, userInterests: string): Promise<Partner[]> => {
  const prompt = `Generate a diverse list of 6 JSON objects representing language exchange partners.
    My native language is ${nativeLanguage}. I want to learn ${targetLanguage}.
    My interests are: ${userInterests}.
    Each partner should have a unique, culturally appropriate name.
    Their nativeLanguage should be ${targetLanguage} and their learningLanguage should be ${nativeLanguage}.
    Generate a diverse set of interests for them, some might align with mine.
    Return ONLY the JSON array.`;

  try {
    const data = await callGeminiProxy(prompt);
    // Use our new helper function to safely parse the response
    const partnersData = cleanAndParseJson(data.candidates[0].content.parts[0].text);
    return partnersData.map((p: any) => ({
      ...p,
      avatar: `https://api.dicebear.com/8.x/micah/svg?seed=${p.name}`,
    }));
  } catch (error) {
    console.error("Error generating partners:", error);
    throw new Error("Failed to generate AI partners. Please try again.");
  }
};

export const getChatResponse = async (messages: Message[], partner: Partner, corrections: boolean): Promise<Message> => {
  const conversationHistory = messages.map(m => `${m.sender === 'user' ? 'Me' : partner.name}: ${m.text}`).join('\n');
  const userLastMessage = messages[messages.length - 1].text;

  // This prompt is much more direct and less conversational to force JSON output.
  const prompt = `
    You are an AI language partner.
    Conversation history:
    ${conversationHistory}

    My last message was: "${userLastMessage}"

    Your task is to generate a response.
    ${corrections ? `I have requested corrections. If my last message has errors, provide a corrected version.` : ''}

    IMPORTANT: Your entire response must be a single, valid JSON object. Do not include any text, greetings, or explanations outside of the JSON object.

    The JSON object must have two string properties:
    1. "text": Your conversational reply to my last message.
    2. "correction": The corrected version of my last message. If there are no errors, this must be an empty string "".

    Example of a valid response:
    {
      "text": "Hello! It's nice to meet you too.",
      "correction": "It's nice to meet you."
    }

    Now, generate the JSON object for your response.
  `;

  try {
    const data = await callGeminiProxy(prompt);
    const aiResponse = cleanAndParseJson(data.candidates[0].content.parts[0].text);
    return {
      sender: 'ai',
      text: aiResponse.text,
      correction: aiResponse.correction || undefined,
    };
  } catch (error) {
    console.error("Error getting chat response:", error);
    return { sender: 'ai', text: "Sorry, I'm having trouble connecting right now." };
  }
};

export const getContent = async (topic: string, type: 'Grammar' | 'Vocabulary', language: string): Promise<string> => {
  const prompt = `You are a language teacher... (rest of your prompt is the same)`; // Abridged for clarity
  try {
    const data = await callGeminiProxy(prompt);
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error(`Error getting ${type} content:`, error);
    return `Failed to load content for "${topic}". Please try again.`;
  }
};

export const generateQuiz = async (topic: string, type: 'Grammar' | 'Vocabulary', language: string): Promise<QuizQuestion[]> => {
  const prompt = `Create a multiple-choice quiz with exactly 8 questions... (rest of your prompt is the same)`; // Abridged for clarity

  try {
    const data = await callGeminiProxy(prompt);
    // And finally, use the helper function here
    return cleanAndParseJson(data.candidates[0].content.parts[0].text);
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw new Error("Failed to generate quiz.");
  }
};