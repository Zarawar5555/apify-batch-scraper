const Apify = require('apify');

Apify.main(async () => {
    // Get input data
    const input = await Apify.getInput();
    
    // Your complete URL list - REPLACE WITH YOUR ACTUAL URLS
    const allUrls = [
        'https://grittechs.com',
        'https://gritzarts.com',
        'https://grizzly.co',
        'https://grnbostonnorth.com',
        'https://grnoakbrook.com',
        'https://gromarketing.com',
        'https://grofire.com',
        'https://groliveapps.com',
        'https://grooters.us',
        'https://grootsvaluation.com'
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
            
            // CUSTOMIZE YOUR SCRAPING LOGIC HERE
            const data = await page.evaluate(() => {
                return {
                    title: document.title,
                    url: window.location.href,
                    h1: document.querySelector('h1')?.innerText || '',
                    metaDescription: document.querySelector('meta[name="description"]')?.content || '',
                    // Add more fields as needed:
                    // price: document.querySelector('.price')?.innerText || '',
                    // images: Array.from(document.querySelectorAll('img')).map(img => img.src),
                    // content: document.querySelector('.content')?.innerText || '',
                    // Add any domain-specific selectors here
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
