const parseIcal = (texto) => {
    const eventos = [];
    const blocos = texto.split("BEGIN:VEVENT");
    for (let i = 1; i < blocos.length; i++) {
        const start = blocos[i].match(/DTSTART.*:(\d{4})(\d{2})(\d{2})/);
        const end = blocos[i].match(/DTEND.*:(\d{4})(\d{2})(\d{2})/);
        if (start && end) {
            eventos.push({
                checkin: `${start[1]}-${start[2]}-${start[3]}`,
                checkout: `${end[1]}-${end[2]}-${end[3]}`
            });
        }
    }
    return eventos;
};

const verificaConflito = (checkinDesejado, checkoutDesejado, reservasIcal) => {
    const startReq = new Date(checkinDesejado).getTime();
    const endReq = new Date(checkoutDesejado).getTime();

    return reservasIcal.some(reserva => {
        const startBloq = new Date(reserva.checkin).getTime();
        const endBloq = new Date(reserva.checkout).getTime();
        return (startReq < endBloq && endReq > startBloq);
    });
};

module.exports = async function (req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { ical_url, checkin, checkout } = req.query;

    if (!ical_url || !checkin || !checkout) {
        return res.status(400).json({ erro: "Parâmetros incompletos" });
    }

    try {
        const response = await fetch(ical_url);
        if (!response.ok) throw new Error("Falha ao ler Airbnb");
        
        const icalData = await response.text();
        const reservasAtuais = parseIcal(icalData);
        const temConflito = verificaConflito(checkin, checkout, reservasAtuais);

        if (temConflito) {
            return res.status(409).json({ 
                disponivel: false, 
                mensagem: "Data indisponível. Alguém acabou de reservar." 
            });
        }

        return res.status(200).json({ disponivel: true });
    } catch (error) {
        console.error("Live Check falhou:", error.message);
        return res.status(200).json({ disponivel: true, aviso: "Bypass por falha no iCal" });
    }
};
