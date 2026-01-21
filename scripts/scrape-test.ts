import "dotenv/config";
import fs from 'fs/promises';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit'; 

// --- CONFIGURATION ---
const CONCURRENCY_LIMIT = 3; // Reduced slightly as we now launch 1 browser per task (safer for RAM)
const COOKIE_FILE = path.resolve(__dirname, 'cookies.json');
const MAX_RETRIES = 5; // How many times to rotate proxy before giving up

// PROXY CONFIGURATION (From your singlePurchaseServer.js)
const PROXY_SERVER = 'de.smartproxy.com:20000';
const PROXY_USER = 'spar0li9gx';
const PROXY_PASS = 'fyx8n6eq6IkVu=N5oT';

// The list of sets you want to scrape
const SET_URLS = [
  "https://www.cardmarket.com/en/Magic/Products/Boosters/Battle-for-Zendikar-Booster",
  "https://www.cardmarket.com/en/Magic/Products/Boosters/Edge-of-Eternities-Play-Booster",
  "https://www.cardmarket.com/en/Magic/Products/Boosters/Tarkir-Dragonstorm-Play-Booster",
  "https://www.cardmarket.com/en/Magic/Products/Boosters/Modern-Horizons-3-Play-Booster",
  "https://www.cardmarket.com/en/Magic/Products/Boosters/Lorwyn-Eclipsed-Play-Booster",
  "https://www.cardmarket.com/en/Magic/Products/Boosters/Bloomburrow-Play-Booster"
];

// Your filters (English only, Good reputation)
const QUERY_PARAMS = "?sellerReputation=2&language=1";

puppeteer.use(StealthPlugin());

async function runParallelScraper() {
  console.log(`🚀 Starting Parallel Scraper (Concurrency: ${CONCURRENCY_LIMIT})...`);

  // --- STEP 1: LOGIN (INITIAL SESSION) ---
  // We perform one initial login to generate the cookie file.
  // We use the proxy here too to ensure the session is created under similar conditions.
  await handleLogin(); 

  // --- STEP 2: PREPARE TASKS ---
  const limit = pLimit(CONCURRENCY_LIMIT);
  
  // Map every URL to a "limited" task function
  // Note: We no longer pass a shared 'browser' instance. 
  // Each task manages its own browser to allow for independent proxy rotation.
  const tasks = SET_URLS.map((baseUrl) => {
    return limit(() => scrapeSinglePage(`${baseUrl}${QUERY_PARAMS}`));
  });

  // --- STEP 3: EXECUTE IN PARALLEL ---
  console.log(`\n🌊 Unleashing ${tasks.length} scrapers...`);
  
  try {
    const results = await Promise.all(tasks);

    // --- STEP 4: AGGREGATE ---
    const flatResults = results.flat();
    console.log(`\n🎉 All done! Total items scraped: ${flatResults.length}`);
    
    // Show a sample of the data
    if (flatResults.length > 0) {
        console.table(flatResults.slice(0, 10));
    }
  } catch (err) {
    console.error("Critical Failure in Task Execution:", err);
  }
}

// --- HELPER: LOGIC TO SCRAPE ONE URL WITH PROXY ROTATION ---
async function scrapeSinglePage(url: string) {
  let attempts = 0;
  let success = false;
  let items: any[] = [];

  // Random stagger to prevent all browsers launching at the EXACT millisecond
  const stagger = Math.floor(Math.random() * 2000); 
  await new Promise(r => setTimeout(r, stagger));

  while (!success && attempts < MAX_RETRIES) {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        attempts++;
        console.log(`📡 [Attempt ${attempts}/${MAX_RETRIES}] Opening ${url}`);

        // Launch a NEW browser instance for this attempt with Proxy Args
        browser = await puppeteer.launch({
            headless: false, // Debug mode.
            defaultViewport: { width: 1920, height: 1080 },
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                `--proxy-server=${PROXY_SERVER}`, // Inject Proxy
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list',
            ]
        });

        page = await browser.newPage();

        // Authenticate Proxy
        await page.authenticate({
            username: PROXY_USER,
            password: PROXY_PASS,
        });

        // Load Cookies (Session)
        try {
            const cookiesString = await fs.readFile(COOKIE_FILE, 'utf8');
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
        } catch (e) { /* Ignore if no cookie file, might work without logging in for some public pages */ }

        // Navigate
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // --- CLOUDFLARE CHECK ---
        const isBlocked = await detectCloudflare(page);
        if (isBlocked) {
            throw new Error("Cloudflare blocking detected");
        }

        // --- SCRAPING LOGIC ---
        const content = await page.content();
        const $ = cheerio.load(content);

        // Parse visible rows
        $('.article-row').each((_, element) => {
            const data = parseDetailedRow($, element);
            if (data) items.push(data);
        });

        console.log(`✅ [Finished] ${url} -> Found ${items.length} items`);
        success = true; // Break the loop

    } catch (error: any) {
        console.error(`❌ [Failed Attempt ${attempts}] ${url} - Error: ${error.message}`);
        
        // If it was a block or timeout, we wait and retry (loop continues)
        if (error.message.includes('Cloudflare') || error.message.includes('Timeout') || error.message.includes('ERR_TIMED_OUT')) {
            console.log(`🔄 Rotating Proxy and Retrying ${url}...`);
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * 3000) + 1000));
        } else {
            // If it's a parsing error or something fatal, maybe we shouldn't retry? 
            // For now, we continue retrying as per "test through proxies" logic.
        }

    } finally {
        if (browser) await browser.close(); // Crucial: Close browser to get a new IP/Clean slate next loop
    }
  }

  if (!success) {
      console.error(`💀 [Given Up] Could not scrape ${url} after ${MAX_RETRIES} attempts.`);
      return [];
  }

  return items;
}

