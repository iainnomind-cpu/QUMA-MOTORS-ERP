export default function handler(req, res) {
  
  // VERIFICACIÓN GET - Cuando Meta configura el webhook
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'quma_whatsapp_verify_2024_secret';
    
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verificado correctamente');
      return res.status(200).send(challenge);
    } else {
      console.log('❌ Token incorrecto');
      return res.status(403).send('Forbidden');
    }
  }
  
  // RECIBIR EVENTOS POST - Cuando llegan mensajes
  if (req.method === 'POST') {
    const body = req.body;
    
    console.log('📩 Evento WhatsApp recibido:', JSON.stringify(body, null, 2));
    
    // Responder OK inmediatamente
    res.status(200).send('EVENT_RECEIVED');
    
    // Aquí procesarás los eventos después
    // Por ahora solo se registran en logs
    
    return;
  }
  
  res.status(405).send('Method Not Allowed');
}