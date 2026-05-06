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

// --- 1. CONFIGURACIÓN DE MULTER ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'publico/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// --- 2. CONEXIÓN A MONGODB ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.error('Error:', err));

// --- 3. MODELOS ---
const User = mongoose.model('User', new mongoose.Schema({
    nombre: String,
    correo: { type: String, unique: true },
    password: String,
    rol: { type: String, default: 'usuario' } 
}));

const Bitacora = mongoose.model('Bitacora', new mongoose.Schema({
    tipoPlanta: String,
    altura: Number,
    anchura: Number,
    abono: String,
    riego: String,
    observaciones: String,
    imagenUrl: String,
    fecha: { type: Date, default: Date.now }
}));

// --- 4. RUTAS (API) ---

// Registro de usuarios
app.post('/api/registro', async (req, res) => {
    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash(req.body.password, salt);
    const nuevo = new User({...req.body, password: passHash});
    await nuevo.save();
    res.json({ mensaje: "Usuario creado" });
});

// Login
app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ correo: req.body.correo });
    if (!user) return res.status(400).json({ error: 'No existe' });
    const esValido = await bcrypt.compare(req.body.password, user.password);
    if (!esValido) return res.status(400).json({ error: 'Pass incorrecto' });

    const token = jwt.sign({ id: user._id, rol: user.rol }, 'secreto_super_seguro');
    res.json({ token, rol: user.rol }); // Enviamos el rol al cliente
});

// Guardar bitácora
app.post('/api/bitacora', upload.single('imagen'), async (req, res) => {
    try {
        const datos = {...req.body, imagenUrl: req.file ? '/uploads/'+req.file.filename : ''};
        await Bitacora.create(datos);
        res.json({ mensaje: "Guardado" });
    } catch (e) { res.status(500).send(e); }
});

// Subida directa (Admin)
app.post('/api/upload', upload.single('imagen'), (req, res) => {
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Puerto ${PORT}`));