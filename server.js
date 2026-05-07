const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'publico')));

// ==============================================
// NUEVA CONFIGURACIÓN DE IMÁGENES (Memoria RAM)
// En lugar de guardarlas en una carpeta, las atrapamos en memoria
// ==============================================
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- CONEXIÓN MONGODB ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Base de datos lista'))
    .catch(err => console.error('❌ Error DB:', err));

// --- MODELOS ---
const User = mongoose.model('User', new mongoose.Schema({
    nombre: String, 
    correo: { type: String, unique: true }, 
    password: String, 
    rol: { type: String, default: 'usuario' }
}));

const Bitacora = mongoose.model('Bitacora', new mongoose.Schema({
    tipoPlanta: String, 
    altura: Number, 
    abono: String, 
    observaciones: String, 
    imagenUrl: String, // Aquí ahora se guardará la imagen convertida a texto
    fecha: { type: Date, default: Date.now }
}));

// --- RUTAS API ---

// 1. Registro
app.post('/api/registro', async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const passHash = await bcrypt.hash(req.body.password, salt);
        const nuevo = new User({...req.body, password: passHash});
        await nuevo.save();
        res.json({ mensaje: "Usuario creado" });
    } catch (e) { res.status(500).json({error: e.message}); }
});

// 2. Login
app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ correo: req.body.correo });
    if (!user) return res.status(400).json({ error: 'No existe' });
    const ok = await bcrypt.compare(req.body.password, user.password);
    if (!ok) return res.status(400).json({ error: 'Password mal' });

    const token = jwt.sign({ id: user._id, rol: user.rol }, 'secreto_super_seguro');
    res.json({ token, rol: user.rol });
});

// 3. Ver Bitácora (Público/Maestros)
app.get('/api/bitacora', async (req, res) => {
    const lista = await Bitacora.find().sort({ fecha: -1 });
    res.json(lista);
});

// 4. Guardar Bitácora (Admin) - ¡MAGIA BASE64 AQUÍ!
app.post('/api/bitacora', upload.single('imagen'), async (req, res) => {
    try {
        let imagenBase64 = '';
        
        // Si subieron una imagen, la convertimos a formato de texto (Base64)
        if (req.file) {
            imagenBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const nuevaEntrada = {
            tipoPlanta: req.body.tipoPlanta,
            altura: req.body.altura,
            abono: req.body.abono,
            observaciones: req.body.observaciones,
            imagenUrl: imagenBase64 // La imagen ahora se guarda directo en MongoDB
        };
        
        await Bitacora.create(nuevaEntrada);
        res.json({ mensaje: "Guardado con éxito" });
    } catch (error) {
        console.error("Error al guardar:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// 5. Ruta para admin (Subida individual a galería)
app.post('/api/upload', upload.single('imagen'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió imagen' });
    const imagenBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    res.json({ imageUrl: imagenBase64 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));