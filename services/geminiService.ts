import { Message, Partner, QuizQuestion, UserProfileData, TeachMeCache } from '../types';

// Make sure this is the correct URL for your deployed Cloud Function.
//const PROXY_URL = "https://us-central1-langcampus-exchange.cloudfunctions.net/geminiProxy"; // Replace if yours is different
//const TTS_PROXY_URL = "https://us-central1-langcampus-exchange.cloudfunctions.net/geminiTTS";
// Functions emulator addresses
const PROXY_URL =
  process.env.NODE_ENV === 'development'
    ? "http://127.0.0.1:5001/langcampus-exchange/us-central1/geminiProxy"
    : "https://us-central1-langcampus-exchange.cloudfunctions.net/geminiProxy";
const TTS_PROXY_URL =
   process.env.NODE_ENV === 'development'
    ? "http://127.0.0.1:5001/langcampus-exchange/us-central1/geminiTTS"
    : "https://us-central1-langcampus-exchange.cloudfunctions.net/geminiTTS";
const TRANSCRIBE_PROXY_URL =
  process.env.NODE_ENV === 'development'
    ? "http://127.0.0.1:5001/langcampus-exchange/us-central1/transcribeAudio"
    : "https://us-central1-langcampus-exchange.cloudfunctions.net/transcribeAudio";

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

export const synthesizeSpeech = async (text: string, languageCode: string, gender: 'male' | 'female'): Promise<string> => {
  try {
    const response = await fetch(TTS_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, languageCode, gender }),
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
    Each partner must also have a "gender" field, set to either "**male**" or "**female**". **Crucially, generate exactly 6 unique partners.**
    Their nativeLanguage should be ${targetLanguage} and their learningLanguage should be ${nativeLanguage}.
    Generate a diverse set of interests for them, some might align with mine.
    Return ONLY the JSON array.`;

  try {
    const data = await callGeminiProxy(prompt);
    const rawText = data.candidates[0].content.parts[0].text;

    // --- DEBUG LOGGING RAW AI RESPONSE ---
    console.log("--- DEBUG: Raw AI Partner Response ---");
    console.log(rawText);
    console.log("--- END RAW RESPONSE ---");

    // Use our new helper function to safely parse the response
    const partnersData = cleanAndParseJson(rawText);

    if (!Array.isArray(partnersData)) {
      console.error("AI did not return a valid array for partners:", partnersData);
      return []; 
    }

    const finalPartners = partnersData
      .filter((p: any) => {
        // Function to strip ** and lowercase
        const cleanedGender = p.gender?.replace(/\*\*/g, '').toLowerCase();

        return (
          p && 
          p.name && 
          p.nativeLanguage && 
          p.learningLanguage && 
          Array.isArray(p.interests) && 
          (cleanedGender === 'male' || cleanedGender === 'female') 
        );
      })
      .map((p: any) => {
        // Ensure the final object uses cleaned, consistent lowercase gender values
        const cleanedGender = p.gender?.replace(/\*\*/g, '').toLowerCase();
        
        return {
          ...p,
          avatar: `https://api.dicebear.com/8.x/micah/svg?seed=${p.name}`,
          gender: cleanedGender === 'female' ? 'female' : 'male',
        };
      });

    // --- DEBUG LOGGING FINAL FILTERED LIST ---
    console.log("--- DEBUG: Final Filtered Partners ---");
    console.log("Count:", finalPartners.length);
    console.log(finalPartners);
    console.log("--- END FILTERED RESPONSE ---");

    return finalPartners;
  } catch (error) {
    console.error("Error generating partners:", error);
    throw new Error("Failed to generate AI partners. Please try again.");
  }
};

