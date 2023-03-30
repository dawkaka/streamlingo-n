import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import FormData from 'form-data';
import formidable from 'formidable';
import fs, { createReadStream, readFileSync } from 'fs'
import { Configuration, OpenAIApi } from 'openai'

// Replace these with your actual OpenAI and Google Translate API keys
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});

const openai = new OpenAIApi(configuration);

async function transcribeAudio(audiopath: string, name: string) {
  const audio = readFileSync(audiopath);

  const url = 'https://api.openai.com/v1/audio/transcriptions';
  const headers = {
    'Content-Type': 'multipart/form-data',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  };
  const formData = new FormData();
  formData.append('model', 'whisper-1');
  formData.append('file', audio, { filename: name });
  formData.append('format', 'text');
  formData.append('speaker_count', '0');

  const response = await axios.post(url, formData, { headers });
  return response.data.text;
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
  if (req.method === "POST") {
    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
      if (err) {
        res.status(500).json({ message: 'Something went wrong' });
        return;
      }
      try {
        const { targetLanguage } = fields;
        const { audio } = files

        if (Array.isArray(audio)) {
          res.status(500).json({ message: 'Something went wrong' });
          return;
        }
        const text = await transcribeAudio(audio.filepath, audio.originalFilename || "audio.mp3")

        const prompt = `Please translate the following text: ${text}
To: ${targetLanguage}
If the input text and target language are the same, provide the definitions of at most 2 uncommon words in the text in the following format: "word: definition of the word".
Additionally, if the input text contains any idiomatic expressions, please explain the meaning of those expressions.`

        const response = await openai.createCompletion({
          model: "text-davinci-003",
          prompt: prompt,
          temperature: 0,
          max_tokens: 1024,
        });
        const recommendations = response.data.choices
        if (recommendations[0].text) {
          res.status(200).json({
            translation: `${text} 

          ${recommendations[0].text}`
          });
        }
        res.status(200).json({ translation: "" });

      } catch (error: any) {
        res.status(500).json({ message: "something went wrong" })
      }

    });
  } else {
    res.status(404).send("Method not allowed")
  }

}