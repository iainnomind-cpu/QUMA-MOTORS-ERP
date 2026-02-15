
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Explicitly specify path to .env to be sure
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Service Key Loaded:', supabaseKey ? 'Yes (' + supabaseKey.substring(0, 5) + '...)' : 'No');

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function checkSettings() {
    console.log('Querying system_settings...');
    const { data, error } = await supabase.from('system_settings').select('*');
    if (error) {
        console.error('Error fetching settings:', error);

        // Try another table to verify connection/key
        console.log('Trying branches table...');
        const { data: branches, error: branchError } = await supabase.from('branches').select('id, name').limit(1);
        if (branchError) {
            console.error('Error fetching branches (Key might be invalid):', branchError);
        } else {
            console.log('Branches query success:', branches);
            console.log('Result: Key works, but system_settings access denied.');
        }
    } else {
        console.log('Current Settings:', data);
    }
}

checkSettings();