// --- HELPER: LOGIN LOGIC ---
async function handleLogin() {
  console.log("🔐 Checking Session / Logging in...");
  
  // We use a browser with proxy here too, to match the scraping environment
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    args: [
        `--proxy-server=${PROXY_SERVER}`,
        '--ignore-certificate-errors'
    ]
  });

  const page = await browser.newPage();
  
  try {
      await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });

      // Check if session file exists
      try {
        const cookiesString = await fs.readFile(COOKIE_FILE, 'utf8');
        const cookies = JSON.parse(cookiesString);
        await page.setCookie(...cookies);
        console.log("🍪 Cookies loaded. Verifying session...");
      } catch (e) { console.log("ℹ️  No session file. Fresh login required."); }

      await page.goto("https://www.cardmarket.com/en/Magic", { waitUntil: 'networkidle2' });

      // Check Cloudflare on login too
      if (await detectCloudflare(page)) {
          console.error("⚠️ Cloudflare blocked the LOGIN page. You might need to manually solve it or retry.");
      }

      if (await page.$('#header-login') === null) {
        console.log("✅ Already logged in.");
        return;
      }

      console.log("📝 Performing fresh login...");
      if (!process.env.MKM_USER || !process.env.MKM_PW) throw new Error("Missing Credentials");

      await page.type('#header-login input[name="username"]', process.env.MKM_USER);
      await page.type('#header-login input[name="userPassword"]', process.env.MKM_PW);
      
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click('#header-login input[type="submit"]'),
      ]);

      const currentCookies = await page.cookies();
      await fs.writeFile(COOKIE_FILE, JSON.stringify(currentCookies, null, 2));
      console.log("💾 New session saved.");

  } catch (err) {
      console.error("Login Failed:", err);
  } finally {
      await browser.close();
  }
}

// --- HELPER: CLOUDFLARE DETECTOR (From singlePurchaseServer.js) ---
async function detectCloudflare(page: Page) {
    try {
      const isChallengePage = await page.evaluate(() => {
        return Boolean(
          document.getElementById('cf-error-details') ||
          document.querySelector('div[id*="challenge"]') ||
          (document.querySelector('title') && document.querySelector('title').innerText.includes('Just a moment')) ||
          (document.querySelector('h1') && document.querySelector('h1').innerText.includes('Attention Required')) ||
          document.body.innerText.includes('Please complete the security check') ||
          document.body.innerText.includes('Access denied') ||
          document.body.innerText.includes('You are being rate limited') ||
          document.body.innerText.includes('Our systems have detected unusual traffic from your computer network')
        );
      });
      return isChallengePage;
    } catch (error: any) {
      console.error('Error during Cloudflare detection:', error.message);
      return true; // Assume blocked if we can't check
    }
}

// --- HELPER: PARSER ---
function parseDetailedRow($: cheerio.CheerioAPI, element: any) {
  try {
    const row = $(element);

    const sellerName = row.find('.seller-name a').text().trim();
    // Get reputation from class name (e.g. fonticon-seller-rating-outstanding)
    const reputationClass = row.find('.seller-info span[class^="fonticon-seller-rating-"]').attr('class');
    const reputation = reputationClass ? reputationClass.replace('fonticon-seller-rating-', '') : "Unknown";
    
    // Get location from tooltip or aria-label
    const location = row.find('.seller-name .icon[aria-label^="Item location"]').attr('aria-label')?.replace("Item location: ", "") || "Unknown";

    const price = row.find('.price-container .color-primary').first().text().trim();
    
    // Count logic
    let count = row.find('.col-offer .amount-container .item-count').text().trim();
    if (!count) count = row.find('.item-count').first().text().trim();

    return {
      seller: sellerName,
      reputation: reputation,
      location: location,
      price: price,
      count: count,
      product: "Booster" // You might want to pass the Set Name here dynamically in a real app
    };
  } catch (e) { return null; }
}

runParallelScraper();