export const getChatResponse = async (messages: Message[], partner: Partner, corrections: boolean, userProfile: UserProfileData, teachMeCache: TeachMeCache | null, isGroupChat: boolean): Promise<Message> => {
  if (!partner || !partner.name) {
    console.error("getChatResponse called with an invalid partner object.");
    return { sender: 'ai', text: "Sorry, there's a problem with my memory. Please try starting a new chat." };
  }

  const conversationHistory = messages.map(m => `${m.sender === 'user' ? 'Me' : partner.name}: ${m.text}`).join('\n');
  const userLastMessage = messages[messages.length - 1].text;
  const lastUserMessage = messages.findLast(m => m.sender === 'user');
  const userToAddress = lastUserMessage?.senderName || userProfile?.name || 'the user';

  let interactionContext;
  if (isGroupChat) {
    interactionContext = `
    **Current Interaction:**
    You are talking to a group of users. The person you are specifically responding to now is named **${userToAddress}**.
    The overall user profile (for context on hobbies, etc.) belongs to: ${userProfile?.name || 'a user'}. Their interests are: ${userProfile?.hobbies || 'not specified'}.
    `;
  } else {
    interactionContext = `
    **Current Interaction:**
    You are talking to ${userProfile?.name || 'a user'}.
    The user's interests include: ${userProfile?.hobbies || 'not specified'}.
    The user's bio says: "${userProfile?.bio || 'not specified'}".
    `;
  }

  const teachMeTopicInfo = teachMeCache?.topic
    ? `The user is currently studying the topic "${teachMeCache.topic}" in the "Teach Me" module.`
    : "";

    console.log("teach me topic info: " + teachMeTopicInfo);

  const prompt = `
    **Background Context:** You are an AI language exchange partner within a web application called "Langcampus Exchange". Your purpose is to help users practice their target language in a friendly and supportive way. Always be encouraging.

    You are an AI language exchange partner. Your name is ${partner.name}.
    Your native language is ${partner.nativeLanguage}.
    You are learning ${partner.learningLanguage}.
    Your interests include: ${partner.interests.join(', ')}.

    ${interactionContext}
    
    ${teachMeTopicInfo} 

    Conversation History:
    ${conversationHistory}

    My last message to you was: "${userLastMessage}"

    **Your Task:**
    Your main goal is to help the user practice your native language (${partner.nativeLanguage}). Therefore, you should primarily respond in ${partner.nativeLanguage}.
    
    **EXCEPTION:** If the user's last message is in their native language (${partner.learningLanguage}), it means they might be confused or asking for help. In this case, **you should respond in their native language (${partner.learningLanguage})** to be helpful and explain things clearly.
    
    ${corrections ? `The user wants corrections. If their last message contains errors in your native language (${partner.nativeLanguage}), provide a simple correction.` : ''}

    **IMPORTANT:** Your entire response must be a single, valid JSON object. Do not include any text outside of the JSON object.

    The JSON object must have three string properties:
    1. "text": Your conversational reply. This can be in either your native language OR the user's native language, depending on the rule above.
    2. "correction": The corrected version of the user's last message if it was in your native language and had errors. If there are no errors, or if the user spoke in their own language, this must be an empty string "".
    3. "translation": If you reply in your native language (${partner.nativeLanguage}), provide a simple translation of your reply into the user's language (${partner.learningLanguage}). If you reply in the user's native language, this must be an empty string "".

    Example 1 (User speaks target language):
    User message: "Hola! ¿Comó estás?"
    Your JSON response:
    {
      "text": "¡Hola! Estoy muy bien, gracias. ¿Y tú?",
      "correction": "¿Cómo estás?",
      "translation": "Hi! I'm very well, thank you. And you?"
    }

    Example 2 (User speaks their native language):
    User message: "Sorry, I don't understand what 'biblioteca' means."
    Your JSON response:
    {
      "text": "No problem! 'Biblioteca' means 'library' in Spanish. It's a place where you can borrow books.",
      "correction": "",
      "translation": ""
    }

    Now, generate the JSON object for your response based on my last message.
  `;

  try {
    const data = await callGeminiProxy(prompt);
    const rawText = data.candidates[0].content.parts[0].text;
    
    let aiResponse;
    try {
      aiResponse = cleanAndParseJson(rawText);
    } catch (e) {
      console.warn("AI returned a non-JSON response. Treating as plain text.", rawText);
      aiResponse = { text: rawText, correction: "", translation: "" };
    }

    const responseMessage: Message = {
      sender: 'ai',
      text: aiResponse.text || "Sorry, I'm having trouble thinking right now."
    };

    if (aiResponse.correction) {
      responseMessage.correction = aiResponse.correction;
    }
    if (aiResponse.translation) {
      responseMessage.translation = aiResponse.translation;
    }

    return responseMessage;

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

export const generateQuiz = async (topic: string, type: 'Grammar' | 'Vocabulary', targetLanguage: string, nativeLanguage: string, level: number): Promise<QuizQuestion[]> => {
  const questionLanguage = level === 1 ? nativeLanguage : targetLanguage;
  
  const prompt = `
    You are a language teacher creating a quiz for a student whose native language is ${nativeLanguage}.
    The student is learning ${targetLanguage}.
    Your task is to generate a multiple-choice quiz based on the provided topic.

    Topic: "${topic}"
    Quiz Level: ${level}
    Number of Questions: 8

    **IMPORTANT INSTRUCTIONS:**
    1.  The quiz QUESTIONS must be written in: **${questionLanguage}**.
    2.  The multiple-choice OPTIONS and the CORRECT ANSWER must be written in: **${targetLanguage}**.
    3.  Your entire response MUST be a single, valid JSON array.
    4.  Do NOT include any text, greetings, titles, answer keys, or explanations outside of the JSON array.
    5.  Each element in the array must be a JSON object representing one question with three properties: "question", "options" (an array of 4 strings), and "correctAnswer".

    Example for a Level 1 quiz for an English speaker learning Spanish:
    [
      {
        "question": "Which of these means 'the house'?",
        "options": ["el libro", "la casa", "un gato", "la mesa"],
        "correctAnswer": "la casa"
      }
    ]

    Now, generate the JSON array for the quiz about "${topic}".
  `;

  try {
    const data = await callGeminiProxy(prompt, "gemini-2.5-flash");
    const rawText = data.candidates[0].content.parts[0].text;
    const quizData = cleanAndParseJson(rawText);

    if (!Array.isArray(quizData) || quizData.length === 0) {
      throw new Error("AI returned an empty or invalid array for the quiz.");
    }

    return quizData;
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw new Error("Failed to generate quiz. The AI may have returned an invalid format.");
  }
};

export const transcribeAudio = async (audioBlob: Blob, languageCode: string): Promise<string> => {
  try {
    // Convert Blob to a base64 string
    const reader = new FileReader();
    const base64String = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(audioBlob);
    });

    const response = await fetch(TRANSCRIBE_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audioBytes: base64String, languageCode }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from transcription proxy function:", errorText);
      throw new Error(`Transcription proxy request failed: ${errorText}`);
    }

    const data = await response.json();
    return data.transcription || "";
  } catch (error) {
    console.error("Error calling the transcription proxy function:", error);
    throw error;
  }
};

