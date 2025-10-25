import { Message, Partner, QuizQuestion, UserProfileData, TeachMeCache, YouTubeVideo, FlashcardSettings } from '../types';

// Make sure this is the correct URL for your deployed Cloud Function.
//const PROXY_URL = "https://us-central1-langcampus-exchange.cloudfunctions.net/geminiProxy"; // Replace if yours is different
//const TTS_PROXY_URL = "https://us-central1-langcampus-exchange.cloudfunctions.net/geminiTTS";
// Functions emulator addresses
// Use relative paths for development to leverage the Vite proxy.
const PROXY_URL =
  process.env.NODE_ENV === 'development'
    ? "/geminiProxy"
    : "https://us-central1-langcampus-exchange.cloudfunctions.net/geminiProxy";
const TTS_PROXY_URL =
   process.env.NODE_ENV === 'development'
    ? "/googleCloudTTS"
    : "https://us-central1-langcampus-exchange.cloudfunctions.net/googleCloudTTS";
const TRANSCRIBE_PROXY_URL =
  process.env.NODE_ENV === 'development'
    ? "/transcribeAudio"
    : "https://us-central1-langcampus-exchange.cloudfunctions.net/transcribeAudio";
const YOUTUBE_PROXY_URL =
  process.env.NODE_ENV === 'development'
    ? "/youtubeProxy"
    : "https://us-central1-langcampus-exchange.cloudfunctions.net/youtubeProxy";
const IMAGEN_PROXY_URL =
  process.env.NODE_ENV === 'development'
    ? "/imagenProxy"
    : "https://us-central1-langcampus-exchange.cloudfunctions.net/imagenProxy";
const IMAGE_SEARCH_PROXY_URL =
  process.env.NODE_ENV === 'development'
    ? "/imageSearchProxy"
    : "https://us-central1-langcampus-exchange.cloudfunctions.net/imageSearchProxy";

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

