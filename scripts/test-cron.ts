// scripts/test-cron.ts
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

async function triggerCron() {
    const secret = process.env.CRON_SECRET;
    const url = "http://localhost:3000/api/cron/sync-orders";

    if (!secret) {
        console.error("❌ Error: CRON_SECRET is missing in .env");
        process.exit(1);
    }

    console.log(`🚀 Triggering Cron Job at ${url}...`);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${secret}`,
                "Content-Type": "application/json"
            }
        });

        const status = response.status;
        const text = await response.text();

        if (!response.ok) {
            console.error(`❌ Failed: Status ${status}`);
            console.error("Response:", text);
        } else {
            console.log(`✅ Success: Status ${status}`);
            console.log("Response:", text);
        }

    } catch (error) {
        console.error("❌ Network Error:", error);
    }
}

triggerCron();