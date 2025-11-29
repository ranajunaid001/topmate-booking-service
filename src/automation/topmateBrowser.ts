import { Browser, BrowserContext, Page, chromium } from 'playwright';

export interface BrowserConfig {
  headless?: boolean;
  timeout?: number;
}

export class TopmateBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: BrowserConfig;

  constructor(config: BrowserConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      timeout: config.timeout ?? 30000
    };
  }

  async launch(): Promise<void> {
    if (this.browser) {
      return;
    }

    console.log('🚀 Launching browser...');
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ]
    });
    console.log('✅ Browser launched');
  }

  async createPage(): Promise<Page> {
    if (!this.browser) {
      await this.launch();
    }

    if (!this.context) {
      this.context = await this.browser!.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
    }

    const page = await this.context.newPage();
    page.setDefaultTimeout(this.config.timeout!);
    
    return page;
  }

  async openTopmateSearch(page: Page): Promise<void> {
    console.log('📍 Navigating to Topmate search...');
    await page.goto('https://topmate.io/search', {
      waitUntil: 'networkidle',
      timeout: this.config.timeout
    });
    
    // Wait for chat interface to be ready
    await page.waitForSelector('input#message, textarea#message', {
      state: 'visible',
      timeout: 10000
    });
    console.log('✅ Topmate search page loaded');
  }

  async searchExperts(page: Page, query: string): Promise<void> {
    console.log(`🔍 Searching for: ${query}`);
    
    // Find the chat input
    const chatInput = await page.waitForSelector('input#message, textarea#message', {
      state: 'visible'
    });
    
    // Type the search query
    await chatInput!.fill(query);
    
    // Submit the query
    await page.keyboard.press('Enter');
    
    // Wait for response - look for expert cards
    await page.waitForSelector('.HitoProfileCard_ES_Expert_Card__7CmLV', {
      state: 'visible',
      timeout: 20000
    });
    
    console.log('✅ Search results loaded');
  }

  async extractSearchResults(page: Page): Promise<Array<{
    username: string;
    profileUrl: string;
    name: string;
    description: string;
  }>> {
    console.log('📊 Extracting search results...');
    
    // Wait a bit for all results to load
    await page.waitForTimeout(2000);
    
    // Extract expert information
    const experts = await page.evaluate(() => {
      const results: Array<{
        username: string;
        profileUrl: string;
        name: string;
        description: string;
      }> = [];
      
      // Find all expert cards
      const cards = document.querySelectorAll('.HitoProfileCard_ES_Expert_Card__7CmLV');
      
      cards.forEach((card: Element) => {
        // Find the profile link
        const linkElement = card.closest('a') || card.querySelector('a');
        if (!linkElement) return;
        
        const profileUrl = linkElement.href;
        const username = profileUrl.split('/').pop()?.split('?')[0] || '';
        
        // Extract name
        const nameElement = card.querySelector('.HitoProfileCard_ES_Expert_Card_Name__d6i_j');
        const name = nameElement?.textContent?.trim() || '';
        
        // Extract description
        const descElement = card.querySelector('.HitoProfileCard_ES_Expert_Card_Desc__Mk6Ei');
        const description = descElement?.textContent?.trim() || '';
        
        if (username && name) {
          results.push({
            username,
            profileUrl: `https://topmate.io/${username}`,
            name,
            description
          });
        }
      });
      
      return results;
    });
    
    console.log(`✅ Extracted ${experts.length} experts`);
    return experts;
  }

  async openProfile(page: Page, username: string): Promise<void> {
    console.log(`👤 Opening profile: ${username}`);
    await page.goto(`https://topmate.io/${username}`, {
      waitUntil: 'networkidle',
      timeout: this.config.timeout
    });
    
    // Wait for services to load
    await page.waitForSelector('.PublicServiceCard_ServiceCard__srMMU', {
      state: 'visible',
      timeout: 10000
    });
    console.log('✅ Profile loaded');
  }

  async extractServices(page: Page): Promise<Array<{
    serviceId: string;
    title: string;
    description: string;
    price: string;
    type: string;
  }>> {
    console.log('📋 Extracting services...');
    
    const services = await page.evaluate(() => {
      const results: Array<{
        serviceId: string;
        title: string;
        description: string;
        price: string;
        type: string;
      }> = [];
      
      const serviceCards = document.querySelectorAll('.PublicServiceCard_ServiceCard__srMMU');
      
      serviceCards.forEach((card: Element) => {
        // Get service ID
        const serviceId = card.id.replace('service-', '');
        
        // Get title
        const titleElement = card.querySelector('.PublicServiceCard_SCName__LfWN5');
        const title = titleElement?.textContent?.trim() || '';
        
        // Get description
        const descElement = card.querySelector('.PublicServiceCard_SCDescription__UGKJu');
        const description = descElement?.textContent?.trim() || '';
        
        // Get type (Video meeting, Priority DM, etc.)
        const typeElement = card.querySelector('.PublicServiceCard_SCHeaderLeft__0alB9');
        const type = typeElement?.textContent?.trim() || '';
        
        // Get price
        const freeTag = card.querySelector('.PricingDisplayV2_freeTag__dgkIz');
        const regularPrice = card.querySelector('.PricingDisplayV2_regularPrice__A4z_0');
        const discountedPrice = card.querySelector('.PricingDisplayV2_discountedPrice__AreIF');
        
        let price = 'N/A';
        if (freeTag) {
          price = 'FREE';
        } else if (discountedPrice) {
          price = discountedPrice.textContent?.trim() || 'N/A';
        } else if (regularPrice) {
          price = regularPrice.textContent?.trim() || 'N/A';
        }
        
        results.push({
          serviceId,
          title,
          description,
          price,
          type
        });
      });
      
      return results;
    });
    
    console.log(`✅ Extracted ${services.length} services`);
    return services;
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('🔒 Browser closed');
    }
  }
}
