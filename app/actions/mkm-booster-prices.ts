'use server'

import { prisma } from "@/lib/prisma";
import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';

export type ScrapeResult = {
	success: boolean;
	data?: any;
	error?: string;
	source?: 'cache' | 'live';
};

// --- CONFIGURATION ---
const MAX_RETRIES = 5;

// PROXY CONFIGURATION
// Residential Proxies
const PROXY_SERVER = 'gate.decodo.com:7000';
const PROXY_USER = 'spar0li9gx';        	// Residential User
const PROXY_PASS = 'fyx8n6eq6IkVu=N5oT'; 	// Residential Pass

// --- HELPER: CLOUDFLARE DETECTOR ---
async function getPageState(page: any): Promise<'CLEAR' | 'BLOCK' | 'WAITING'> {
	try {
		return await page.evaluate(() => {
			const bodyText = document.body.innerText;
			const title = document.title;

			// 1. Critical Blocks (Captcha/Access Denied)
			if (
				document.getElementById('cf-error-details') ||
				title.includes('Attention Required') ||
				bodyText.includes('Access denied') ||
				bodyText.includes('security check')
			) {
				return 'BLOCK';
			}

			// 2. Queue / Waiting Room
			if (
				title.includes('Just a moment') ||
				title.includes('Waiting Room') ||
				title.includes('Queue-it') ||
				bodyText.includes('You are now in line') ||
				bodyText.includes('Estimated wait time') ||
				document.getElementById('lbHeader-h') !== null ||
				document.getElementById('main-panel') !== null ||
				document.getElementById('waitTime') !== null
			) {
				return 'WAITING';
			}

			// 3. Page appears clear
			return 'CLEAR';
		});
	} catch (error) {
		return 'BLOCK'; // Assume worst case on evaluation error
	}
}

function generateCandidateUrls(vendor: string | null, edition: string | null, mainType: string | null, langId: number | null = null): string[] {
    // 1. Determine Game Path
    let gamePath = 'Magic';
    const v = vendor || '';

    if (v === 'Magic: The Gathering') gamePath = 'Magic';
    if (v === 'Pokémon' || v === 'Pokemon') gamePath = 'Pokemon';
    if (v === 'Yu-Gi-Oh!') gamePath = 'YuGiOh';
    if (v === 'Disney Lorcana') gamePath = 'Lorcana';
    if (v === 'Flesh and Blood') gamePath = 'FleshAndBlood';

    const candidates: string[] = [];

    // 2. Validate Input
    // If we don't have edition or mainType, we cannot build the URL as requested.
    if (!edition || !mainType) {
        console.warn(`⚠️ Cannot generate URL: Missing edition ('${edition}') or mainType ('${mainType}')`);
        return [];
    }

    // 3. Slugify Helper
    const toSlug = (str: string) => str
        .replace(/[^a-zA-Z0-9 -]/g, '') // Remove special chars
        .trim()
        .replace(/\s+/g, '-');          // Spaces to dashes

    const setSlug = toSlug(edition);
    const typeSlug = toSlug(mainType);

    // Combined: "Dominaria-Collector-Booster"
    const combinedSlug = `${setSlug}-${typeSlug}`;

    // Create Query String for Language
    const query = langId ? `?language=${langId}` : '';

    // --- CANDIDATE 1: Standard Format ---
    // e.g. https://www.cardmarket.com/de/Magic/Products/Boosters/Dominaria-Collector-Booster?language=1
    candidates.push(`https://www.cardmarket.com/de/${gamePath}/Products/Boosters/${combinedSlug}${query}`);

    // --- CANDIDATE 2: Magic Fallback (Only if Magic) ---
    // e.g. https://www.cardmarket.com/de/Magic/Products/Boosters/Magic-The-Gathering-Dominaria-Collector-Booster?language=1
    if (gamePath === 'Magic') {
        candidates.push(`https://www.cardmarket.com/de/${gamePath}/Products/Boosters/Magic-The-Gathering-${combinedSlug}${query}`);
    }

    return candidates;
}

