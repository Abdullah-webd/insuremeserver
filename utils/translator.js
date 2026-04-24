import { callAIMessage } from "./aiClient.js";

/**
 * Translates text to English using AI.
 * @param {string} text - The text to translate.
 * @param {string} sourceLanguage - The source language (e.g., 'Hausa', 'Igbo', 'Yoruba', 'Pidgin').
 * @returns {Promise<string>} - The translated English text.
 */
export async function translateToEnglish(text, sourceLanguage) {
  if (!text || !sourceLanguage || sourceLanguage.toLowerCase() === "english") {
    return text;
  }

  const systemPrompt = `You are a professional and neutral translator. Translate the following text from ${sourceLanguage} to English. ONLY return the translation. Do NOT add any extra information, greetings, or conversational filler. Preserve the core meaning exactly.`;
  
  try {
    const result = await callAIMessage({ systemPrompt, userMessage: text });
    return result.trim();
  } catch (error) {
    console.error("Translation to English failed:", error);
    return text; // Fallback to original text if translation fails
  }
}

/**
 * Translates English text to a target language using AI.
 * @param {string} text - The English text to translate.
 * @param {string} targetLanguage - The target language (e.g., 'Hausa', 'Igbo', 'Yoruba', 'Pidgin').
 * @returns {Promise<string>} - The translated text in the target language.
 */
export async function translateFromEnglish(text, targetLanguage) {
  if (!text || !targetLanguage || targetLanguage.toLowerCase() === "english") {
    return text;
  }

  const systemPrompt = `You are a professional and neutral translator. Translate the following English text to ${targetLanguage}. ONLY return the translation. Do NOT add any extra information, greetings, professional advice, or help beyond what is in the original text. Be extremely concise and strictly follow the source text.`;

  try {
    const result = await callAIMessage({ systemPrompt, userMessage: text });
    return result.trim();
  } catch (error) {
    console.error(`Translation to ${targetLanguage} failed:`, error);
    return text; // Fallback to original text if translation fails
  }
}
