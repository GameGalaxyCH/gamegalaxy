import { connect } from 'puppeteer-real-browser';
import * as ProxyChain from 'proxy-chain';

async function testProxy() {
    const PROXY_SERVER = 'gate.decodo.com:7000';
    // Residential proxies
    const PROXY_USER = 'spar0li9gx';
    const PROXY_PASS = 'fyx8n6eq6IkVu=N5oT';

    // Mobile Proxies
    /*
    const PROXY_USER = 'spgwddixj1';
    const PROXY_PASS = 'cnr_Li8v6DChhm5h3O';
    */

    // 1. Construct the "Dirty" URL with credentials
    const originalProxyUrl = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_SERVER}`;

    console.log("🚀 Starting Proxy Test (via proxy-chain)...");

    let newProxyUrl = "";
    let browser: any = null;

    try {
        // 2. "Anonymize" it: This starts a local server that handles auth for us
        newProxyUrl = await ProxyChain.anonymizeProxy(originalProxyUrl);
        console.log(`🔗 Local Tunnel Created: ${newProxyUrl}`);

        // 3. Launch Browser using the CLEAN local URL
        // No username/password needed here, because 'proxy-chain' handles it
        const connection = await connect({
            headless: false,
            turnstile: true,
            disableXvfb: false,
            args: [
                `--proxy-server=${newProxyUrl}`,
                '--disable-http2', // Helps with stability
                '--ignore-certificate-errors'
            ]
        });

        browser = connection.browser;
        const page = connection.page;

        console.log("✅ Browser launched. Checking connection...");

        // 4. Verify IP (Should be Decodo IP, not your home IP)
        await page.goto('https://api.ipify.org', { waitUntil: 'networkidle2', timeout: 60000 });
        const ip = await page.evaluate(() => document.body.innerText);
        console.log(`🌍 Current IP: ${ip}`);

        // 5. Try Cardmarket
        console.log("🃏 Navigating to Cardmarket...");
        await page.goto('https://www.cardmarket.com/de/Magic', { waitUntil: 'domcontentloaded', timeout: 60000 });

        const title = await page.title();
        console.log(`✅ Page Title: "${title}"`);

        // Keep open to verify visual
        await new Promise(r => setTimeout(r, 10000));

    } catch (error: any) {
        console.error("❌ TEST FAILED:", error.message);
    } finally {
        if (browser) await browser.close();
        // 6. Important: Close the local tunnel to free up the port
        if (newProxyUrl) await ProxyChain.closeAnonymizedProxy(newProxyUrl, true);
    }
}

testProxy();