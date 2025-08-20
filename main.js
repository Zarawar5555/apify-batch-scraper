const Apify = require('apify');

// Domain-specific scraping function
async function scrapeProfessionalData(page, url) {
    const domain = new URL(url).hostname.toLowerCase();
    
    // Domain-specific scraping logic
    if (domain.includes('linkedin.com')) {
        return await page.evaluate(() => {
            const data = {
                first_name: document.querySelector('.text-heading-xlarge, h1')?.innerText?.split(' ')[0] || '',
                last_name: document.querySelector('.text-heading-xlarge, h1')?.innerText?.split(' ').slice(1).join(' ') || '',
                full_name: document.querySelector('.text-heading-xlarge, h1')?.innerText || '',
                job_title: document.querySelector('.text-body-medium.break-words, .pv-text-details__left-panel h2')?.innerText || '',
                headline: document.querySelector('.text-body-medium.break-words, .pv-text-details__left-panel h2')?.innerText || '',
                company_name: document.querySelector('a[data-field="experience_company_name"], .pv-entity__company-summary-info h3')?.innerText || '',
                linkedin_profile: window.location.href,
                photo_url: document.querySelector('.pv-top-card-profile-picture__image, .profile-photo-edit__preview')?.src || '',
                industry: document.querySelector('.text-body-small.t-black--light.mt2')?.innerText || '',
            };
            
            // Location parsing
            const locationText = document.querySelector('.text-body-small.inline.t-black--light.break-words, .pv-text-details__left-panel .t-black--light.t-normal')?.innerText || '';
            if (locationText) {
                const locationParts = locationText.split(',').map(part => part.trim());
                data.city = locationParts[0] || '';
                data.state = locationParts[1] || '';
                data.country = locationParts[2] || locationParts[1] || '';
            }
            
            return data;
        });
    }
    
    // Generic scraping for all other domains
    return await page.evaluate(() => {
        // Helper functions
        const getText = (selector) => {
            const element = document.querySelector(selector);
            return element ? element.innerText.trim() : '';
        };
        
        const getAttr = (selector, attr) => {
            const element = document.querySelector(selector);
            return element ? element.getAttribute(attr) : '';
        };
        
        const getMultipleText = (selector) => {
            return Array.from(document.querySelectorAll(selector)).map(el => el.innerText.trim());
        };
        
        // Try to extract from schema.org structured data
        let structuredData = {};
        try {
            const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
            jsonLdScripts.forEach(script => {
                try {
                    const data = JSON.parse(script.textContent);
                    if (data && (data['@type'] === 'Person' || data['@type'] === 'Organization')) {
                        structuredData = { ...structuredData, ...data };
                    }
                } catch (e) {}
            });
        } catch (e) {}
        
        // Extract all professional data fields
        const result = {
            // Personal Information
            first_name: structuredData.givenName || 
                       getText('*[itemprop="givenName"], .first-name, [class*="first"], .given-name, .fname') || 
                       getText('h1, .name')?.split(' ')[0] || '',
            
            last_name: structuredData.familyName ||
                      getText('*[itemprop="familyName"], .last-name, [class*="last"], .family-name, .lname') || 
                      getText('h1, .name')?.split(' ').slice(1).join(' ') || '',
            
            full_name: structuredData.name ||
                      getText('*[itemprop="name"], h1, .full-name, .name, .person-name, .contact-name') || 
                      document.title.split(' - ')[0] || '',
            
            email: structuredData.email ||
                  getText('*[href^="mailto:"], .email, [class*="email"], *[itemprop="email"]')?.replace('mailto:', '') || 
                  getAttr('*[href^="mailto:"]', 'href')?.replace('mailto:', '') || '',
            
            mobile_number: structuredData.telephone ||
                          getText('*[itemprop="telephone"], .phone, .mobile, [class*="phone"], [href^="tel:"]')?.replace('tel:', '') || 
                          getAttr('[href^="tel:"]', 'href')?.replace('tel:', '') || '',
            
            linkedin_profile: getAttr('*[href*="linkedin.com/in"], .linkedin, a[title*="LinkedIn"]', 'href') || '',
            
            photo_url: structuredData.image ||
                      getAttr('*[itemprop="image"], .profile-photo, .avatar, [class*="photo"], img[alt*="profile"], img[alt*="photo"]', 'src') || '',
            
            person_id: getAttr('[data-person-id], [data-id], [id*="person"], [data-contact-id]', 'data-person-id') || 
                      getAttr('[data-person-id], [data-id], [id*="person"], [data-contact-id]', 'data-id') || 
                      getAttr('[data-person-id], [data-id], [id*="person"], [data-contact-id]', 'data-contact-id') || '',
            
            // Job Information
            job_title: structuredData.jobTitle ||
                      getText('*[itemprop="jobTitle"], .job-title, .title, .position, [class*="title"], .role, .designation') || 
                      getText('h2')?.split(' at ')[0] || '',
            
            headline: getText('.headline, .tagline, .description, [class*="headline"], .bio, .summary') || 
                     getAttr('meta[name="description"]', 'content') || '',
            
            seniority: getText('.seniority, .level, [class*="senior"], [class*="level"], .rank') || '',
            
            industry: getText('.industry, [class*="industry"], .sector, .vertical') || 
                     getAttr('meta[name="industry"]', 'content') || '',
            
            // Department information
            'department/0': getMultipleText('.department, [class*="dept"], .team, .division, .group')[0] || '',
            'department/1': getMultipleText('.department, [class*="dept"], .team, .division, .group')[1] || '',
            
            // Company Information
            company_name: structuredData.worksFor?.name || structuredData.employer?.name ||
                         getText('.company-name, .company, [class*="company"], .organization, .employer') || 
                         getText('h2')?.split(' at ')[1] || '',
            
            company_id: getAttr('[data-company-id], [data-org-id], [data-organization-id]', 'data-company-id') || 
                       getAttr('[data-company-id], [data-org-id], [data-organization-id]', 'data-org-id') || 
                       getAttr('[data-company-id], [data-org-id], [data-organization-id]', 'data-organization-id') || '',
            
            company_website: getAttr('*[href*="http"]:not([href*="linkedin"]):not([href*="twitter"]):not([href*="facebook"]):not([href*="instagram"]), .website, .company-website', 'href') || '',
            
            company_linkedin: getAttr('*[href*="linkedin.com/company"], .company-linkedin, a[title*="Company LinkedIn"]', 'href') || '',
            
            company_size: getText('.company-size, [class*="size"], .employees, .employee-count') || '',
            
            company_phone_number: getText('.company-phone, [class*="company-phone"], .office-phone') || '',
            
            // Location Information
            city: structuredData.address?.addressLocality ||
                 getText('*[itemprop="addressLocality"], .city, .locality, [class*="city"]') || 
                 getText('.location, .address')?.split(',')[0]?.trim() || '',
            
            state: structuredData.address?.addressRegion ||
                  getText('*[itemprop="addressRegion"], .state, .region, [class*="state"]') || 
                  getText('.location, .address')?.split(',')[1]?.trim() || '',
            
            country: structuredData.address?.addressCountry ||
                    getText('*[itemprop="addressCountry"], .country, [class*="country"]') || 
                    getText('.location, .address')?.split(',').pop()?.trim() || '',
            
            company_city: getText('.company-city, [class*="company-location"], .office-city')?.split(',')[0]?.trim() || '',
            
            company_state: getText('.company-state, [class*="company-location"], .office-state')?.split(',')[1]?.trim() || '',
            
            company_country: getText('.company-country, [class*="company-location"], .office-country')?.split(',').pop()?.trim() || '',
            
            // Metadata
            url: window.location.href,
            scraped_at: new Date().toISOString(),
        };
        
        // Clean up empty values
        Object.keys(result).forEach(key => {
            if (result[key] === '' || result[key] === null || result[key] === undefined) {
                result[key] = '';
            }
        });
        
        return result;
    });
}