export const getNudgeResponse = async (messages: Message[], partner: Partner, userProfile: UserProfileData, nativeLanguage: string): Promise<Message> => {
  if (!partner || !partner.name) {
    console.error("getNudgeResponse called with an invalid partner object.");
    return { sender: 'ai', text: "Something went wrong.", correction: "", translation: "" };
  }

  const conversationHistory = messages.map(m => `${m.sender === 'user' ? 'Me' : partner.name}: ${m.text}`).join('\n');

  const prompt = `
    **Background Context:** You are an AI language exchange partner named ${partner.name}. You are talking to ${userProfile.name || 'a user'}.
    The user has not responded for a little while. Your task is to gently re-engage them with a short, friendly, open-ended question in your native language, ${partner.nativeLanguage}.
    Keep it simple and relevant to the conversation if possible. Do not mention that they have been quiet. Just continue the conversation naturally.

    Your native language is ${partner.nativeLanguage}.

    Conversation History:
    ${conversationHistory}

    **Your Task:**
    Generate a single JSON object with a "text" property containing your re-engagement question in ${partner.nativeLanguage} and a "translation" property with the translation into the user's native language, **${nativeLanguage}**.

    Example Response:
    {
      "text": "À quoi penses-tu ?",
      "translation": "What are you thinking about?"
    }

    Now, generate the JSON object for your response.
  `;

  try {
    const data = await callGeminiProxy(prompt);
    const rawText = data.candidates[0].content.parts[0].text;
    const aiResponse = cleanAndParseJson(rawText);

    const responseMessage: Message = {
      sender: 'ai',
      text: aiResponse.text || "...",
      translation: aiResponse.translation || ""
    };

    return responseMessage;
  } catch (error) {
    console.error("Error getting nudge response:", error);
    return { sender: 'ai', text: "Sorry, I lost my train of thought.", correction: "", translation: "" };
  }
};

export const getInitialWelcomeMessage = async (partner: Partner): Promise<Message> => {
  const prompt = `
    **Background Context:** You are an AI language exchange partner within a web application called "Langcampus Exchange". Your purpose is to welcome new users and start a conversation.

    You are an AI language exchange partner. Your name is ${partner.name}.
    Your native language is ${partner.nativeLanguage}.
    You are learning ${partner.learningLanguage}.
    Your interests include: ${partner.interests.join(', ')}.

    **Your Task:**
    Generate a warm, friendly, and open-ended welcome message in your native language (${partner.nativeLanguage}). Introduce yourself (your name and the languages you speak/learn). End with a simple question to start the conversation naturally.
    
    **IMPORTANT:** Your entire response must be a single, valid JSON object. Do not include any text outside of the JSON object.

    The JSON object must have three string properties:
    1. "text": Your welcome reply.
    2. "correction": Must be an empty string "".
    3. "translation": A simple translation of your reply into the user's language (${partner.learningLanguage}).

    Now, generate the JSON object for your welcome message.
  `;

  try {
    const data = await callGeminiProxy(prompt);
    const rawText = data.candidates[0].content.parts[0].text;
    const aiResponse = cleanAndParseJson(rawText);

    const responseMessage: Message = {
      sender: 'ai',
      text: aiResponse.text || `Hi, I'm ${partner.name}. Let's chat!`,
      translation: aiResponse.translation || "",
      correction: aiResponse.correction || ""
    };

    return responseMessage;
  } catch (error) {
    console.error("Error getting initial welcome message:", error);
    // Fallback message
    return { sender: 'ai', text: `Hi, I'm ${partner.name}. Let's chat!`, translation: "", correction: "" };
  }
};