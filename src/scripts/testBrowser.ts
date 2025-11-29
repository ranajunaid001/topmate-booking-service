import { chromium, Browser } from 'playwright';

async function testBrowser() {
  let browser: Browser | null = null;
  
  try {
    console.log('🚀 Starting browser test...');
    
    // Launch browser
    browser = await chromium.launch({
      headless: false, // Set to true for production
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    console.log('✅ Browser launched successfully');
    
    // Create new page
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    
    console.log('📍 Navigating to Topmate search page...');
    
    // Navigate to Topmate search
    await page.goto('https://topmate.io/search', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('✅ Successfully loaded Topmate search page');
    
    // Wait for chat interface to be ready
    const chatInputSelector = 'input#message, textarea#message';
    await page.waitForSelector(chatInputSelector, {
      state: 'visible',
      timeout: 10000
    });
    
    console.log('✅ Chat interface is ready');
    
    // Take a screenshot for verification
    await page.screenshot({ 
      path: 'topmate-search-test.png',
      fullPage: true 
    });
    
    console.log('📸 Screenshot saved as topmate-search-test.png');
    
    // Wait a bit to see the page
    await page.waitForTimeout(3000);
    
    console.log('✨ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during browser test:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

// Run the test
testBrowser().catch(console.error);
