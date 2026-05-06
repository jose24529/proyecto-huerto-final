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

// --- MULTER PARA FOTOS ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'publico/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// --- CONEXIÓN MONGODB ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Base de datos lista'))
    .catch(err => console.error('❌ Error DB:', err));

// --- MODELOS ---
const User = mongoose.model('User', new mongoose.Schema({
    nombre: String, correo: { type: String, unique: true }, password: String, rol: { type: String, default: 'usuario' }
}));

const Bitacora = mongoose.model('Bitacora', new mongoose.Schema({
    tipoPlanta: String, altura: Number, abono: String, observaciones: String, imagenUrl: String, fecha: { type: Date, default: Date.now }
}));

// --- RUTAS API ---

// 1. Registro
app.post('/api/registro', async (req, res) => {
    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash(req.body.password, salt);
    const nuevo = new User({...req.body, password: passHash});
    await nuevo.save();
    res.json({ mensaje: "Usuario creado" });
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

// 4. Guardar Bitácora (Admin)
app.post('/api/bitacora', upload.single('imagen'), async (req, res) => {
    const datos = {...req.body, imagenUrl: req.file ? '/uploads/' + req.file.filename : ''};
    await Bitacora.create(datos);
    res.json({ mensaje: "Ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));