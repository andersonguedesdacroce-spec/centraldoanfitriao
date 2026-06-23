const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        })
    });
}
const db = admin.firestore();
const formatIcalDate = (dateObj) => dateObj.toISOString().replace(/[-:]/g, '').split('T')[0];

module.exports = async function (req, res) {
    const { id_imovel } = req.query;
    if (!id_imovel) return res.status(400).send("ID do imóvel obrigatório.");

    try {
        const reservasSnapshot = await db.collection("Reserva").where("id_imovel", "==", id_imovel).get();
        const icsContent = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CentralAnfitriao//SaaS v1.0//PT-BR',
            'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'
        ];

        reservasSnapshot.forEach(doc => {
            const r = doc.data();
            if (r.status === "bloqueado_airbnb") return; 
            
            const dtStart = r.data_checkin.replace(/-/g, '');
            const dtEnd = r.data_checkout.replace(/-/g, '');

            icsContent.push(
                'BEGIN:VEVENT', `UID:res_saas_${doc.id}@seudominio.com`,
                `DTSTAMP:${formatIcalDate(new Date())}T000000Z`,
                `DTSTART;VALUE=DATE:${dtStart}`, `DTEND;VALUE=DATE:${dtEnd}`,
                `SUMMARY:Reserva Site Direto`, 'END:VEVENT'
            );
        });
        icsContent.push('END:VCALENDAR');

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="cal_${id_imovel}.ics"`);
        res.status(200).send(icsContent.join('\r\n'));
    } catch (error) {
        res.status(500).send("Erro interno ao gerar iCal: " + error.message);
    }
};
