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
// 1. CONFIGURACIÓN DE IMÁGENES (Multer)
// ==============================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'publico/uploads/') 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

// ==============================================
// 2. CONEXIÓN A MONGODB
// ==============================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.error('Error al conectar:', err));

// ==============================================
// 3. MODELOS DE BASE DE DATOS
// ==============================================
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
    autor: String,
    imagenUrl: String, // ¡Agregamos esto para que la base de datos acepte la foto!
    fecha: { type: Date, default: Date.now }
}));

const ConfigSite = mongoose.model('Config', new mongoose.Schema({
    mostrarGaleria: { type: Boolean, default: true },
    mostrarObservaciones: { type: Boolean, default: true }
}));

// ==============================================
// 4. RUTAS DE LA API (Endpoints)
// ==============================================

// Guardar la bitácora con foto
app.post('/api/bitacora', upload.single('imagen'), async (req, res) => {
    try {
        const nuevaActividad = {
            tipoPlanta: req.body.tipoPlanta,
            altura: req.body.altura,
            anchura: req.body.anchura,
            abono: req.body.abono,
            riego: req.body.riego,
            observaciones: req.body.observaciones,
            imagenUrl: req.file ? '/uploads/' + req.file.filename : ''
        };

        await Bitacora.create(nuevaActividad); 

        res.status(200).json({ mensaje: "¡Guardado con éxito!" });
    } catch (error) {
        console.error("Error al guardar la bitácora:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// Login y Autenticación
app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ correo: req.body.correo });
    if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: user._id, rol: user.rol, nombre: user.nombre }, 'secreto_super_seguro');
    res.json({ token, rol: user.rol });
});

// Administrador: Subir solo imagen (Galería)
app.post('/api/upload', upload.single('imagen'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió imagen' });
    res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));