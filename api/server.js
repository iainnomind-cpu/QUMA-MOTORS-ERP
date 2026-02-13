
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';

// Load .env from project root
dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Helper to adapt Vercel/Next.js handler to Express
const adaptHandler = (handler) => async (req, res) => {
    try {
        await handler(req, res);
    } catch (err) {
        console.error('Handler Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
};

const startServer = async () => {
    try {
        // Dynamic import to ensure dotenv loads first
        const { default: marketingHandler, executeProcessScheduled } = await import('./marketing.js');
        const { default: webhookHandler } = await import('./webhook/whatsapp.js');

        // Middleware to inject action for backward compatibility
        const withAction = (action, handler) => (req, res) => {
            req.query = req.query || {};
            req.query.action = action;
            return adaptHandler(handler)(req, res);
        };

        // Old Routes -> Mapped to Unified Controller
        app.post('/api/send-campaign', withAction('send_campaign', marketingHandler));
        app.post('/api/create-template', withAction('create_template', marketingHandler));
        app.post('/api/sync-templates', withAction('sync_templates', marketingHandler));
        app.post('/api/process-scheduled-campaigns', withAction('process_scheduled', marketingHandler));

        // Unified Route (New Standard)
        app.all('/api/marketing', adaptHandler(marketingHandler));

        // Webhook
        app.all('/api/webhook/whatsapp', adaptHandler(webhookHandler));

        // Cron job: check every minute for due scheduled campaigns AND birthdays
        cron.schedule('* * * * *', async () => {
            try {
                const result = await executeProcessScheduled();
                if (result.processed && result.results.length > 0) {
                    console.log(`[CRON] Processed campaigns/birthdays:`, JSON.stringify(result.results));
                }
            } catch (err) {
                console.error('[CRON] Error:', err.message);
            }
        });

        // (Optional) Daily 9 AM Cron deprecated as minute-cron handles it, 
        // but keeping loop alive if we wanted specific time checks in future.
        // For now, the minute cron covers everything safely with DB locking/dedup.

        app.listen(port, () => {
            console.log(`🚀 Local API Server running on http://localhost:${port}`);
            console.log(`- POST /api/marketing?action=... (Unified)`);
            console.log(`- POST /api/send-campaign (Legacy mapped)`);
            console.log(`- POST /api/create-template (Legacy mapped)`);
            console.log(`- POST /api/sync-templates (Legacy mapped)`);
            console.log(`- ALL  /api/webhook/whatsapp (Unified)`);
            console.log(`⏰ Cron job active: checking campaigns & birthdays every minute`);
            console.log(`🔑 Service Role Key Loaded: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
    }
};

startServer();
