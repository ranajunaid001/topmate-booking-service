import { TopmateBrowser } from '../automation/topmateBrowser';
import { TopmateAPI } from '../api/topmateApi';
import { Page } from 'playwright';

export interface AvailabilityWindow {
  days: string[]; // ["Mon", "Tue", "Wed", "Thu", "Fri"]
  start: string; // "14:00"
  end: string; // "23:00"
  timezone: string; // "America/New_York"
}

export interface BookingOptions {
  target_company: string;
  target_role: string;
  num_calls: number;
  max_price: number;
  availability: AvailabilityWindow[];
}

export interface BookingResult {
  booked: number;
  bookings: Array<{
    expert_username: string;
    expert_name: string;
    expert_title: string;
    session_price: number;
    currency: string;
    service_title: string;
    time_user_tz: string;
    time_utc: string;
    topmate_profile_url: string;
    topmate_booking_url: string | null;
  }>;
  errors?: Array<{
    username: string;
    reason: string;
  }>;
}

export class BookingService {
  private browser: TopmateBrowser;
  private api: TopmateAPI;
  private userDetails: {
    name: string;
    email: string;
    phone?: string;
  };

  constructor() {
    this.browser = new TopmateBrowser({
      headless: process.env.HEADLESS === 'true'
    });
    this.api = new TopmateAPI();
    
    // Get user details from environment
    this.userDetails = {
      name: process.env.USER_NAME || 'Test User',
      email: process.env.USER_EMAIL || 'test@example.com',
      phone: process.env.USER_PHONE
    };
  }

  async bookCallsForUser(options: BookingOptions): Promise<BookingResult> {
    const result: BookingResult = {
      booked: 0,
      bookings: [],
      errors: []
    };

    try {
      // Step 1: Search for candidates
      console.log('🔍 Starting search process...');
      const page = await this.browser.createPage();
      await this.browser.openTopmateSearch(page);
      
      const searchQuery = `${options.target_company} ${options.target_role}`;
      await this.browser.searchExperts(page, searchQuery);
      
      const searchResults = await this.browser.extractSearchResults(page);
      console.log(`Found ${searchResults.length} candidates`);

      // Step 2: Process each candidate
      for (const expert of searchResults) {
        if (result.booked >= options.num_calls) {
          console.log('✅ Reached target number of bookings');
          break;
        }

        console.log(`\n👤 Processing ${expert.name} (@${expert.username})`);
        
        // Fetch profile via API
        const profile = await this.api.fetchUserProfile(expert.username);
        if (!profile) {
          result.errors?.push({
            username: expert.username,
            reason: 'Failed to fetch profile'
          });
          continue;
        }

        // Filter services
        const qualifyingServices = this.api.filterCandidateServices(
          profile,
          options.target_company,
          options.target_role,
          options.max_price
        );

        if (qualifyingServices.length === 0) {
          result.errors?.push({
            username: expert.username,
            reason: 'No qualifying services found'
          });
          continue;
        }

        // Try to book the first qualifying service
        const serviceToBook = qualifyingServices[0];
        console.log(`📅 Attempting to book: ${serviceToBook.serviceTitle}`);

        // Navigate to profile and click on service
        await this.browser.openProfile(page, expert.username);
        
        // Click on the specific service
        const booked = await this.attemptBooking(
          page,
          expert,
          profile,
          serviceToBook,
          options.availability
        );

        if (booked) {
          result.booked++;
          result.bookings.push(booked);
        }
      }

      return result;

    } catch (error) {
      console.error('❌ Error in booking process:', error);
      throw error;
    } finally {
      await this.browser.close();
    }
  }

  private async attemptBooking(
    page: Page,
    expert: any,
    profile: any,
    service: any,
    availability: AvailabilityWindow[]
  ): Promise<any> {
    try {
      // Click on the service card
      await page.click(`#service-${service.serviceId}`);
      
      // Wait for booking page to load
      await page.waitForSelector('.slot-card, .mobile-slots', { 
        timeout: 10000 
      });

      // Extract available slots
      const availableSlots = await this.extractAvailableSlots(page);
      console.log(`Found ${availableSlots.length} available slots`);

      // Find a slot that matches user availability
      const matchingSlot = this.findMatchingSlot(
        availableSlots,
        availability,
        profile.timezone
      );

      if (!matchingSlot) {
        console.log('❌ No matching slots within user availability');
        return null;
      }

      console.log(`✅ Found matching slot: ${matchingSlot.datetime}`);

      // Click on the slot
      await page.click(matchingSlot.selector);

      // Fill booking form
      await this.fillBookingForm(page, service);

      // Submit booking
      await page.click('.sp-cta'); // Book Session button

      // Wait for confirmation
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      return {
        expert_username: expert.username,
        expert_name: profile.full_name,
        expert_title: profile.title,
        session_price: service.charge,
        currency: service.currency,
        service_title: service.serviceTitle,
        time_user_tz: matchingSlot.datetime,
        time_utc: matchingSlot.utc,
        topmate_profile_url: expert.profileUrl,
        topmate_booking_url: page.url()
      };

    } catch (error) {
      console.error(`❌ Failed to book with ${expert.username}:`, error);
      return null;
    }
  }

  private async extractAvailableSlots(page: Page): Promise<Array<{
    selector: string;
    datetime: string;
    utc: string;
  }>> {
    // This is a simplified version - you'll need to adapt based on actual Topmate UI
    return await page.evaluate(() => {
      const slots: Array<any> = [];
      
      // Look for slot elements
      const slotElements = document.querySelectorAll('.slot-time, .time-slot');
      
      slotElements.forEach((element: Element, index: number) => {
        const timeText = element.textContent?.trim();
        if (timeText) {
          slots.push({
            selector: `.slot-time:nth-of-type(${index + 1})`,
            datetime: timeText,
            utc: new Date().toISOString() // Placeholder - need to parse actual time
          });
        }
      });

      return slots;
    });
  }

  private findMatchingSlot(
    availableSlots: any[],
    _userAvailability: AvailabilityWindow[],
    _expertTimezone: string
  ): any {
    // This is simplified - in reality you'd need to:
    // 1. Parse the slot datetime
    // 2. Convert from expert timezone to user timezone
    // 3. Check if it falls within any availability window
    
    // For now, return the first slot as a placeholder
    return availableSlots[0] || null;
  }

  private async fillBookingForm(page: Page, service: any): Promise<void> {
    // Fill in user details
    await page.fill('#name', this.userDetails.name);
    await page.fill('#email', this.userDetails.email);
    
    if (this.userDetails.phone) {
      await page.fill('#phone', this.userDetails.phone);
    }

    // Fill any custom questions
    const questionFields = await page.$$('[id^="questions_"]');
    for (const field of questionFields) {
      await field.fill(`Booking ${service.serviceTitle} via automated system`);
    }
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}
