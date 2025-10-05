
import { Language } from './types';

export const LANGUAGES: Language[] = [
  { "code": "en-US", "name": "English" },
  { "code": "es-ES", "name": "Spanish" },
  { "code": "fr-FR", "name": "French" },
  { "code": "de-DE", "name": "German" },
  { "code": "it-IT", "name": "Italian" },
  { "code": "pt-BR", "name": "Portuguese" },
  { "code": "ja-JP", "name": "Japanese" },
  { "code": "ko-KR", "name": "Korean" },
  { "code": "cmn-CN", "name": "Chinese" },
  { "code": "ru-RU", "name": "Russian" },
  { "code": "ar-XA", "name": "Arabic" },
  { "code": "hi-IN", "name": "Hindi" },
  { "code": "vi-VN", "name": "Vietnamese" },
  { "code": "mn-MN", "name": "Mongolian" },
  { "code": "pl-PL", "name": "Polish" }
];

export const VOICE_MAP: Record<string, any> = {
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
};
