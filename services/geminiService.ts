import { Message, Partner, QuizQuestion } from '../types';

// Make sure this is the correct URL for your deployed Cloud Function.
const PROXY_URL = "https://us-central1-langcampus-exchange.cloudfunctions.net/geminiProxy"; // Replace if yours is different
const TTS_PROXY_URL = "https://us-central1-langcampus-exchange.cloudfunctions.net/geminiTTS";


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

export const synthesizeSpeech = async (text: string, languageCode: string): Promise<string> => {
  try {
    const response = await fetch(TTS_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, languageCode }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from TTS proxy function:", errorText);
      throw new Error(`TTS proxy request failed: ${errorText}`);
    }

    const data = await response.json();
    return data.audioContent;
  } catch (error) {
    console.error("Error calling the TTS proxy function:", error);
    throw error;
  }
}

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

export const getChatResponse = async (messages: Message[], partner: Partner, corrections: boolean, userProfile: UserProfileData): Promise<Message> => {
  const conversationHistory = messages.map(m => `${m.sender === 'user' ? userProfile.name || 'Me' : partner.name}: ${m.text}`).join('\n');
  const userLastMessage = messages[messages.length - 1].text;

  const prompt = `You are ${partner.name}, a friendly language exchange partner. Your native language is ${partner.nativeLanguage}.

  You are talking to ${userProfile.name || 'a new friend'}. Their hobbies are ${userProfile.hobbies || 'not specified'}, and their bio is: "${userProfile.bio || 'not specified'}". Use this information to make the conversation more personal and engaging.

  Our conversation so far:
  ${conversationHistory}
  
  Your personality is encouraging and curious. Keep your response concise and natural, like a real chat message.
  
  ${corrections ? `I have asked for corrections. If my last message "${userLastMessage}" has any grammatical errors, please provide a correction.` : `Respond naturally to my last message: "${userLastMessage}"`}
  
  Your entire response must be a single, valid JSON object with two properties: "text" (your conversational reply) and "correction" (the corrected version of my last message, or an empty string "" if no correction is needed).`;

  try {
    const data = await callGeminiProxy(prompt);
    // This is our robust JSON cleaning function from before
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

export const getContent = async (topic: string, type: 'Grammar' | 'Vocabulary', targetLanguage: string, nativeLanguage: string): Promise<string> => {
  const prompt = `
    You are an expert language teacher. Your student's native language is ${nativeLanguage}.
    Your task is to provide a clear and comprehensive explanation for a language learner about a topic in their TARGET language, which is ${targetLanguage}.

    **IMPORTANT INSTRUCTION:** Write the entire explanation in the student's NATIVE language (${nativeLanguage}). However, all examples of the target language must be clearly presented in ${targetLanguage}, followed by a translation into ${nativeLanguage}.

    Language to Teach (Target Language): ${targetLanguage}
    Language of Instruction (Native Language): ${nativeLanguage}
    Topic Type: ${type}
    Selected Topic: "${topic}"

    Please provide a detailed lesson on this topic, following all instructions above. Use Markdown for formatting (headings, bold text, lists).
    Return ONLY the lesson content in Markdown format. Do not include any conversational pleasantries or introductions.
    `;
  try {
    const data = await callGeminiProxy(prompt);
    // The response is expected to be Markdown text directly
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