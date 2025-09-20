
import { GoogleGenAI, Type } from "@google/genai";
import { Message, Partner, QuizQuestion } from '../types';

if (!process.env.API_KEY) {
    console.warn("API_KEY environment variable not set. Using a placeholder. The app may not function correctly.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "YOUR_API_KEY_HERE" });

const partnerSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      nativeLanguage: { type: Type.STRING },
      learningLanguage: { type: Type.STRING },
      interests: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["name", "nativeLanguage", "learningLanguage", "interests"],
  },
};

const quizSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.STRING },
        },
        required: ["question", "options", "correctAnswer"],
    },
};

export const generatePartners = async (nativeLanguage: string, targetLanguage: string, userInterests: string): Promise<Partner[]> => {
  try {
    const prompt = `Generate a diverse list of 6 JSON objects representing language exchange partners.
      My native language is ${nativeLanguage}. I want to learn ${targetLanguage}.
      My interests are: ${userInterests}.
      Each partner should have a unique, culturally appropriate name.
      Their nativeLanguage should be ${targetLanguage} and their learningLanguage should be ${nativeLanguage}.
      Generate a diverse set of interests for them, some might align with mine.
      Return ONLY the JSON array.`;
      
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: partnerSchema,
      },
    });

    const partnersData = JSON.parse(response.text);
    return partnersData.map((p: any) => ({
      ...p,
      avatar: `https://api.dicebear.com/8.x/micah/svg?seed=${p.name}`,
    }));
  } catch (error) {
    console.error("Error generating partners:", error);
    throw new Error("Failed to generate AI partners. Please check your API key and try again.");
  }
};

export const getChatResponse = async (messages: Message[], partner: Partner, corrections: boolean): Promise<Message> => {
    const conversationHistory = messages.map(m => `${m.sender === 'user' ? 'Me' : partner.name}: ${m.text}`).join('\n');
    const userLastMessage = messages[messages.length - 1].text;

    const prompt = `You are ${partner.name}, a friendly language exchange partner. Your native language is ${partner.nativeLanguage} and you are learning ${partner.learningLanguage}.
      Our conversation so far:
      ${conversationHistory}
      
      Your personality is encouraging and curious. Keep your response concise and natural, like a real chat message.
      
      ${corrections ? `I have asked for corrections. If my last message "${userLastMessage}" has any grammatical errors, spelling mistakes, or unnatural phrasing for a ${partner.nativeLanguage} speaker, please provide a correction.
      Format the correction clearly and kindly. Start your response with the corrected version of my message, then add your conversational reply.
      If my message is perfect, just give your normal reply and maybe a compliment on my language skills!` : `Respond naturally to my last message: "${userLastMessage}"`}
      
      Generate your response as a JSON object with two fields: "text" (your conversational reply) and "correction" (the corrected version of my last message, or an empty string if no correction is needed).`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING },
                        correction: { type: Type.STRING },
                    }
                }
            }
        });
        const aiResponse = JSON.parse(response.text);
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
    const prompt = `You are a language teacher. Explain the following ${type.toLowerCase()} topic for a ${language} learner: "${topic}".
    Use markdown for formatting. For grammar, provide clear rules and examples. For vocabulary, provide a list of words with definitions and example sentences.
    The explanation should be comprehensive yet easy to understand.`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error(`Error getting ${type} content:`, error);
        return `Failed to load content for "${topic}". Please try again.`;
    }
};

export const generateQuiz = async (topic: string, type: 'Grammar' | 'Vocabulary', language: string): Promise<QuizQuestion[]> => {
    const prompt = `Create a multiple-choice quiz with exactly 8 questions about the ${type.toLowerCase()} topic "${topic}" for a ${language} learner.
    Each question must be a JSON object with "question", "options" (an array of 4 strings), and "correctAnswer" (one of the strings from options).
    The questions should be challenging but fair.
    Return ONLY the JSON array of questions.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: quizSchema,
            },
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error generating quiz:", error);
        throw new Error("Failed to generate quiz.");
    }
};
