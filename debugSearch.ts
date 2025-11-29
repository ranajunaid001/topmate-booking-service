import { TopmateBrowser } from '../automation/topmateBrowser';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function debugSearch() {
  const browser = new TopmateBrowser({
    headless: process.env.HEADLESS === 'true',
    timeout: 30000
  });

  try {
    // Create a new page
    const page = await browser.createPage();
    
    // Open Topmate search
    await browser.openTopmateSearch(page);
    
    // Search for experts
    const searchQuery = process.argv[2] || 'product manager at Netflix';
    await browser.searchExperts(page, searchQuery);
    
    // Extract search results
    const experts = await browser.extractSearchResults(page);
    
    console.log('\n📋 Search Results:');
    console.log('==================');
    experts.forEach((expert, index) => {
      console.log(`\n${index + 1}. ${expert.name}`);
      console.log(`   Username: ${expert.username}`);
      console.log(`   Profile: ${expert.profileUrl}`);
      console.log(`   Description: ${expert.description}`);
    });
    
    // If we found experts, let's check the first one's services
    if (experts.length > 0) {
      console.log('\n🔍 Checking services for first expert...');
      await browser.openProfile(page, experts[0].username);
      
      const services = await browser.extractServices(page);
      console.log(`\n📋 Services for ${experts[0].name}:`);
      console.log('============================');
      services.forEach((service, index) => {
        console.log(`\n${index + 1}. ${service.title}`);
        console.log(`   Type: ${service.type}`);
        console.log(`   Price: ${service.price}`);
        console.log(`   ID: ${service.serviceId}`);
        if (service.description) {
          console.log(`   Description: ${service.description}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error during search test:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the debug script
console.log('🚀 Starting Topmate search test...');
console.log('Usage: npm run debug:search "your search query"');
console.log('Example: npm run debug:search "product manager at Box"');
console.log('');

debugSearch().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
