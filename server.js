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

// --- 1. CONFIGURACIÓN DE IMÁGENES (Multer) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'publico/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// --- 2. CONEXIÓN A MONGODB ---
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.error('Error al conectar:', err));

// --- 3. MODELOS DE BASE DE DATOS ---
const User = mongoose.model('User', new mongoose.Schema({
    nombre: String,
    correo: { type: String, unique: true },
    password: String,
    rol: { type: String, default: 'usuario' } // 'usuario' o 'admin'
}));

const Bitacora = mongoose.model('Bitacora', new mongoose.Schema({
    tipoPlanta: String,
    altura: Number,
    anchura: Number,
    tipoAbono: String,
    sistemaRiego: String,
    observaciones: String,
    autor: String,
    fecha: { type: Date, default: Date.now }
}));

const ConfigSite = mongoose.model('Config', new mongoose.Schema({
    mostrarGaleria: { type: Boolean, default: true },
    mostrarObservaciones: { type: Boolean, default: true }
}));

// --- 4. RUTAS DE LA API (Endpoints) ---

// Registro de Usuario
app.post('/api/registro', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const newUser = new User({
            nombre: req.body.nombre,
            correo: req.body.correo,
            password: hashedPassword,
            rol: req.body.rol || 'usuario'
        });
        await newUser.save();
        res.status(201).json({ mensaje: 'Usuario registrado con éxito' });
    } catch (error) {
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

// Login y Autenticación
app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ correo: req.body.correo });
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Contraseña incorrecta' });

    // Creamos un "pase de entrada" (token)
    const token = jwt.sign({ id: user._id, rol: user.rol, nombre: user.nombre }, 'secreto_super_seguro');
    res.json({ token, rol: user.rol });
});

// Registrar un cambio en el huerto (Bitácora)
app.post('/api/bitacora', async (req, res) => {
    const nuevaEntrada = new Bitacora(req.body);
    await nuevaEntrada.save();
    res.json({ mensaje: 'Registro guardado en el huerto' });
});

// Administrador: Subir Imagen
app.post('/api/upload', upload.single('imagen'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió imagen' });
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));