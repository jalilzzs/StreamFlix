import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

function makeError(stage, error) {
  return {
    stage,
    success: false,
    message: error?.message || 'Unknown error',
    code: error?.code || null,
    status: error?.response?.status || null,
    statusText: error?.response?.statusText || null,
    responseData:
      typeof error?.response?.data === 'string'
        ? error.response.data.slice(0, 1000)
        : error?.response?.data || null,
    url: error?.config?.url || null,
    method: error?.config?.method || null
  };
}

app.get('/api/diagnostic', async (req, res) => {
  const url = req.query.url;

  const result = {
    success: false,
    time: new Date().toISOString(),
    scraperApiConfigured: !!SCRAPER_API_KEY,
    stages: []
  };

  if (!url) {
    return res.status(400).json({
      ...result,
      error: 'استعمل /api/diagnostic?url=URL'
    });
  }

  // المرحلة 1: الوصول إلى الرابط
  try {
    result.stages.push({
      stage: 'request',
      status: 'started',
      url
    });

    const response = await axios.get(url, {
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: () => true
    });

    result.stages.push({
      stage: 'request',
      status: 'completed',
      httpStatus: response.status,
      statusText: response.statusText,
      finalUrl: response.request?.res?.responseUrl || url,
      contentType: response.headers?.['content-type'] || null,
      server: response.headers?.server || null
    });

    if (response.status >= 400) {
      return res.status(502).json({
        ...result,
        error: 'الرابط رجع HTTP error',
        failedStage: 'request'
      });
    }

    result.success = true;

    return res.json(result);

  } catch (error) {
    const diagnostic = makeError('request', error);

    return res.status(502).json({
      ...result,
      error: 'فشل الاتصال بالرابط',
      failedStage: 'request',
      diagnostic
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    server: 'online',
    scraperApiConfigured: !!SCRAPER_API_KEY,
    time: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
