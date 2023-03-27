import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import FormData from 'form-data';
import formidable from 'formidable';
import fs, { createReadStream } from 'fs'
import { Configuration, OpenAIApi } from 'openai'

// Replace these with your actual OpenAI and Google Translate API keys
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

async function transcribeAudio(audiopath: string) {
  const audio = createReadStream(audiopath);
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const buffers: Buffer[] = [];
    audio.on('error', reject);
    audio.on('data', (d: Buffer) => buffers.push(d));
    audio.on('end', () => resolve(Buffer.concat(buffers)));
  });
  const base64 = buffer.toString('base64');

  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `Transcribe this audio: ${base64}`,
    temperature: 0,
    max_tokens: 1024,
  });
  const r = response.data.choices
  if (r[0].text) {
    return r[0].text.trim();
  }
  return ""
}

async function translateText(text: string, targetLanguage: string): Promise<string> {
  // Make an API call to Google Translate API to translate the text to the target language
  const response = await axios.post(`https://translation.googleapis.com/language/translate/v2?key=s`, {
    q: text,
    target: targetLanguage,
  });
  return response.data.data.translations[0].translatedText;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.status(500).json({ message: 'Internal Server Error' });
      return;
    }
    try {
      const { targetLanguage } = fields;
      // Transcribe the audio using OpenAI's Whisper API
      const audio = files[Object.keys(files)[0]] as formidable.File;
      const text = await transcribeAudio(audio.filepath);
      console.log(text)
      // Translate the transcribed text to the target language using Google Translate API
      const translation = await translateText(text, targetLanguage as string);
      res.status(200).json({ translation });

    } catch (error) {
      console.log(error)
      res.status(500).json({ message: "something went wrong" })
    }

  });
}
