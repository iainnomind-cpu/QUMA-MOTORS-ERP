import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ===== Tipos =====
interface PartsRequestInput {
    name: string;
    phone?: string;
    part_name: string;
    motorcycle_model?: string;
    city?: string;
    state?: string;
}

// ===== Geocodificación =====
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || !address) return null;

    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&region=mx&language=es`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === 'OK' && data.results.length > 0) {
            const loc = data.results[0].geometry.location;
            console.log(`📍 Geocodificado "${address}" → lat: ${loc.lat}, lng: ${loc.lng}`);
            return { lat: loc.lat, lng: loc.lng };
        }
    } catch (err) {
        console.error('Error geocodificando:', err);
    }
    return null;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ===== Handler principal =====
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const body: PartsRequestInput = req.body;

        // Validar campos requeridos
        if (!body.name || !body.part_name) {
            return res.status(400).json({
                success: false,
                error: 'Campos requeridos: name, part_name'
            });
        }

        console.log(`🔧 Nueva solicitud de refacción: ${body.name} - ${body.part_name}`);

        // ===== ASIGNAR SUCURSAL MÁS CERCANA =====
        let assignedBranch: { id: string; name: string } | null = null;

        // Cargar todas las sucursales con coordenadas
        const { data: branches } = await supabase
            .from('branches')
            .select('id, name, latitude, longitude')
            .eq('active', true);

        if (branches && branches.length > 0) {
            // Geocodificar la ubicación del cliente
            const locationStr = [body.city, body.state].filter(Boolean).join(', ');
            if (locationStr) {
                const coords = await geocode(locationStr);
                if (coords) {
                    // Encontrar sucursal más cercana
                    let minDist = Infinity;
                    for (const branch of branches) {
                        if (branch.latitude && branch.longitude) {
                            const dist = haversine(coords.lat, coords.lng, branch.latitude, branch.longitude);
                            console.log(`📏 Distancia a ${branch.name}: ${dist.toFixed(1)} km`);
                            if (dist < minDist) {
                                minDist = dist;
                                assignedBranch = { id: branch.id, name: branch.name };
                            }
                        }
                    }
                    if (assignedBranch) {
                        console.log(`✅ Sucursal más cercana: ${assignedBranch.name} (${minDist.toFixed(1)} km)`);
                    }
                }
            }

            // Fallback: primera sucursal activa
            if (!assignedBranch) {
                assignedBranch = { id: branches[0].id, name: branches[0].name };
                console.log(`⚠️ Fallback sucursal: ${assignedBranch.name}`);
            }
        }

        // ===== BUSCAR GERENTE DE LA SUCURSAL =====
        let manager: { id: string; name: string; phone: string | null } | null = null;

        if (assignedBranch) {
            const { data: managers, error: mgrError } = await supabase
                .from('user_profiles')
                .select('id, full_name, phone')
                .eq('role', 'gerente')
                .eq('active', true)
                .eq('branch_id', assignedBranch.id)
                .limit(1);

            if (!mgrError && managers && managers.length > 0) {
                manager = {
                    id: managers[0].id,
                    name: managers[0].full_name,
                    phone: managers[0].phone
                };
                console.log(`👔 Gerente encontrado: ${manager.name}`);
            } else {
                // Fallback: buscar cualquier gerente activo
                const { data: anyManagers } = await supabase
                    .from('user_profiles')
                    .select('id, full_name, phone')
                    .eq('role', 'gerente')
                    .eq('active', true)
                    .limit(1);

                if (anyManagers && anyManagers.length > 0) {
                    manager = {
                        id: anyManagers[0].id,
                        name: anyManagers[0].full_name,
                        phone: anyManagers[0].phone
                    };
                    console.log(`⚠️ Gerente fallback (otra sucursal): ${manager.name}`);
                } else {
                    console.log('❌ No se encontró ningún gerente activo');
                }
            }
        }

        // ===== INSERTAR SOLICITUD =====
        const { data: insertedRequest, error: insertError } = await supabase
            .from('parts_requests')
            .insert([{
                customer_name: body.name,
                customer_phone: body.phone || null,
                part_name: body.part_name,
                motorcycle_model: body.motorcycle_model || null,
                city: body.city || null,
                state: body.state || null,
                branch_id: assignedBranch?.id || null,
                assigned_manager_id: manager?.id || null,
                assigned_manager_name: manager?.name || null,
                status: 'pendiente'
            }])
            .select()
            .single();

        if (insertError || !insertedRequest) {
            console.error('Error insertando solicitud:', insertError);
            return res.status(500).json({
                success: false,
                error: 'Error al crear la solicitud de refacción',
                details: insertError?.message
            });
        }

        console.log(`✅ Solicitud creada: ${insertedRequest.id}`);

        // ===== NOTIFICAR AL GERENTE POR WHATSAPP =====
        let whatsappSent = false;
        let metaResponse = null;
        let metaError = null;

        if (manager?.phone && process.env.PHONE_NUMBER_ID && process.env.META_ACCESS_TOKEN) {
            try {
                const phoneId = process.env.PHONE_NUMBER_ID;
                const token = process.env.META_ACCESS_TOKEN;
                const version = process.env.API_VERSION || 'v21.0';

                // Formatear teléfono
                let mgrPhone = manager.phone.replace(/\D/g, '');
                if (mgrPhone.length === 10) mgrPhone = '52' + mgrPhone;

                // Ubicación del cliente para el parámetro urgencia
                const clientLocation = [body.city, body.state].filter(Boolean).join(', ') || 'No especificada';

                const notificationBody = {
                    messaging_product: 'whatsapp',
                    to: mgrPhone,
                    type: 'template',
                    template: {
                        name: 'parts_request',
                        language: { code: 'es_MX' },
                        components: [
                            {
                                type: 'body',
                                parameters: [
                                    { type: 'text', text: body.name },                           // {{1}} nombre
                                    { type: 'text', text: body.part_name },                      // {{2}} refaccion
                                    { type: 'text', text: body.motorcycle_model || 'No especificado' }, // {{3}} modelo
                                    { type: 'text', text: clientLocation }                       // {{4}} urgencia → ciudad
                                ]
                            }
                        ]
                    }
                };

                const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(notificationBody)
                });

                metaResponse = await response.json();
                whatsappSent = response.ok;
                console.log(`${whatsappSent ? '✅' : '❌'} WhatsApp al gerente ${manager.name} - Status: ${response.status}`);
            } catch (waError) {
                console.error('❌ Error enviando WhatsApp al gerente:', waError);
                metaError = waError instanceof Error ? waError.message : 'Unknown error';
            }
        } else {
            console.log('⚠️ No se pudo enviar WhatsApp: falta teléfono del gerente o credenciales Meta');
        }

        // ===== RESPUESTA =====
        return res.status(200).json({
            success: true,
            data: {
                request_id: insertedRequest.id,
                customer_name: insertedRequest.customer_name,
                part_name: insertedRequest.part_name,
                motorcycle_model: insertedRequest.motorcycle_model,
                status: insertedRequest.status,
                branch_id: assignedBranch?.id || null,
                branch_name: assignedBranch?.name || null,
                assigned_manager_id: manager?.id || null,
                assigned_manager_name: manager?.name || null
            },
            message: `Solicitud de refacción "${body.part_name}" registrada exitosamente${assignedBranch ? ` - Sucursal: ${assignedBranch.name}` : ''}${manager ? ` - Gerente: ${manager.name}` : ''}`,
            whatsapp_debug: {
                attempted: !!manager?.phone,
                sent: whatsappSent,
                manager_phone: manager?.phone ? '****' + manager.phone.slice(-4) : 'N/A',
                meta_response: metaResponse,
                meta_error: metaError
            }
        });

    } catch (error) {
        console.error('❌ Error general:', error);
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
