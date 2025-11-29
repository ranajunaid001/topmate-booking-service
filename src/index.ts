import Fastify from 'fastify';
import * as dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({
  logger: true
});

// Health check endpoint
fastify.get('/', async (request, reply) => {
  return { 
    status: 'ok', 
    message: 'Topmate Booking Service is running!',
    endpoints: {
      health: 'GET /',
      bookCalls: 'POST /api/book-topmate-calls (not implemented yet)'
    }
  };
});

// Simple test endpoint to verify Playwright works
fastify.get('/test-browser', async (request, reply) => {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto('https://topmate.io/search');
    const title = await page.title();
    await browser.close();
    
    return { 
      status: 'success', 
      message: 'Browser test successful',
      pageTitle: title 
    };
  } catch (error: any) {
    return { 
      status: 'error', 
      message: error.message 
    };
  }
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
