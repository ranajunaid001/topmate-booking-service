import Fastify from 'fastify';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import { BookingService } from './services/bookingService';
import type { BookingOptions } from './services/bookingService';

dotenv.config();

const fastify = Fastify({
  logger: true
});

// Input validation schema
const BookingRequestSchema = z.object({
  target_company: z.string().min(1),
  target_role: z.string().min(1),
  num_calls: z.number().int().min(1).default(3),
  max_price: z.number().min(0).default(0),
  availability: z.array(z.object({
    days: z.array(z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    timezone: z.string()
  })).min(1)
});

// Health check endpoint
fastify.get('/', async (_request, _reply) => {
  return { 
    status: 'ok', 
    message: 'Topmate Booking Service is running!',
    endpoints: {
      health: 'GET /',
      bookCalls: 'POST /api/book-topmate-calls',
      testBrowser: 'GET /test-browser'
    }
  };
});

// Simple test endpoint to verify Playwright works
fastify.get('/test-browser', async (_request, _reply) => {
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

// Main booking endpoint
fastify.post('/api/book-topmate-calls', async (request, reply) => {
  try {
    // Validate request body
    const validationResult = BookingRequestSchema.safeParse(request.body);
    
    if (!validationResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validationResult.error.issues
      });
    }

    const bookingOptions: BookingOptions = validationResult.data;
    
    // Check for required environment variables
    if (!process.env.USER_NAME || !process.env.USER_EMAIL) {
      return reply.status(500).send({
        error: 'CONFIGURATION_ERROR',
        message: 'Missing required configuration: USER_NAME and USER_EMAIL must be set'
      });
    }

    console.log('📋 Booking request received:', {
      company: bookingOptions.target_company,
      role: bookingOptions.target_role,
      calls: bookingOptions.num_calls,
      maxPrice: bookingOptions.max_price
    });

    // Create booking service and process request
    const bookingService = new BookingService();
    
    try {
      const result = await bookingService.bookCallsForUser(bookingOptions);
      
      // Return results
      return {
        status: 'success',
        booked: result.booked,
        bookings: result.bookings,
        skipped_candidates: result.errors || []
      };
      
    } finally {
      // Ensure browser is closed
      await bookingService.close();
    }

  } catch (error: any) {
    fastify.log.error(error);
    
    return reply.status(500).send({
      error: 'BOOKING_FAILED',
      message: error.message || 'An error occurred while processing bookings'
    });
  }
});

// Error handler
fastify.setErrorHandler((error, _request, reply) => {
  fastify.log.error(error);
  
  reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  });
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`
🚀 Topmate Booking Service Started!
📍 Port: ${port}
🌐 Health Check: http://localhost:${port}/
🔧 Browser Test: http://localhost:${port}/test-browser
📬 Booking API: POST http://localhost:${port}/api/book-topmate-calls

Required Environment Variables:
- USER_NAME: ${process.env.USER_NAME ? '✅' : '❌'}
- USER_EMAIL: ${process.env.USER_EMAIL ? '✅' : '❌'}
- USER_PHONE: ${process.env.USER_PHONE ? '✅ (optional)' : '❌ (optional)'}
- TOPMATE_API_TOKEN: ${process.env.TOPMATE_API_TOKEN ? '✅' : '⚠️  (API enrichment may fail)'}
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
