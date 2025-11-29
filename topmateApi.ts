import * as dotenv from 'dotenv';

dotenv.config();

export interface TopmateUserProfile {
  id: number;
  username: string;
  name: string;
  headline: string;
  bio: string;
  services: Array<{
    id: number;
    title: string;
    charge: number;
    currency: string;
    type: string;
    duration?: number;
  }>;
}

export interface TopmateServiceDetails {
  id: number;
  title: string;
  description: string;
  charge: number;
  currency: string;
  duration: number;
  type: string;
}

export class TopmateAPI {
  private apiToken: string;
  private baseUrl = 'https://galactus.run';

  constructor(apiToken?: string) {
    this.apiToken = apiToken || process.env.TOPMATE_API_TOKEN || '';
    if (!this.apiToken) {
      console.warn('⚠️  No Topmate API token provided. API calls may fail.');
    }
  }

  async fetchUserProfile(username: string): Promise<TopmateUserProfile | null> {
    try {
      console.log(`🔍 Fetching profile for: ${username}`);
      
      const response = await fetch(`${this.baseUrl}/fetchByUsername/?username=${username}`, {
        headers: {
          'Authorization': this.apiToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`❌ Failed to fetch profile: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      console.log(`✅ Profile fetched for: ${username}`);
      return data;
    } catch (error) {
      console.error(`❌ Error fetching profile for ${username}:`, error);
      return null;
    }
  }

  async fetchServiceDetails(serviceId: number): Promise<TopmateServiceDetails | null> {
    try {
      console.log(`🔍 Fetching service details for ID: ${serviceId}`);
      
      const response = await fetch(`${this.baseUrl}/service-public/${serviceId}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`❌ Failed to fetch service: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      console.log(`✅ Service details fetched for ID: ${serviceId}`);
      return data;
    } catch (error) {
      console.error(`❌ Error fetching service ${serviceId}:`, error);
      return null;
    }
  }

  filterCandidateServices(
    userProfile: TopmateUserProfile,
    targetCompany: string,
    targetRole: string,
    maxPrice: number
  ): Array<{
    serviceId: number;
    serviceTitle: string;
    charge: number;
    currency: string;
    type: string;
    duration?: number;
  }> {
    // Check if user's profile matches target criteria
    const profileText = `${userProfile.name} ${userProfile.headline} ${userProfile.bio}`.toLowerCase();
    const companyMatch = profileText.includes(targetCompany.toLowerCase());
    
    // Check for role match (handle variations like "Product Manager", "PM", etc.)
    const roleVariations = this.getRoleVariations(targetRole);
    const roleMatch = roleVariations.some(variation => 
      profileText.includes(variation.toLowerCase())
    );

    if (!companyMatch || !roleMatch) {
      console.log(`❌ Profile doesn't match criteria (Company: ${companyMatch}, Role: ${roleMatch})`);
      return [];
    }

    // Filter services by price and type
    const candidateServices = userProfile.services.filter(service => {
      // Check price
      if (service.charge > maxPrice) {
        return false;
      }

      // Check if it's a call/meeting type (not document-only)
      const isCallType = service.type.toLowerCase().includes('meeting') ||
                        service.type.toLowerCase().includes('call') ||
                        service.type.toLowerCase().includes('video') ||
                        service.type.toLowerCase().includes('chat');

      return isCallType;
    });

    console.log(`✅ Found ${candidateServices.length} matching services`);

    return candidateServices.map(service => ({
      serviceId: service.id,
      serviceTitle: service.title,
      charge: service.charge,
      currency: service.currency,
      type: service.type,
      duration: service.duration
    }));
  }

  private getRoleVariations(role: string): string[] {
    const roleMap: { [key: string]: string[] } = {
      'product manager': ['product manager', 'pm', 'product lead', 'product owner'],
      'software engineer': ['software engineer', 'swe', 'developer', 'programmer', 'engineer'],
      'designer': ['designer', 'ux designer', 'ui designer', 'product designer'],
      'data scientist': ['data scientist', 'data analyst', 'ml engineer', 'data engineer'],
      'marketing': ['marketing', 'marketer', 'growth', 'marketing manager']
    };

    const normalizedRole = role.toLowerCase();
    
    // Check if we have predefined variations
    for (const [key, variations] of Object.entries(roleMap)) {
      if (normalizedRole.includes(key) || variations.some(v => normalizedRole.includes(v))) {
        return variations;
      }
    }

    // Default: return the role itself
    return [role];
  }
}
