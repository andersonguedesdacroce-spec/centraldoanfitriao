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

function parseIcal(texto) {
    const eventos = [];
    const blocos = texto.split("BEGIN:VEVENT");
    for (let i = 1; i < blocos.length; i++) {
        const start = blocos[i].match(/DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/);
        const end = blocos[i].match(/DTEND;VALUE=DATE:(\d{4})(\d{2})(\d{2})/);
        if (start && end) eventos.push({
            checkin: `${start[1]}-${start[2]}-${start[3]}`,
            checkout: `${end[1]}-${end[2]}-${end[3]}`
        });
    }
    return eventos;
}

module.exports = async function (req, res) {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).end('Unauthorized');
    }

    try {
        const imoveisSnap = await db.collection("Imoveis").where("ical_url", ">", "").get();
        if (imoveisSnap.empty) return res.status(200).send("Sem imóveis com iCal");

        for (const doc of imoveisSnap.docs) {
            const { ical_url, titulo } = doc.data();
            const response = await fetch(ical_url);
            const icalData = await response.text();
            const reservas = parseIcal(icalData);

            const batchDel = db.batch();
            const antigas = await db.collection("Reserva").where("id_imovel", "==", doc.id).where("status", "==", "bloqueado_airbnb").get();
            antigas.forEach(d => batchDel.delete(d.ref));
            await batchDel.commit();

            if (reservas.length > 0) {
                const batchIns = db.batch();
                reservas.forEach(r => {
                    const newRef = db.collection("Reserva").doc();
                    batchIns.set(newRef, {
                        id_imovel: doc.id,
                        titulo_imovel: `${titulo} (Airbnb)`,
                        data_checkin: r.checkin, data_checkout: r.checkout,
                        status: "bloqueado_airbnb",
                        criado_em: admin.firestore.FieldValue.serverTimestamp()
                    });
                });
                await batchIns.commit();
            }
        }
        res.status(200).send("Sincronizado");
    } catch (e) {
        res.status(500).send(e.message);
    }
};