Apify.main(async () => {
    // Get input data
    const input = await Apify.getInput();
    
    // Your complete URL list - REPLACE WITH YOUR ACTUAL URLS
    const allUrls = [
        'https://domain1.com/page1',
        'https://domain1.com/page2',
        'https://domain2.com/category1',
        'https://domain2.com/category2',
        'https://domain3.com/products',
        'https://example1.com',
        'https://example2.com',
        'https://example3.com',
        'https://example4.com',
        'https://example5.com',
        // Add all your 1000+ URLs here
        // 'https://your-domain.com/path',
    ];
    
    // Get current batch info from input or default to first batch
    const currentBatch = input.currentBatch || 0;
    const urlsPerBatch = input.urlsPerBatch || 5; // Process 5 URLs per run
    
    // Calculate start and end indices
    const startIndex = currentBatch * urlsPerBatch;
    const endIndex = Math.min(startIndex + urlsPerBatch, allUrls.length);
    
    // Get URLs for this batch
    const currentUrls = allUrls.slice(startIndex, endIndex);
    
    console.log(`Processing batch ${currentBatch + 1}`);
    console.log(`URLs ${startIndex + 1}-${endIndex} of ${allUrls.length}`);
    console.log(`URLs in this batch:`, currentUrls);
    
    // Process current batch
    for (const url of currentUrls) {
        try {
            console.log(`Processing: ${url}`);
            
            const browser = await Apify.launchPuppeteer({
                useApifyProxy: false,
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                ]
            });
            
            const page = await browser.newPage();
            
            // Set user agent to avoid blocking
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            // Navigate to page
            await page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Wait a bit for dynamic content
            await page.waitForTimeout(3000);
            
            // Use domain-specific scraping logic
            const data = await scrapeProfessionalData(page, url);
            
            await browser.close();
            
            // Save data with batch info
            await Apify.pushData({
                ...data,
                batch: currentBatch + 1,
                processedAt: new Date().toISOString()
            });
            
            console.log(`✓ Processed: ${url} - Found: ${data.full_name || 'No name'} at ${data.company_name || 'No company'}`);
            
        } catch (error) {
            console.error(`✗ Error processing ${url}:`, error.message);
            await Apify.pushData({
                url,
                error: error.message,
                batch: currentBatch + 1,
                processedAt: new Date().toISOString(),
                // Initialize empty fields for failed scrapes
                city: '', company_city: '', company_country: '', company_id: '', 
                company_linkedin: '', company_name: '', company_phone_number: '', 
                company_size: '', company_state: '', company_website: '', country: '', 
                'department/0': '', 'department/1': '', email: '', first_name: '', 
                full_name: '', headline: '', industry: '', job_title: '', last_name: '', 
                linkedin_profile: '', mobile_number: '', person_id: '', photo_url: '', 
                seniority: '', state: ''
            });
        }
        
        // Small delay between URLs to be nice to servers
        await Apify.utils.sleep(3000);
    }
    
    // Schedule next batch if there are more URLs
    if (endIndex < allUrls.length) {
        console.log(`Scheduling next batch: ${currentBatch + 2}`);
        
        // Save progress info
        await Apify.setValue('nextBatch', {
            currentBatch: currentBatch + 1,
            totalBatches: Math.ceil(allUrls.length / urlsPerBatch),
            progress: `${endIndex}/${allUrls.length}`,
            progressPercent: Math.round((endIndex / allUrls.length) * 100),
            nextRunAt: new Date(Date.now() + 60000).toISOString(), // 1 minute later
            remainingUrls: allUrls.length - endIndex
        });
        
        console.log(`Progress: ${endIndex}/${allUrls.length}const Apify = require('apify');

Apify.main(async () => {
    // Get input data
    const input = await Apify.getInput();
    
    // Your complete URL list - REPLACE WITH YOUR ACTUAL URLS
    const allUrls = [
        'https://domain1.com/page1',
        'https://domain1.com/page2',
        'https://domain2.com/category1',
        'https://domain2.com/category2',
        'https://domain3.com/products',
        'https://example1.com',
        'https://example2.com',
        'https://example3.com',
        'https://example4.com',
        'https://example5.com',
        // Add all your 1000+ URLs here
        // 'https://your-domain.com/path',
    ];
    
    // Get current batch info from input or default to first batch
    const currentBatch = input.currentBatch || 0;
    const urlsPerBatch = input.urlsPerBatch || 5; // Process 5 URLs per run
    
    // Calculate start and end indices
    const startIndex = currentBatch * urlsPerBatch;
    const endIndex = Math.min(startIndex + urlsPerBatch, allUrls.length);
    
    // Get URLs for this batch
    const currentUrls = allUrls.slice(startIndex, endIndex);
    
    console.log(`Processing batch ${currentBatch + 1}`);
    console.log(`URLs ${startIndex + 1}-${endIndex} of ${allUrls.length}`);
    console.log(`URLs in this batch:`, currentUrls);
    
    // Process current batch
    for (const url of currentUrls) {
        try {
            console.log(`Processing: ${url}`);
            
            const browser = await Apify.launchPuppeteer({
                useApifyProxy: false,
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                ]
            });
            
            const page = await browser.newPage();
            
            // Set user agent to avoid blocking
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            // Navigate to page
            await page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Wait a bit for dynamic content
            await page.waitForTimeout(2000);
            
            // COMPREHENSIVE SCRAPING LOGIC FOR PROFESSIONAL/BUSINESS DATA
            const data = await page.evaluate(() => {
                // Helper function to safely extract text
                const getText = (selector) => {
                    const element = document.querySelector(selector);
                    return element ? element.innerText.trim() : '';
                };
                
                // Helper function to extract attribute
                const getAttr = (selector, attr) => {
                    const element = document.querySelector(selector);
                    return element ? element.getAttribute(attr) : '';
                };
                
                // Helper function to extract multiple elements
                const getMultipleText = (selector) => {
                    return Array.from(document.querySelectorAll(selector)).map(el => el.innerText.trim());
                };
                
                // Extract structured data from JSON-LD
                let structuredData = {};
                try {
                    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
                    jsonLdScripts.forEach(script => {
                        try {
                            const data = JSON.parse(script.textContent);
                            if (data) structuredData = { ...structuredData, ...data };
                        } catch (e) {}
                    });
                } catch (e) {}
                
                return {
                    // Personal Information
                    first_name: getText('*[data-testid="first-name"], .first-name, [class*="first"], .given-name') || 
                               getText('h1')?.split(' ')[0] || '',
                    
                    last_name: getText('*[data-testid="last-name"], .last-name, [class*="last"], .family-name') || 
                              getText('h1')?.split(' ').slice(1).join(' ') || '',
                    
                    full_name: getText('h1, .full-name, [class*="name"], .person-name') || 
                              document.title.split(' - ')[0] || '',
                    
                    email: getText('*[href^="mailto:"], .email, [class*="email"]')?.replace('mailto:', '') || 
                          getAttr('*[href^="mailto:"]', 'href')?.replace('mailto:', '') || '',
                    
                    mobile_number: getText('.phone, .mobile, [class*="phone"], [href^="tel:"]')?.replace('tel:', '') || 
                                  getAttr('[href^="tel:"]', 'href')?.replace('tel:', '') || '',
                    
                    linkedin_profile: getAttr('*[href*="linkedin.com"], .linkedin', 'href') || '',
                    
                    photo_url: getAttr('.profile-photo, .avatar, [class*="photo"], img[alt*="profile"], img[alt*="photo"]', 'src') || '',
                    
                    person_id: getAttr('[data-person-id], [data-id], [id*="person"]', 'data-person-id') || 
                              getAttr('[data-person-id], [data-id], [id*="person"]', 'data-id') || '',
                    
                    // Job Information
                    job_title: getText('.job-title, .title, .position, [class*="title"], .role') || 
                              getText('h2')?.split(' at ')[0] || '',
                    
                    headline: getText('.headline, .tagline, .description, [class*="headline"]') || 
                             getText('meta[name="description"]') || '',
                    
                    seniority: getText('.seniority, .level, [class*="senior"], [class*="level"]') || '',
                    
                    industry: getText('.industry, [class*="industry"], .sector') || 
                             getAttr('meta[name="industry"]', 'content') || '',
                    
                    // Department information (multiple possible)
                    'department/0': getMultipleText('.department, [class*="dept"], .team')[0] || '',
                    'department/1': getMultipleText('.department, [class*="dept"], .team')[1] || '',
                    
                    // Company Information
                    company_name: getText('.company-name, .company, [class*="company"], .organization') || 
                                 getText('h2')?.split(' at ')[1] || '',
                    
                    company_id: getAttr('[data-company-id], [data-org-id]', 'data-company-id') || 
                               getAttr('[data-company-id], [data-org-id]', 'data-org-id') || '',
                    
                    company_website: getAttr('*[href*="http"]:not([href*="linkedin"]):not([href*="twitter"]):not([href*="facebook"])', 'href') || '',
                    
                    company_linkedin: getAttr('*[href*="linkedin.com/company"], .company-linkedin', 'href') || '',
                    
                    company_size: getText('.company-size, [class*="size"], .employees') || '',
                    
                    company_phone_number: getText('.company-phone, [class*="company-phone"]') || '',
                    
                    // Location Information
                    city: getText('.city, .locality, [class*="city"]') || 
                         getText('.location')?.split(',')[0]?.trim() || '',
                    
                    state: getText('.state, .region, [class*="state"]') || 
                          getText('.location')?.split(',')[1]?.trim() || '',
                    
                    country: getText('.country, [class*="country"]') || 
                            getText('.location')?.split(',').pop()?.trim() || '',
                    
                    company_city: getText('.company-city, [class*="company-location"]')?.split(',')[0]?.trim() || '',
                    
                    company_state: getText('.company-state, [class*="company-location"]')?.split(',')[1]?.trim() || '',
                    
                    company_country: getText('.company-country, [class*="company-location"]')?.split(',').pop()?.trim() || '',
                    
                    // Additional metadata
                    url: window.location.href,
                    page_title: document.title,
                    scraped_at: new Date().toISOString(),
                    
                    // Try to extract from meta tags
                    meta_data: {
                        description: getAttr('meta[name="description"]', 'content'),
                        keywords: getAttr('meta[name="keywords"]', 'content'),
                        author: getAttr('meta[name="author"]', 'content'),
                        og_title: getAttr('meta[property="og:title"]', 'content'),
                        og_description: getAttr('meta[property="og:description"]', 'content'),
                    },
                    
                    // Structured data if available
                    structured_data: structuredData
                };
            });
            
            await browser.close();
            
            // Save data
            await Apify.pushData({
                ...data,
                batch: currentBatch + 1,
                processedAt: new Date().toISOString()
            });
            
            console.log(`✓ Processed: ${url}`);
            
        } catch (error) {
            console.error(`✗ Error processing ${url}:`, error.message);
            await Apify.pushData({
                url,
                error: error.message,
                batch: currentBatch + 1,
                processedAt: new Date().toISOString()
            });
        }
        
        // Small delay between URLs to be nice to servers
        await Apify.utils.sleep(2000);
    }
    
    // Schedule next batch if there are more URLs
    if (endIndex < allUrls.length) {
        console.log(`Scheduling next batch: ${currentBatch + 2}`);
        
        // Save progress info
        await Apify.setValue('nextBatch', {
            currentBatch: currentBatch + 1,
            totalBatches: Math.ceil(allUrls.length / urlsPerBatch),
            progress: `${endIndex}/${allUrls.length}`,
            progressPercent: Math.round((endIndex / allUrls.length) * 100),
            nextRunAt: new Date(Date.now() + 60000).toISOString(), // 1 minute later
            remainingUrls: allUrls.length - endIndex
        });
        
        console.log(`Progress: ${endIndex}/${allUrls.length} (${Math.round((endIndex / allUrls.length) * 100)}%)`);
        
    } else {
        console.log('🎉 All URLs processed!');
        await Apify.setValue('processingComplete', {
            totalProcessed: allUrls.length,
            totalBatches: currentBatch + 1,
            completedAt: new Date().toISOString(),
            status: 'COMPLETED'
        });
    }
    
    console.log(`Batch ${currentBatch + 1} completed successfully!`);
});
