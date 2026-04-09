/**
 * Script de Diagnóstico para WhatsApp Business API
 * Ejecutar: node diagnose-whatsapp.js
 * 
 * Verifica:
 * 1. Variables de entorno presentes
 * 2. Token de acceso válido (no expirado)
 * 3. Número de teléfono asociado
 * 4. Templates disponibles
 * 5. Envío de prueba (opcional)
 */

import dotenv from 'dotenv';
dotenv.config();

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const WABA_ID = process.env.WABA_ID;
const API_VERSION = process.env.API_VERSION || 'v21.0';
const APP_ID = process.env.META_APP_ID;

console.log('='.repeat(60));
console.log('🔍 DIAGNÓSTICO WhatsApp Business API');
console.log('='.repeat(60));
console.log('');

// ============================================
// 1. CHECK ENVIRONMENT VARIABLES
// ============================================
console.log('📋 1. Variables de entorno:');
console.log(`   PHONE_NUMBER_ID: ${PHONE_NUMBER_ID ? '✅ ' + PHONE_NUMBER_ID : '❌ NO CONFIGURADA'}`);
console.log(`   META_ACCESS_TOKEN: ${ACCESS_TOKEN ? '✅ (' + ACCESS_TOKEN.substring(0, 15) + '...)' : '❌ NO CONFIGURADA'}`);
console.log(`   WABA_ID: ${WABA_ID ? '✅ ' + WABA_ID : '❌ NO CONFIGURADA'}`);
console.log(`   API_VERSION: ${API_VERSION}`);
console.log(`   META_APP_ID: ${APP_ID ? '✅ ' + APP_ID : '⚠️  No configurada (se obtiene dinámicamente)'}`);
console.log('');

if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.error('❌ DIAGNÓSTICO FALLIDO: Variables críticas no encontradas.');
    console.log('   → Verifica que tu archivo .env esté en la raíz del proyecto');
    console.log('   → Verifica que las variables estén configuradas en Vercel');
    process.exit(1);
}

