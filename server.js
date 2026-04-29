require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
// Usa el puerto que le dé el servidor en la nube, o el 3000 si estás en tu compu
const port = process.env.PORT || 3000;
const uri = process.env.MONGO_URI;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/mensaje', async (req, res) => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('escuela');
        const collection = database.collection('bitacora');

        const documento = await collection.findOne({ fecha: "2026-04-21" });
        res.json(documento);
    } catch (error) {
        console.error("Error en la API:", error);
        res.status(500).json({ error: "Error de conexión a la base de datos" });
    } finally {
        await client.close();
    }
});

app.listen(port, () => {
    console.log(`Servidor iniciado en el puerto ${port}`);
});