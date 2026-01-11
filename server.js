// start using node server.js
// stop using ctrl c
import express from 'express';
import Lens from 'chrome-lens-ocr';
import cors from 'cors';

const app = express();
const lens = new Lens();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/ocr', async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Remove data:image/png;base64, prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const result = await lens.scanByBuffer(buffer);
    
    // Extract all text
    const fullText = result.segments.map(s => s.text).join('\n');
    
    res.json({
      success: true,
      text: fullText,
      segments: result.segments,
      language: result.language
    });
  } catch (error) {
    console.error('OCR Error:', error);
    res.status(500).json({ 
      error: 'OCR failed', 
      message: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OCR server running on port ${PORT}`);
});
app.get('/statmuse', async (req, res) => {
  try {
    const question = req.query.q;
    
    if (!question) {
      return res.status(400).json({ error: 'Missing question parameter' });
    }

    console.log('StatMuse query:', question);

    const url = `https://www.statmuse.com/ask?q=${encodeURIComponent(question)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });

    if (!response.ok) {
      console.error('StatMuse error:', response.status);
      return res.status(422).json({ 
        error: 'StatMuse request failed',
        status: response.status 
      });
    }

    const html = await response.text();
    let answer = '';
    
    // Method 1: Extract from h1 tag
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
    if (h1Match) {
      let content = h1Match[1];
      content = content.replace(/<[^>]*>/g, ''); // Remove HTML tags
      
      if (content.includes('>')) {
        content = content.split('>').pop();
      }
      
      // Decode HTML entities
      answer = content
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .trim();
    }
    
    // Method 2: Fallback to meta description
    if (!answer) {
      const metaMatch = html.match(/<meta property="og:description" content="([^"]*)"/);
      if (metaMatch) {
        answer = metaMatch[1];
      }
    }

    console.log('Extracted answer:', answer);

    res.json({ 
      answer: answer || null,
      question: question
    });

  } catch (error) {
    console.error('StatMuse error:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});
