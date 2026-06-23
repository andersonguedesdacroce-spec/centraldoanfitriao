const admin = require('firebase-admin');

module.exports = async function (req, res) {
    try {
        // Tenta fazer o login com as variáveis da Vercel
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
                })
            });
        }
        res.status(200).send("🔥 SUCESSO! O Firebase conectou. Suas chaves estão perfeitas.");
    } catch (error) {
        res.status(500).send("❌ ERRO NAS CHAVES: " + error.message);
    }
};
