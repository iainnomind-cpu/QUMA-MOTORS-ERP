
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Variables de entorno faltantes: SUPABASE_URL o KEY')
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })

        const { email, password, full_name, role, phone, branch_id } = await req.json()

        console.log(`Procesando creación de usuario: ${email}`)

        // 1. Verificar si el usuario ya existe en Auth
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()

        if (listError) throw listError

        const existingUser = users.find(u => u.email === email)
        let userId

        if (existingUser) {
            console.log(`Usuario ${email} ya existe en Auth (ID: ${existingUser.id}). Reutilizando...`)
            userId = existingUser.id

            // Si el usuario existe, actualizamos su contraseña si se proporcionó una
            if (password) {
                const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                    password: password,
                    user_metadata: { full_name, role }
                })
                if (updateError) throw updateError
            }
        } else {
            console.log(`Creando nuevo usuario en Auth: ${email}...`)
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name, role }
            })

            if (createError) throw createError
            userId = newUser.user.id
        }

        // 2. Insertar o Actualizar el perfil en user_profiles (Upsert)
        console.log(`Actualizando perfil en DB para usuario ${userId}...`)

        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .upsert({
                id: userId,
                email,
                full_name,
                role,
                phone: phone || null,
                branch_id: branch_id || null,
                active: true,
                updated_at: new Date().toISOString()
            })

        if (profileError) {
            console.error('Error al crear perfil user_profiles:', profileError)
            // Si es un usuario NUEVO y falla el perfil, podríamos borrarlo de Auth para no dejar basura
            if (!existingUser) {
                await supabaseAdmin.auth.admin.deleteUser(userId)
            }
            throw profileError
        }

        // 3. Si el rol es vendedor, crear/actualizar registro en sales_agents para el round robin
        if (role === 'vendedor') {
            console.log(`Creando/actualizando sales_agent para vendedor ${full_name}...`)
            const { error: agentError } = await supabaseAdmin
                .from('sales_agents')
                .upsert({
                    id: userId,
                    name: full_name,
                    email,
                    phone: phone || null,
                    branch_id: branch_id || null,
                    status: 'active',
                    total_leads_assigned: 0,
                    total_leads_converted: 0,
                    conversion_rate: 0
                }, { onConflict: 'id' })

            if (agentError) {
                console.error('Error al crear sales_agent:', agentError)
                // No hacemos throw, el usuario ya se creó correctamente
            } else {
                console.log(`✅ Sales agent creado/actualizado para ${full_name}`)
            }
        }

        return new Response(
            JSON.stringify({ success: true, user_id: userId }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error: any) {
        console.error('Error en create-user:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