export async function deleteProductUrl(productId: string) {
	try {
		if (!productId) return { success: false, error: "No ID provided" };

		await prisma.scrapeDataSealed.update({
			where: { productId },
			data: {
				cardmarketUrl: "", // Clear the URL
				lowestPrice: 0,    // Reset price
				stockCount: 0,     // Reset stock
				lastScrapedAt: new Date(0) // Force immediate re-scrape next time
			}
		});

		return { success: true };
	} catch (error: any) {
		return { success: false, error: error.message };
	}
}
// --- Update URL Manually ---
export async function updateProductUrl(productId: string, newUrl: string) {
	try {
		if (!productId) return { success: false, error: "No ID provided" };

		await prisma.scrapeDataSealed.upsert({
			where: { productId },
			create: {
				productId,
				cardmarketUrl: newUrl,
				lowestPrice: 0,
				stockCount: 0,
				lastScrapedAt: new Date(0)
			},
			update: {
				cardmarketUrl: newUrl,
				lastScrapedAt: new Date(0)
			}
		});

		return { success: true };
	} catch (error: any) {
		return { success: false, error: error.message };
	}
}

export async function fetchMarketData(productId: string, forceRefresh = false): Promise<ScrapeResult> {
    try {
        if (!productId) return { success: false, error: "Missing Product ID" };

        // 1. CALCULATE TODAY'S MIDNIGHT
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 2. CHECK DB
        const existing = await prisma.scrapeDataSealed.findUnique({
            where: { productId },
        });

        // 2. DETERMINE URLS TO TRY
        let urlsToTry: string[] = [];
        let targetLanguage: string | null = null; // Store the expected language

        if (existing?.cardmarketUrl) {
            // If we have a saved URL, ONLY use that one
            urlsToTry = [existing.cardmarketUrl];

            // Still need to fetch product language for filtering
            const product = await prisma.product.findUnique({
                where: { id: productId },
                select: { language: true }
            });
            targetLanguage = product?.language || null;
        } else {
            // Select ONLY the required fields: edition, mainType, vendor, LANGUAGE
            const product = await prisma.product.findUnique({
                where: { id: productId },
                select: {
                    title: true,
                    vendor: true,
                    edition: true,
                    mainType: true,
                    language: true
                }
            });

            if (!product) return { success: false, error: "Product not found in DB" };

            targetLanguage = product.language;

            // Map DB Language to MKM ID
            let mkmLangId: number | null = null;
            if (targetLanguage === 'Deutsch') mkmLangId = 3;
            if (targetLanguage === 'Englisch') mkmLangId = 1;
            if (targetLanguage === 'Französisch') mkmLangId = 2;

            // Pass fields to generator
            urlsToTry = generateCandidateUrls(product.vendor, product.edition, product.mainType, mkmLangId);

            if (urlsToTry.length === 0) {
                return { success: false, error: "Could not generate URLs (Missing 'edition' or 'mainType' in DB)" };
            }
            console.log(`✨ Generated ${urlsToTry.length} candidate URLs for "${product.title}"`);
        }

        // 3. CACHE CHECK
        if (existing && existing.lastScrapedAt >= startOfToday && !forceRefresh) {
            return {
                success: true,
                data: {
                    ...existing,
                    lowestPrice: Number(existing.lowestPrice),
                    lastScrapedAt: existing.lastScrapedAt.toISOString(),
                },
                source: 'cache'
            };
        }

        // 4. PREPARE SCRAPER
        console.log(`🕵️ [Scraper] Starting for ${productId} (Lang: ${targetLanguage})`);

        let success = false;
        let scrapedData: any = null;
        let usedUrl = "";

        // --- OUTER LOOP: URL CANDIDATES ---
        for (const targetUrl of urlsToTry) {
            if (success) break; // Stop if we found it

            console.log(`🔎 Testing URL: ${targetUrl}`);
            let attempts = 0;

            // --- INNER LOOP: PROXY ROTATION ---
            while (!success && attempts < MAX_RETRIES) {
                let browser: any = null;
                try {
                    attempts++;

                    // CONNECT WITH REAL BROWSER
                    const connection = await connect({
                        headless: false, // Keep false for better evasion
                        turnstile: true, // Auto-click cloudflare
                        disableXvfb: false,
                        args: [
                            `--proxy-server=${PROXY_SERVER}`,
                            '--ignore-certificate-errors',
                            '--window-size=1920,1080'
                        ]
                    });

                    browser = connection.browser;
                    const page = connection.page;
                    await page.setViewport({ width: 1920, height: 1080 });

                    // Manual Authentication
                    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });

                    // Navigate
                    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

                    // --- LOGIN DETECTION & HANDLING ---
                    // Check if the login form exists in the DOM
                    const loginForm = await page.$('#header-login');

                    if (loginForm) {
                        console.log("🔒 Login form detected. Logging in...");

                        if (!process.env.MKM_USER || !process.env.MKM_PW) {
                            throw new Error("Login required but credentials missing in ENV.");
                        }

                        // Type credentials
                        await page.type('#header-login input[name="username"]', process.env.MKM_USER);
                        await page.type('#header-login input[name="userPassword"]', process.env.MKM_PW);

                        // Submit and wait for reload
                        await Promise.all([
                            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                            page.click('#header-login input[type="submit"]'),
                        ]);

                        console.log("🔓 Login submitted. Page reloaded.");

                        // Double check we aren't stuck on login (wrong pw)
                        if (await page.$('#header-login') !== null) {
                            throw new Error("Login failed (Form still present after submit).");
                        }
                    }

                    // CHECK 404
                    // Note: response might be null in some real-browser contexts if interception is weird, but usually fine
                    if (response?.status() === 404) {
                        console.log(`❌ 404 Not Found: ${targetUrl}`);
                        break;
                    }

                    // 2. Check Soft Redirects (Category Pages)
                    const currentUrl = page.url();
                    if (currentUrl.endsWith('/Products/Boosters') || currentUrl.endsWith('/Products/Singles')) {
                        console.log(`⚠️ Soft 404 Detected (Redirected to Category): ${currentUrl}`);
                        break; // Invalid URL, move to next candidate
                    }

                    // 3. LOOPING CLOUDFLARE/QUEUE CHECK
                    // We poll for up to 30 seconds to allow the RealBrowser/Turnstile solver to work.
                    let pageState = await getPageState(page);
                    let waitTime = 0;
                    const MAX_WAIT = 30000; // 30 seconds max wait
                    const POLL_INTERVAL = 2000; // Check every 2 seconds

                    while (pageState !== 'CLEAR' && waitTime < MAX_WAIT) {
                        console.log(`⏳ Status: ${pageState}. Waiting for clearance... (${waitTime / 1000}s)`);

                        // Wait
                        await new Promise(r => setTimeout(r, POLL_INTERVAL));
                        waitTime += POLL_INTERVAL;

                        // Re-evaluate
                        pageState = await getPageState(page);
                    }

                    if (pageState !== 'CLEAR') {
                        throw new Error(`Timeout: Failed to clear ${pageState} state after ${MAX_WAIT / 1000}s`);
                    }

                    // 4. POSITIVE VALIDATION
                    // Ensure the DOM actually contains product data before parsing
                    const content = await page.content();
                    const $ = cheerio.load(content);

                    // Check for specific Cardmarket product page elements
                    const isValidProductPage = $('.article-row').length > 0 || $('.col-sellerProductInfo').length > 0;
                    if (!isValidProductPage) {
                        // Check if it's a valid "0 results" page or a broken render
                        const isZeroResults = $('body').text().includes('Es wurden keine Artikel gefunden');

                        if (!isZeroResults) {
                            throw new Error("Page loaded but lacks valid product structure.");
                        }
                    }

                    // Parse Data
                    const items: any[] = [];

                    $('.article-row').each((_, element) => {
                        const row = $(element);

                        // --- 1. ROBUST LANGUAGE EXTRACTION ---
                        const langElement = row.find('.product-attributes .icon');

                        // Strategy A: Try standard attributes (post-render)
                        let itemLang = langElement.attr('data-original-title') ||
                            langElement.attr('data-bs-original-title') ||
                            langElement.attr('title');

                        // Strategy B: Parse the 'onmouseover' string (Server-Side safe)
                        // format: onmouseover="showMsgBox(this,`German`)"
                        if (!itemLang) {
                            const mouseOver = langElement.attr('onmouseover');
                            if (mouseOver) {
                                // Regex to grab text between backticks or single quotes
                                const match = mouseOver.match(/showMsgBox\(this,[`'"](.+?)[`'"]\)/);
                                if (match && match[1]) {
                                    itemLang = match[1];
                                }
                            }
                        }

                        // DEBUG: Log what we found to understand why rows are skipped
                        //console.log(`Row detected: Lang=${itemLang}`);

                        // 2. Extract Price
                        const priceRaw = row.find('.price-container .color-primary').text().trim();
                        const priceVal = parseFloat(priceRaw.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));

                        // 3. Extract Seller Name
                        const seller = row.find('.seller-name a').text().trim();

                        // --- 4. Extract Location ---
                        const locAttr = row.find('.seller-name .icon');
                        let location = locAttr.attr('data-original-title') || locAttr.attr('data-bs-original-title');

                        // Fallback for location (same onmouseover logic)
                        if (!location) {
                            const locMouseOver = locAttr.attr('onmouseover');
                            if (locMouseOver) {
                                const match = locMouseOver.match(/Artikelstandort: (.+?)[`'"]\)/);
                                if (match) location = match[1];
                            }
                        }
                        location = location ? location.replace('Artikelstandort: ', '').trim() : '?';

                        // 5. Extract Stock
                        // Use .first() because Cardmarket renders the count twice (mobile/desktop)
                        // causing .text() to return "1212" instead of "12"
                        const countRaw = row.find('.amount-container .item-count').first().text().trim();
                        const countVal = parseInt(countRaw) || 0;

                        if (!isNaN(priceVal)) {
                            items.push({
                                seller,
                                price: priceVal,
                                formatted: priceRaw,
                                location: location,
                                stock: countVal,
                                language: itemLang
                            });
                        }
                    });

                    // Sort items by price
                    items.sort((a, b) => a.price - b.price);

                    scrapedData = {
                        lowestPrice: items.length > 0 ? items[0].price : 0,
                        stockCount: items.length,
                        topListings: items
                    };

                    console.log(`✅ Success! Found ${items.length} items at ${targetUrl}`);
                    usedUrl = targetUrl;
                    success = true; // BREAK ALL LOOPS

                } catch (error: any) {
                    console.error(`⚠️ Attempt ${attempts} Error (${targetUrl}): ${error.message}`);

                    if (attempts < MAX_RETRIES) {
                        // Small wait before rotating/retrying
                        await new Promise(r => setTimeout(r, 2000));
                    }
                } finally {
                    if (browser) await browser.close();
                }
            } // End Inner Loop
        } // End Outer Loop

        if (!success || !scrapedData) {
            return { success: false, error: `Could not find product after checking ${urlsToTry.length} URLs.` };
        }

        // 5. SAVE DATA
        const result = await prisma.$transaction(async (tx) => {
            const mainRecord = await tx.scrapeDataSealed.upsert({
                where: { productId },
                create: {
                    productId,
                    cardmarketUrl: usedUrl,
                    lowestPrice: scrapedData.lowestPrice,
                    stockCount: scrapedData.stockCount,
                    topListings: scrapedData.topListings,
                    lastScrapedAt: new Date()
                },
                update: {
                    cardmarketUrl: usedUrl,
                    lowestPrice: scrapedData.lowestPrice,
                    stockCount: scrapedData.stockCount,
                    topListings: scrapedData.topListings,
                    lastScrapedAt: new Date()
                }
            });

            // Update History
            if (scrapedData.lowestPrice > 0) {
                await tx.scrapeDataSealedHistory.upsert({
                    where: {
                        scrapeDataId_date: {
                            scrapeDataId: mainRecord.id,
                            date: startOfToday
                        }
                    },
                    create: {
                        scrapeDataId: mainRecord.id,
                        date: startOfToday,
                        price: scrapedData.lowestPrice,
                        stockCount: scrapedData.stockCount
                    },
                    update: {
                        price: scrapedData.lowestPrice,
                        stockCount: scrapedData.stockCount,
                        createdAt: new Date()
                    }
                });
            }
            return mainRecord;
        });

        const serializedResult = {
            ...result,
            lowestPrice: Number(result.lowestPrice),
            lastScrapedAt: result.lastScrapedAt.toISOString(),
            updatedAt: result.updatedAt.toISOString(),
        };

        return { success: true, data: serializedResult, source: 'live' };

    } catch (error: any) {
        console.error("Server Action Error:", error);
        return { success: false, error: error.message };
    }
}