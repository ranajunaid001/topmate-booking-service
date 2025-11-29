import { TopmateBrowser } from '../automation/topmateBrowser';
import { TopmateAPI } from '../api/topmateApi';
import * as dotenv from 'dotenv';

dotenv.config();

interface EnrichedExpert {
  username: string;
  name: string;
  profileUrl: string;
  description: string;
  matchesTarget: boolean;
  qualifyingServices: Array<{
    serviceId: number;
    serviceTitle: string;
    charge: number;
    currency: string;
    type: number;
  }>;
}

async function testSearchAndEnrichment() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const targetCompany = args[0] || 'Netflix';
  const targetRole = args[1] || 'Product Manager';
  const maxPrice = parseInt(args[2] || '0', 10);

  console.log('\n🎯 Search Parameters:');
  console.log(`   Company: ${targetCompany}`);
  console.log(`   Role: ${targetRole}`);
  console.log(`   Max Price: ${maxPrice === 0 ? 'FREE only' : `$${maxPrice}`}`);
  console.log('');

  const browser = new TopmateBrowser({
    headless: process.env.HEADLESS === 'true'
  });
  
  const api = new TopmateAPI();

  try {
    // Step 1: Search for experts
    const page = await browser.createPage();
    await browser.openTopmateSearch(page);
    
    const searchQuery = `${targetCompany} ${targetRole}`;
    await browser.searchExperts(page, searchQuery);
    
    const searchResults = await browser.extractSearchResults(page);
    console.log(`\n📊 Found ${searchResults.length} experts in search results\n`);

    // Step 2: Enrich each expert with API data
    const enrichedExperts: EnrichedExpert[] = [];

    for (const expert of searchResults.slice(0, 5)) { // Limit to first 5 for testing
      console.log(`\n🔍 Enriching: ${expert.name} (@${expert.username})`);
      
      const profile = await api.fetchUserProfile(expert.username);
      
      if (!profile) {
        console.log('   ❌ Failed to fetch profile via API');
        continue;
      }

      const qualifyingServices = api.filterCandidateServices(
        profile,
        targetCompany,
        targetRole,
        maxPrice
      );

      const enrichedExpert: EnrichedExpert = {
        ...expert,
        matchesTarget: qualifyingServices.length > 0,
        qualifyingServices
      };

      enrichedExperts.push(enrichedExpert);

      if (qualifyingServices.length > 0) {
        console.log(`   ✅ Matches criteria! Found ${qualifyingServices.length} qualifying services:`);
        qualifyingServices.forEach(service => {
          console.log(`      - ${service.serviceTitle} (${service.currency}${service.charge})`);
        });
      } else {
        console.log('   ❌ No matching services or doesn\'t match criteria');
      }
    }

    // Step 3: Summary
    console.log('\n\n📈 SUMMARY');
    console.log('===========');
    console.log(`Total experts searched: ${searchResults.length}`);
    console.log(`Experts analyzed: ${enrichedExperts.length}`);
    console.log(`Qualifying experts: ${enrichedExperts.filter(e => e.matchesTarget).length}`);

    const qualifyingExperts = enrichedExperts.filter(e => e.matchesTarget);
    if (qualifyingExperts.length > 0) {
      console.log('\n✅ Qualified Experts:');
      qualifyingExperts.forEach((expert, index) => {
        console.log(`\n${index + 1}. ${expert.name} (@${expert.username})`);
        console.log(`   Profile: ${expert.profileUrl}`);
        console.log(`   Services:`);
        expert.qualifyingServices.forEach(service => {
          console.log(`   - ${service.serviceTitle} (${service.type}, ${service.currency}${service.charge})`);
        });
      });
    }

  } catch (error) {
    console.error('\n❌ Error during test:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Usage information
console.log('🚀 Topmate Search & Enrichment Test');
console.log('====================================');
console.log('Usage: npm run debug:search [company] [role] [maxPrice]');
console.log('Example: npm run debug:search Netflix "Product Manager" 0');
console.log('');

// Run the test
testSearchAndEnrichment().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
