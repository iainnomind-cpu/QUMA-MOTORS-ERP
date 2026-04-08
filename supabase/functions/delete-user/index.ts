
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Server configuration error: Missing environment variables')
        }

        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        let body;
        try {
            body = await req.json();
        } catch (e) {
            throw new Error('Invalid JSON body');
        }

        const { user_id } = body;

        if (!user_id) {
            throw new Error('User ID is required')
        }

        console.log(`Processing delete for user: ${user_id}`)

        // 1. Delete user from Auth (This requires Service Role)
        const { error: deleteAuthError } = await supabaseClient.auth.admin.deleteUser(user_id)
        if (deleteAuthError) {
            console.error('Error deleting from Auth:', deleteAuthError)
            throw deleteAuthError
        }

        // 2. Delete user from user_profiles
        // Note: If you have ON DELETE CASCADE on your foreign key, this might happen automatically.
        // If not, we do it manually.
        const { error: deleteProfileError } = await supabaseClient
            .from('user_profiles')
            .delete()
            .eq('id', user_id)

        if (deleteProfileError) {
            console.error('Error deleting profile:', deleteProfileError)
        }

        // 3. Delete user from sales_agents (if exists)
        const { error: deleteAgentError } = await supabaseClient
            .from('sales_agents')
            .delete()
            .eq('id', user_id) // Assuming sales_agents.id is the user_id (or we should match by email if ID logic differs)

        // Fallback: Delete by email if ID didn't catch it (optional, but safer if IDs aren't synced)
        // However, usually ID is the key. If sales_agents uses a different ID, we might need to query by email first.
        // Given existing code, let's try deleting by ID first.

        if (deleteAgentError) {
            console.error('Error deleting sales_agent:', deleteAgentError)
        }

        return new Response(
            JSON.stringify({ success: true, user_id }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error: any) {
        console.error('Error deleting user:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