// ============================================
// 2. VALIDATE TOKEN
// ============================================
console.log('🔑 2. Validando Access Token...');
try {
    const tokenRes = await fetch(`https://graph.facebook.com/${API_VERSION}/debug_token?input_token=${ACCESS_TOKEN}`, {
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
        console.log(`   ❌ ERROR al validar token: ${tokenData.error.message}`);
        console.log('   → Tu token probablemente expiró o fue revocado.');
        console.log('   → Solución: Genera un nuevo token en Meta Business Suite.');
        console.log('');
    } else if (tokenData.data) {
        const d = tokenData.data;
        console.log(`   App ID: ${d.app_id || 'N/A'}`);
        console.log(`   Tipo: ${d.type || 'N/A'}`);
        console.log(`   Válido: ${d.is_valid ? '✅ SÍ' : '❌ NO'}`);
        
        if (d.expires_at) {
            const expiryDate = new Date(d.expires_at * 1000);
            const now = new Date();
            if (d.expires_at === 0) {
                console.log(`   Expiración: ✅ NUNCA (Token permanente)`);
            } else if (expiryDate > now) {
                console.log(`   Expiración: ⚠️  ${expiryDate.toISOString()} (en ${Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24))} días)`);
            } else {
                console.log(`   Expiración: ❌ EXPIRADO el ${expiryDate.toISOString()}`);
                console.log('   → ¡ESTE ES TU PROBLEMA! El token expiró.');
            }
        } else {
            console.log(`   Expiración: ✅ Sin fecha de expiración (permanente)`);
        }
        
        if (d.scopes) {
            console.log(`   Permisos: ${d.scopes.join(', ')}`);
            const requiredScopes = ['whatsapp_business_messaging', 'whatsapp_business_management'];
            for (const scope of requiredScopes) {
                if (!d.scopes.includes(scope)) {
                    console.log(`   ⚠️  Falta permiso: ${scope}`);
                }
            }
        }
        
        if (!d.is_valid) {
            console.log('');
            console.log('   🔧 TOKEN INVÁLIDO - Posibles causas:');
            console.log('      1. El token fue revocado manualmente');
            console.log('      2. La app fue desactivada en Meta');
            console.log('      3. Se cambió la contraseña del System User');
            console.log('      4. Meta invalidó el token por seguridad');
        }
    }
} catch (err) {
    console.log(`   ❌ Error de conexión: ${err.message}`);
}
console.log('');

// ============================================
// 3. CHECK PHONE NUMBER
// ============================================
console.log('📱 3. Verificando Número de Teléfono...');
try {
    const phoneRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}`, {
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    const phoneData = await phoneRes.json();

    if (phoneData.error) {
        console.log(`   ❌ ERROR: ${phoneData.error.message}`);
        console.log(`   → Code: ${phoneData.error.code}, Subcode: ${phoneData.error.error_subcode || 'N/A'}`);
        
        if (phoneData.error.code === 190) {
            console.log('   → 💡 Code 190 = TOKEN EXPIRADO O INVÁLIDO');
            console.log('   → Debes generar un nuevo token en Meta Business Suite');
        }
    } else {
        console.log(`   Número: ${phoneData.display_phone_number || 'N/A'}`);
        console.log(`   Estado: ${phoneData.quality_rating || 'N/A'}`);
        console.log(`   Nombre verificado: ${phoneData.verified_name || 'N/A'}`);
        console.log(`   Status: ✅ Activo`);
    }
} catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
}
console.log('');

// ============================================
// 4. CHECK WABA & TEMPLATES
// ============================================
if (WABA_ID) {
    console.log('📝 4. Verificando Templates de WhatsApp...');
    try {
        const templatesRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${WABA_ID}/message_templates?limit=10`, {
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
        });
        const templatesData = await templatesRes.json();

        if (templatesData.error) {
            console.log(`   ❌ ERROR: ${templatesData.error.message}`);
        } else if (templatesData.data) {
            console.log(`   Templates encontrados: ${templatesData.data.length}`);
            for (const t of templatesData.data) {
                const statusIcon = t.status === 'APPROVED' ? '✅' : t.status === 'REJECTED' ? '❌' : '⏳';
                console.log(`   ${statusIcon} ${t.name} (${t.status}) - ${t.language}`);
            }
        }
    } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
    }
} else {
    console.log('📝 4. Templates: ⚠️  WABA_ID no configurado, no se pueden verificar templates');
}
console.log('');

// ============================================
// 5. CHECK MESSAGING CAPABILITY  
// ============================================
console.log('📤 5. Verificando capacidad de envío...');
try {
    const msgLimitRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${WABA_ID}?fields=message_template_namespace,account_review_status`, {
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    const msgLimitData = await msgLimitRes.json();

    if (msgLimitData.error) {
        console.log(`   ❌ ERROR: ${msgLimitData.error.message}`);
    } else {
        console.log(`   Template Namespace: ${msgLimitData.message_template_namespace || 'N/A'}`);
        console.log(`   Estado de cuenta: ${msgLimitData.account_review_status || 'N/A'}`);
        
        if (msgLimitData.account_review_status === 'APPROVED') {
            console.log('   ✅ Cuenta aprobada para envío de mensajes');
        } else {
            console.log('   ⚠️  Estado de cuenta no es APPROVED, esto puede bloquear envíos');
        }
    }
} catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
}
console.log('');

// ============================================
// SUMMARY
// ============================================
console.log('='.repeat(60));
console.log('📊 RESUMEN DE DIAGNÓSTICO');
console.log('='.repeat(60));
console.log('');
console.log('Si el token está EXPIRADO o INVÁLIDO, sigue estos pasos:');
console.log('');
console.log('1. Ve a https://business.facebook.com/settings/system-users');
console.log('2. Selecciona tu System User');
console.log('3. Clic en "Generar token nuevo"');
console.log('4. Selecciona tu App');
console.log('5. Elige expiración: "Nunca"');
console.log('6. Permisos: whatsapp_business_messaging, whatsapp_business_management');
console.log('7. Copia el token y actualízalo en:');
console.log('   - Archivo .env local: META_ACCESS_TOKEN=tu_nuevo_token');
console.log('   - Vercel: Settings → Environment Variables → META_ACCESS_TOKEN');
console.log('8. Re-deploy en Vercel después de actualizar');
console.log('');
