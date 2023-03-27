import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import FormData from 'form-data';

// Replace these with your actual OpenAI and Google Translate API keys
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY';
const GOOGLE_TRANSLATE_API_KEY = 'YOUR_GOOGLE_TRANSLATE_API_KEY';

async function transcribeAudio(audio: Blob): Promise<string> {
  // Make an API call to OpenAI's Whisper API to transcribe the audio
  const form = new FormData();
  form.append('audio', audio);
  const response = await axios.post('https://api.openai.com/v1/whisper/recognize', form, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${form.getBoundary()}`,
    },
  });
  return response.data.text;
}

async function translateText(text: string, targetLanguage: string): Promise<string> {
  // Make an API call to Google Translate API to translate the text to the target language
  const response = await axios.post(`https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`, {
    q: text,
    target: targetLanguage,
  });
  return response.data.data.translations[0].translatedText;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { audio, targetLanguage } = req.body;

  // Transcribe the audio using OpenAI's Whisper API
  const text = await transcribeAudio(audio);

  // Translate the transcribed text to the target language using Google Translate API
  const translation = await translateText(text, targetLanguage);

  res.status(200).json({ translation });
}