export const searchYoutubeVideos = async (topic: string, languageName: string): Promise<YouTubeVideo[]> => {
  try {
    const response = await fetch(YOUTUBE_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic, languageName }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error from YouTube proxy function:", errorText);
      throw new Error(`YouTube proxy request failed: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error calling the YouTube proxy function:", error);
    throw error;
  }
};

// ADD: A map to associate languages with various skin and hair tones.
const colorMap: Record<string, { skin: string[], hair: string[] }> = {
  'English': { skin: ['d08b5b', 'ae5d29', '614335'], hair: ['6a4e35', '2c1b18', 'b58143'] },
  'Spanish': { skin: ['b26f3d', 'f2d3b1', 'd08b5b'], hair: ['2c1b18', '4d3313'] },
  'French': { skin: ['f2d3b1', 'd08b5b'], hair: ['b58143', '906945', '4d3313'] },
  'German': { skin: ['f2d3b1', 'd08b5b'], hair: ['b58143', '906945', 'e3c098'] },
  'Italian': { skin: ['d08b5b', 'f2d3b1'], hair: ['2c1b18', '4d3313'] },
  'Portuguese': { skin: ['b26f3d', 'd08b5b', '8d5524'], hair: ['2c1b18', '4d3313'] },
  'Japanese': { skin: ['f2d3b1', 'ffdbb4'], hair: ['0e0e0e', '2c1b18'] },
  'Korean': { skin: ['f2d3b1', 'ffdbb4'], hair: ['0e0e0e', '2c1b18'] },
  'Chinese': { skin: ['f2d3b1', 'ffdbb4'], hair: ['0e0e0e', '2c1b18'] },
  'Russian': { skin: ['f2d3b1', 'd08b5b'], hair: ['b58143', '906945', 'd06b3a'] },
  'Arabic': { skin: ['ae5d29', '8d5524'], hair: ['0e0e0e', '2c1b18'] },
  'Hindi': { skin: ['8d5524', 'ae5d29', '614335'], hair: ['0e0e0e', '2c1b18'] },
  'Vietnamese': { skin: ['f2d3b1', 'ffdbb4'], hair: ['0e0e0e', '2c1b18'] },
  'Mongolian': { skin: ['f2d3b1', 'd08b5b'], hair: ['0e0e0e', '2c1b18'] },
  'Polish': { skin: ['f2d3b1', 'd08b5b'], hair: ['b58143', '906945'] },
  'Esperanto': { skin: ['f2d3b1', 'd08b5b', 'ae5d29'], hair: ['b58143', '906945', '2c1b18'] }
};

/**
 * A helper function to call our secure Firebase Cloud Function proxy.
 * @param prompt The text prompt to send to the Gemini API.
 * @returns The JSON response from the API.
 */
export const callGeminiProxy = async (prompt: string, model: string = "gemini-2.5-flash-lite") => {
  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, model }),
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

export const tagTextForTTS = async (text: string, primaryLanguageCode: string, foreignVoiceName: string): Promise<string> => { 
    const prompt = `
      Analyze the following text. Your task is to prepare it for multilingual Text-to-Speech (TTS) synthesis.
      The entire message will be spoken using the primary voice for ${primaryLanguageCode}.
      
      The voice model for the *foreign* language part is guaranteed to be "${foreignVoiceName}".
      
      **Instruction:**
      1. Identify all text segments that belong to a language **other than** ${primaryLanguageCode}.
      2. For each identified segment, wrap the entire segment in a <voice> tag with the name attribute set to the foreign voice name.
      3. Do NOT wrap punctuation, parenthetical translations, or the other half of a split language phrase if it is the base language.
      4. The final result MUST be a single, valid SSML string enclosed in a single <speak> tag.
      
      **Example 1 (Input: "결제 (Payment)", Primary: en-US, Foreign Voice: ko-KR-Wavenet-A):**
      Output: "<speak><voice name="ko-KR-Wavenet-A">결제</voice> (Payment)</speak>"

      **Example 2 (Input: "I like to eat 볶음밥.", Primary: en-US, Foreign Voice: ko-KR-Wavenet-A):**
      Output: "<speak>I like to eat <voice name="ko-KR-Wavenet-A">볶음밥</voice>.</speak>"

      Now, process this text: "${text}"
    `;

    try {
        const data = await callGeminiProxy(prompt);
        let ssmlText = data.candidates[0].content.parts[0].text;
        
        ssmlText = ssmlText.replace(/^```(xml|ssml)?\s*/, '').replace(/```$/, '').trim();

        if (ssmlText.startsWith('<speak>') && ssmlText.endsWith('</speak>')) {
            return ssmlText;
        } else {
            // Fallback for Gemini errors, which should be rare with this detailed prompt
            logger.error("Gemini returned non-SSML, using fallback:", ssmlText);
            return `<speak>${text}</speak>`;
        }
    } catch (error) {
        console.error("Error tagging text for TTS:", error);
        return `<speak>${text}</speak>`;
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
        const cleanedGender = p.gender?.replace(/\*\*/g, '').toLowerCase();

        const options = new URLSearchParams({
            seed: p.name // The seed is still based on the name for consistency
        });

        const languageColors = colorMap[p.nativeLanguage] || colorMap['English'];
        const skinColor = languageColors.skin[Math.floor(Math.random() * languageColors.skin.length)];
        const hairColor = languageColors.hair[Math.floor(Math.random() * languageColors.hair.length)];

        options.append('skinColor', skinColor);
        options.append('hairColor', hairColor);

        if (cleanedGender === 'female') {
            options.append('facialHairProbability', '0'); // No beards for females
            options.append('earringsProbability', '80'); // High chance of earrings
            options.append('hair', 'pixie,dannyPhantom,full'); // Feminine hairstyles
            options.append('eyebrows', 'up,eyelashesUp,eyelashesDown');
            options.append('eyes', 'smiling,eyes,round');
        } else {
            options.append('earringsProbability', '0'); // No earrings for males
            options.append('facialHairProbability', '40'); // Chance of facial hair
            options.append('hair', 'fonze,dougFunny,mrT,,mrClean,turban'); // Masculine hairstyles
            options.append('eyebrows', 'up,down');
            options.append('eyes', 'eyes,round,smiling');
        }

        const avatarUrl = `https://api.dicebear.com/8.x/micah/svg?${options.toString()}`;

        return {
          ...p,
          avatar: avatarUrl, // Use the new fully customized URL
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
    The overall user profile (for context on hobbies, etc.) belongs to: ${userProfile?.name || 'a user'}.

    - User's Age: ${userProfile.age}
    - User's Rank: ${userProfile.rank}
    - User's Interests: ${userProfile?.hobbies || 'not specified'}.
    `;
  } else {
    interactionContext = `
    **Current Interaction:**
    ou are talking to ${userProfile?.name || 'a user'}.

    - User's Age: ${userProfile.age}
    - User's Rank: ${userProfile.rank}
    - User's Interests: ${userProfile?.hobbies || 'not specified'}.
    - User's Bio: "${userProfile?.bio || 'not specified'}".
    `;
  }

  const teachMeTopicInfo = teachMeCache?.topic
    ? `The user is currently studying the topic "${teachMeCache.topic}" in the "Teach Me" module.`
    : "";

    console.log("teach me topic info: " + teachMeTopicInfo);

  const prompt = `
    **Background Context:** You are an AI language exchange partner within a web application called "Langcampus Exchange". Your purpose is to help users practice their target language in a friendly and supportive way. Always be encouraging and adapt your conversation to the user's details.

    **App Feature Knowledge:**

    - **Teach Me Module:** This is a core feature accessed via a "Book" icon in the chat. It allows users to get lessons on grammar and vocabulary, and then take quizzes. Users can share quiz results with you to get help and feedback. You should encourage them to use it if they are struggling with a concept. For example, if they make a grammar mistake, you can say, "Good try! A small correction is... By the way, there's a great lesson on this in the 'Teach Me' module if you want to review it."
    - **XP and Ranks:** Users gain XP for sending messages and completing quizzes. Their rank (like Novice, Apprentice, Journeyman, Expert, Master) reflects their progress. You can occasionally congratulate them on their rank or encourage them to keep practicing to rank up.

    **CRITICAL ROLE NOTE:** When a user shares quiz results, your response must be **encouraging, focused on the topics/questions the user missed, and friendly**, acknowledging this as part of the real-time learning process.

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
    
    ${corrections ? `
    **Correction Instructions:**
    The user wants corrections. Your task is to analyze the user's last message for any errors in ${partner.nativeLanguage}.
    - If there are errors (grammatical, spelling, unnatural phrasing), you MUST provide a correction.
    - The "correction" field in your JSON response should contain the corrected sentence followed by a concise, clear explanation of the mistake.
    - **Start the correction by stating the corrected sentence, then briefly explain WHY it was corrected.** This is crucial.
    - If the user's message is perfect and natural, the "correction" field MUST be an empty string "".
    - If the user's message is identical to the correction, the "correction" field MUST be an empty string "".
    - Do not correct messages that are in the user's native language (${partner.learningLanguage}). In that case, the "correction" field must be an empty string "".
    
    **Good Correction Example:**
    User's message: "Yo ser feliz."
    "correction": "The correct sentence is 'Yo soy feliz.' We use 'soy' (from the verb 'ser') to talk about states of being or characteristics, not the infinitive 'ser'."

    **Bad Correction Example (what to avoid):**
    "correction": "Yo soy feliz."
    ` : ''}

    **IMPORTANT:** Your entire response must be a single, valid JSON object. Do not include any text outside of the JSON object.

    **MARKDOWN INSTRUCTION:** For any response that requires structure (e.g., explaining complex topics, responding to a detailed quiz summary, or providing detailed feedback), **use Markdown formatting (bold, lists, headings) in the "text" field for clarity.**

    The JSON object must have three string properties:
    1. "text": Your conversational reply. This can be in either your native language OR the user's native language, depending on the rule above.
    2. "correction": The corrected version of the user's last message if it was in your native language and had errors. If there are no errors, or if the user spoke in their own language, this must be an empty string "".
    3. "translation": If you reply in your native language (${partner.nativeLanguage}), provide a simple translation of your reply into the user's language (${partner.learningLanguage}). If you reply in the user's native language, this must be an empty string "".

    Example 1 (User speaks target language):
    User message: "Hola! ¿Comó estás?"
    Your JSON response:
    {
      "text": "¡Hola! Estoy muy bien, gracias. ¿Y tú?",
      "correction": "The correct sentence is '¿Cómo estás?'. The word 'como' needs an accent mark when it's used in a question.",
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

    **Correct and Incorrect Examples:**
    For each key point, provide at least one correct example and one incorrect example.
    - Correct examples must be preceded by the "✅" emoji.
    - Incorrect examples must be preceded by the "❌" emoji and followed by a brief explanation of why it is incorrect.

    **Formatting Guidelines:**
    Use rich Markdown formatting to make the lesson easy to read and engaging. Specifically:
    - Use headings (#, ##, ###) to structure the content.
    - Use bold text (**text**) for emphasis on key terms.
    - Use italic text (*text*) for highlighting or nuanced points.
    - Use numbered lists (1., 2., 3.) for steps or ordered information.
    - Use bulleted lists (* or -) for unordered information.
    - Use inline code backticks (\`text\`) as an "accent font" to make specific words or short phrases stand out.
    - Use HTML <u>text</u> tags for underlining when necessary.

    Language to Teach (Target Language): ${targetLanguage}
    Language of Instruction (Native Language): ${nativeLanguage}
    Topic Type: ${type}
    Selected Topic: "${topic}"

    Please provide a detailed lesson on this topic, following all instructions above.
    Return ONLY the lesson content in Markdown format. Do not include any conversational pleasantries or introductions.
    `;
  try {
    // FIX: Add a client-side log to confirm the code reaches the network call point
    console.log(`[GEMINI SERVICE] Attempting network call for: ${topic} (${type} - ${targetLanguage})`);
    
    // CRITICAL FIX: Pass the model name explicitly to the helper function
    const data = await callGeminiProxy(prompt, "gemini-2.5-flash"); // Use Pro for complex lesson generation
    // The response is expected to be Markdown text directly
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error(`Error getting ${type} content:`, error);
    return `Failed to load content for "${topic}". Please try again.`;
  }
};

export const comparePronunciation = async (originalText: string, userTranscription: string, targetLanguage: string): Promise<string> => {
  const prompt = `
    You are a language pronunciation coach for ${targetLanguage}. Your task is to compare a user's transcribed speech to an original text and provide helpful feedback.

    - **Original Text:** "${originalText}"
    - **User's Transcription:** "${userTranscription}"

    **Instructions:**
    1.  Analyze the transcription against the original text. Be aware that speech-to-text can sometimes make phonetic mistakes (e.g., transcribing the letter "Q" as the word "you").
    2.  If the transcription is identical or a very close phonetic match, congratulate the user on their excellent pronunciation.
    3.  If there are differences, gently point them out. Use **bold** for key words and \`inline code\` for phonetic transcriptions or difficult words.
    4.  Keep the feedback encouraging, clear, and in English.
    5.  **Use Markdown formatting (bold, lists, code) to organize your response.**

    Now, provide your feedback.
  `;
  try {
    const data = await callGeminiProxy(prompt);
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error comparing pronunciation:", error);
    return "Sorry, I couldn't analyze your speech right now.";
  }
};

export const generateQuiz = async (topic: string, type: 'Grammar' | 'Vocabulary', targetLanguage: string, nativeLanguage: string, level: number): Promise<QuizQuestion[]> => {
  const questionLanguage = level === 1 ? nativeLanguage : targetLanguage;
  
  const prompt = `
    You are a language teacher creating a quiz for a student whose native language is ${nativeLanguage}.
    The student is learning ${targetLanguage}.
    Your task is to generate a varied, 12-question quiz based on the provided topic.

    Topic: "${topic}"
    Quiz Level: ${level}
    Number of Questions: 12

    **Question Type Distribution:**
    - 6 questions (50%) must be 'multiple-choice'.
    - 2 questions (~20%) must be 'matching'.
    - 2 questions (~20%) must be 'fill-in-the-blank'.
    - 1 question (~10%) must be a 'speaking' exercise.
    - 1 question (~10%) must be a 'listening' exercise.

    **JSON Response Instructions:**
    - Your entire response MUST be a single, valid JSON array of 12 question objects.
    - Do NOT include any text, greetings, titles, or explanations outside of the JSON array.
    - Each object must have a "type" property corresponding to the question type.

    **JSON Object Formats:**
    1.  **Multiple Choice:**
        {
          "type": "multiple-choice",
          "question": "The question text in ${questionLanguage}",
          "options": ["option1", "option2", "option3", "option4"], // Options in ${targetLanguage}
          "correctAnswer": "the correct option text"
        }
    2.  **Matching:**
        {
          "type": "matching",
          "question": "Match the terms with their definitions.", // In ${questionLanguage}
          "pairs": [
            { "term": "Term A", "definition": "Definition A" }, // Both in ${targetLanguage}
            { "term": "Term B", "definition": "Definition B" },
            { "term": "Term C", "definition": "Definition C" },
            { "term": "Term D", "definition": "Definition D" }
          ]
        }
    3.  **Fill in the Blank:**
        {
          "type": "fill-in-the-blank",
          "question": "Sentence with a ___ blank.", // In ${targetLanguage}
          "correctAnswer": "word" // In ${targetLanguage}
        }
    4.  **Speaking:**
        {
          "type": "speaking",
          "question": "Please read the following aloud.", // In ${questionLanguage}
          "sentenceToRead": " A short, relevant word, letter, or phrase from the topic in ${targetLanguage}."
        } 
    5.  **Listening:**
        {
          "type": "listening",
          "question": "Listen and type what you hear.", // In ${questionLanguage}
          "correctAnswer": "The sentence to be synthesized and transcribed.", // In ${targetLanguage}
          "sentenceToRead": "A relevant and simple sentence from the topic in ${targetLanguage}."
        }

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

export const validateQuizAnswers = async (
  questions: QuizQuestion[],
  userAnswers: (string | string[])[],
  targetLanguage: string,
  nativeLanguage: string
): Promise<ValidatedQuizResult[]> => {
  const prompt = `
    You are the **Master Grader AI**, an absolute expert in ${targetLanguage} semantics, grammar, and pragmatics. Your job is to evaluate student answers with a **focus on conceptual understanding and real-world communication**, not just strict matching to the answer key. The user is a ${nativeLanguage} speaker learning ${targetLanguage}.

    **Primary Goal:** Only mark an answer as FALSE if the student's answer demonstrates a clear misunderstanding of the concept or rule being tested. **Be generous, flexible, and assume the most positive intent.**

    **Detailed Grading Instructions (for the Master Grader AI):**
    
    1.  **Multiple Choice & Fill-in-the-Blank:**
        - **Allow** for minor spelling or punctuation errors, capitalization differences, or slight variations in phrasing if the **meaning is unambiguously correct and grammatically plausible**.
        - **Allow** synonyms or grammatically equivalent phrases in place of the 'correctAnswer' if they are perfectly natural in ${targetLanguage}.
        - For numbers, accept both digit form (e.g., "3") and word form (e.g., "three").

    2.  **Matching Questions (Crucial for Nuance):**
        - For matching scenarios (e.g., matching a situation to a phrase or a term to a definition), check if the user's selected match is **conceptually valid** or **commonly used** in that context, even if it differs from the key's designated pairing.
        - If the user's chosen pairing is reasonable and semantically acceptable for both the question's term and the selected definition, mark the pairing as **correct**. The goal is to check knowledge, not arbitrary pairings.

    3.  **Listening & Speaking Questions:**
        - For listening questions, mark as **correct** if the user's transcription is semantically equivalent, even if words are misspelled or minor function words (e.g., articles, prepositions) are missed or swapped.
        - For speaking questions (which only report "completed"), analyze the provided correct sentence and check for any conceptual misunderstanding based on the topic. The overall mark should default to **TRUE** unless the sentence is highly unusual.

    4.  **Output Format:** Return a JSON array of objects, one for each question.

    **CRITICAL:** Your entire response must be ONLY the JSON array. Do not include any other text or explanations.

    **JSON Output Structure:**
    {
      "userAnswer": "The original answer from the user.",
      "isCorrect": true/false // Set to TRUE if the answer passes the flexible grading criteria. Only FALSE for clear, unambiguous conceptual mistakes.
    }

    **Quiz Data to Grade:**
    ${JSON.stringify({ questions, userAnswers }, null, 2)}
  `;

  try {
    const data = await callGeminiProxy(prompt, "gemini-2.5-flash");
    const rawText = data.candidates[0].content.parts[0].text;
    const validatedResults = cleanAndParseJson(rawText);

    if (!Array.isArray(validatedResults) || validatedResults.length !== questions.length) {
      throw new Error("AI returned an invalid format for quiz validation.");
    }

    return validatedResults;
  } catch (error) {
    console.error("Error validating quiz answers:", error);
    // As a fallback, mark answers correct only if they are a strict match
    return questions.map((q, index) => {
        const answer = userAnswers[index];
        let isCorrect = false;
        if (q.type === 'multiple-choice' || q.type === 'fill-in-the-blank' || q.type === 'listening') {
            if (typeof answer === 'string' && typeof q.correctAnswer === 'string') {
                isCorrect = answer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();
            }
        } else if (q.type === 'speaking') {
            isCorrect = !!answer;
        } else if (q.type === 'matching' && Array.isArray(answer)) {
            isCorrect = q.pairs.every((pair, i) => {
                const correctPairId = `term-${i}:def-${i}`;
                return answer[i] === correctPairId;
            });
        }
        return { userAnswer: userAnswers[index], isCorrect };
    });
  }
};

export const transcribeAudio = async (audioBlob: Blob, languageCode: string): Promise<string> => {
  try {
    const reader = new FileReader();
    const base64String = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(audioBlob);
    });

    const response = await fetch(TRANSCRIBE_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        audioBytes: base64String, 
        languageCode,
        mimeType: audioBlob.type // Pass the blob's MIME type
      }),
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

    **CRITICAL INSTRUCTION:** Your primary goal is to encourage the user to practice the language you speak, which is the user's target language (${partner.nativeLanguage}). Do NOT offer to teach or start a lesson in the user's native language (${partner.learningLanguage}).

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

/**
 * Gets a simple definition for a word using Gemini.
 * @param word The word in the target language.
 * @param targetLangName Target language name (e.g., "Spanish").
 * @param userNativeLangName The user's native language (for context).
 * @returns A promise resolving to the definition string.
 */
export const getDefinition = async (
  word: string,
  targetLangName: string,
  userNativeLangName: string // We keep this to pass from the modal, but update the prompt
): Promise<string> => {
  try {
    // --- UPDATED PROMPT ---
    // Be very explicit that the definition MUST be in the target language.
    const prompt = `
      Provide a simple definition for the ${targetLangName} term: "${word}".
      The definition MUST be written entirely in ${targetLangName}.
      Do not use ${userNativeLangName} (English) in the definition.
      Keep it concise (1-2 sentences) and suitable for a language learner.
      Respond ONLY with the definition text.
    `;
    // --- END UPDATED PROMPT ---

    const response = await callGeminiProxy(prompt, "gemini-2.5-flash-lite");
    // Trim potentially leading/trailing whitespace or newlines from AI response
    return response.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error(`Error getting definition for ${word} in ${targetLangName}:`, error);
    return `Definition unavailable for "${word}".`;
  }
};

/**
 * Gets a translation for a word using Gemini.
 * @param word The word in the target language.
 * @param targetLangName Target language name (e.g., "Spanish").
 * @param translationTargetLangName The language name to translate TO (e.g., "English").
 * @param level The selected lesson level (to handle special cases).
 * @returns A promise resolving to the translation string.
 */
export const getTranslation = async (
  word: string,
  targetLangName: string,
  translationTargetLangName: string,
  level: number // <-- ADDED this parameter
): Promise<string> => {
  try {
    // --- NEW PROMPT LOGIC ---
    let prompt = `Translate the following term from ${targetLangName} to ${translationTargetLangName}: "${word}"\n`;

    // Add special instructions for Level 1 learners
    if (level === 1 && targetLangName.toLowerCase() === 'korean') {
      prompt += `
SPECIAL INSTRUCTION: This is for a Level 1 Korean learner. If the term is a single character that is part of the Hangul alphabet (like a single vowel 'ㅜ' or consonant 'ㄱ'), do not translate it as a word. Instead, respond *only* with its common English phonetic pronunciation (e.g., for 'ㅜ', respond 'oo'; for 'ㅏ', respond 'ah').
For all other terms (regular words or phrases), provide the normal ${translationTargetLangName} translation.
`;
    } else {
      // This is the default instruction for other levels
      prompt += `Provide the normal translation.
`;
    }

    // Add the final formatting instruction
    prompt += `Respond ONLY with the single translated word, short phrase, or phonetic pronunciation. Do not add any extra explanation or formatting.`;
    // --- END NEW PROMPT LOGIC ---

    const response = await callGeminiProxy(prompt, "gemini-2.5-flash-lite");
    // Trim potentially leading/trailing whitespace or newlines from AI response
    return response.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error(`Error getting translation for ${word} to ${translationTargetLangName}:`, error);
    return `Translation unavailable for "${word}".`;
  }
};

/**
 * Generates an image for a word using the Imagen 4.0 fast proxy Cloud Function.
 * @param word The word in the target language.
 * @param langName The name of the target language.
 * @returns A promise resolving to the image URL string.
 */
export const callImagenProxy = async (imagePrompt: string): Promise<string> => {
    // Log only the beginning of potentially long prompts
    console.log(`Requesting image generation with prompt: "${imagePrompt.substring(0,100)}..." via proxy.`);
    try {
        const response = await fetch(IMAGEN_PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: imagePrompt }), // Send the provided prompt
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Imagen proxy error (${response.status}):`, errorText);
            throw new Error(`Image generation failed: ${errorText}`);
        }

        const data = await response.json();
        if (!data.imageUrl) {
            console.error("Imagen proxy response missing imageUrl:", data);
            throw new Error('Image generation succeeded but no URL was returned.');
        }
        console.log(`Image URL received: ${data.imageUrl.substring(0, 50)}...`);
        return data.imageUrl;

    } catch (error) {
        console.error("Error calling the Imagen proxy function:", error);
        return `https://via.placeholder.com/300x200.png?text=Error+generating+image`; // Generic error placeholder
    }
};

// --- This is the new function to call our new search proxy ---
const searchForImage = async (query: string): Promise<string> => {
  console.log(`Requesting Image Search for "${query}"...`);
  try {
    const response = await fetch(IMAGE_SEARCH_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Image search proxy error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    if (!data.imageUrl) {
      throw new Error('Image search succeeded but no URL was returned.');
    }
    return data.imageUrl;
  } catch (error) {
    console.error("Error calling the Image Search proxy function:", error);
    return `https://via.placeholder.com/300x200.png?text=Error+searching+${encodeURIComponent(query)}`;
  }
};


// --- This is the NEW exported function that replaces the old one ---
/**
 * Gets an image for a flashcard, deciding whether to
 * use Image Search or Imagen generation based on context.
 * @param word The word (e.g., "ㅜ" or "apple").
 * @param langName The language name (e.g., "Korean").
 * @param level The lesson level.
 * @param topicTitle The title of the lesson.
 * @returns A promise resolving to the image URL string.
 */
export const generateImageForWord = async (
  word: string,
  langName: string,
  level: number,
  topicTitle: string | null
): Promise<string> => {
  const normalizedTopic = topicTitle ? topicTitle.toLowerCase() : "";

  // Still use Image Search for simple characters in Level 1 alphabet lessons
  if (level === 1 && (
      normalizedTopic.includes('alphabet') ||
      normalizedTopic.includes('vowel') ||
      normalizedTopic.includes('consonant') ||
      normalizedTopic.includes('hangul') ||
      normalizedTopic.includes('katakana') ||
      normalizedTopic.includes('hiragana')
    )) {
    console.log(`Using Image Search for character: "${word}"`);
    const query = `${langName} letter ${word} alphabet`;
    return await searchForImage(query);
  } else {
    // --- NEW STEP: Generate a descriptive prompt via Gemini ---
    let descriptiveImagePrompt = `A simple, clear, minimalist drawing or icon representing the concept of "${word}" in ${langName}. White background, no text, no letters, simple icon style.`; // Define a sensible fallback

    try {
      // Prompt for Gemini to generate the Imagen prompt
      const promptGenPrompt = `
        You are an AI assistant helping create image generation prompts for language flashcards.
        Given a word/phrase, its language, and the lesson topic, generate a concise, visually descriptive prompt suitable for an AI image generator (like Imagen 4.0).

        **CRITICAL RULES:**
        1.  Focus ONLY on visual elements. Describe the *concept* or *object* the word represents without literally writing the word.
        2.  Do NOT include the original word "${word}" directly in the prompt if it's likely to cause the AI to render it as text. Instead, describe what it *looks like* or *represents*. (e.g., for "apple", prompt might be "A shiny red apple fruit").
        3.  Explicitly include these style instructions in the prompt: "minimalist style, simple drawing, white background, no text, no letters, icon".
        4.  Keep the prompt clear and relatively short (max 30 words).

        Word/Phrase: "${word}"
        Language: ${langName}
        Lesson Topic: "${topicTitle || 'General Vocabulary'}"

        Generate the image prompt now. Respond ONLY with the prompt text itself. Do not include quotation marks around your response or any conversational filler.`;

      console.log(`Generating descriptive prompt for Imagen for word: "${word}"`);
      const response = await callGeminiProxy(promptGenPrompt, "gemini-2.5-flash-lite"); // Use Flash for speed
      // Ensure candidate and parts exist before accessing text
      const generatedPrompt = response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().replace(/^["']|["']$/g, '');

      if (generatedPrompt) {
        // Combine the generated description with required style elements if not already present
        let finalPrompt = generatedPrompt;
        if (!finalPrompt.includes("minimalist style")) finalPrompt += ", minimalist style";
        if (!finalPrompt.includes("simple drawing")) finalPrompt += ", simple drawing";
        if (!finalPrompt.includes("white background")) finalPrompt += ", white background";
        if (!finalPrompt.includes("no text")) finalPrompt += ", no text";
        if (!finalPrompt.includes("no letters")) finalPrompt += ", no letters";
        if (!finalPrompt.includes("icon")) finalPrompt += ", icon style";

        descriptiveImagePrompt = finalPrompt;
        console.log(`Using generated prompt: "${descriptiveImagePrompt}"`);
      } else {
         console.warn("Gemini returned empty or invalid prompt, using fallback.");
         // Fallback is already set above
      }
    } catch (error) {
      console.error("Error generating descriptive prompt for Imagen, using fallback:", error);
      // Fallback is already set above, just log the error
    }

    // --- Call Imagen with the (potentially improved) prompt ---
    return await callImagenProxy(descriptiveImagePrompt);
  }
};

/**
 * Generates a simple example sentence for a word using Gemini.
 * @param word The word in the target language.
 * @param targetLangName Target language name (e.g., "Spanish").
 * @param userNativeLangName The user's native language (for context).
 * @returns A promise resolving to the sentence string.
 */
export const getSentence = async (
  word: string,
  targetLangName: string,
  userNativeLangName: string
): Promise<string> => {
  try {
    const prompt = `
      Create one simple example sentence using the ${targetLangName} term: "${word}".
      The sentence MUST be written entirely in ${targetLangName}.
      Do not use ${userNativeLangName} in the sentence itself.
      Keep the sentence concise (max 10-12 words) and suitable for a language learner.
      Ensure the sentence clearly demonstrates the meaning or usage of the word "${word}".
      Respond ONLY with the sentence text. Do not add quotation marks or any explanation.
    `;

    const response = await callGeminiProxy(prompt, "gemini-2.5-flash-lite");
    // Trim potentially leading/trailing whitespace or newlines from AI response
    let sentence = response.candidates[0].content.parts[0].text.trim();
    // Remove potential surrounding quotes sometimes added by the AI
    sentence = sentence.replace(/^["']|["']$/g, '');
    return sentence;
  } catch (error) {
    console.error(`Error getting sentence for ${word} in ${targetLangName}:`, error);
    return `Sentence unavailable for "${word}".`;
  }
};

/**
 * Uses Gemini to check if a user's review answer is correct.
 * @param userInput The user's typed answer.
 * @param correctTerm The correct flashcard term.
 * @param languageName The language of the terms (e.g., "Korean").
 * @returns A promise resolving to "correct" or "incorrect".
 */
export const checkFlashcardReview = async (
  userInput: string,
  correctTerm: string,
  languageName: string
): Promise<'correct' | 'incorrect'> => {
  // --- ADDED IMPLEMENTATION ---
  // If it's an exact match, don't waste an API call
  if (userInput.trim().toLowerCase() === correctTerm.trim().toLowerCase()) {
    return 'correct';
  }

  // If it's not an exact match, ask Gemini to validate
  const prompt = `
    Task: Check if a user's answer in a language flashcard review is correct.
    Language: ${languageName}
    Correct Answer: "${correctTerm}"
    User's Answer: "${userInput}"

    Is the User's Answer an acceptable, correct alternative or synonym for the Correct Answer?
    Consider common typos, singular/plural forms, or slightly different but valid translations.
    Respond with only a single word: "correct" or "incorrect".
  `;

  try {
    const response = await callGeminiProxy(prompt, "gemini-2.5-flash-lite");
    const result = response.candidates[0].content.parts[0].text.trim().toLowerCase();

    if (result === 'correct') {
      return 'correct';
    } else {
      return 'incorrect';
    }
  } catch (error) {
    console.error("Error checking flashcard review:", error);
    // Fail safe: if AI check fails, fall back to strict check
    return userInput.trim().toLowerCase() === correctTerm.trim().toLowerCase() ? 'correct' : 'incorrect';
  }
  // --- END ADDED IMPLEMENTATION ---
};