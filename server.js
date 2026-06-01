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
    imagenUrl: String, 
    fecha: { type: Date, default: Date.now },
    likes: { type: Number, default: 0 }, // 🌟 CAMBIO: Soporte para almacenar los "Me gusta"
    comentarios: [{
        usuario: String,
        texto: String,
        fecha: { type: Date, default: Date.now }
    }]
}));

// --- RUTAS API ---

// 1. Registro
app.post('/api/registro', async (req, res) => {
    try {
        const { nombre, correo, password, rol } = req.body;
        const passwordHash = await bcrypt.hash(password, 10);
        const nuevo = await User.create({ nombre, correo, password: passwordHash, rol });
        res.json(nuevo);
    } catch (e) {
        res.status(400).json({ error: "El correo ya existe" });
    }
});

// 2. Login
app.post('/api/login', async (req, res) => {
    const { correo, password } = req.body;
    const user = await User.findOne({ correo });
    if (!user) return res.status(400).json({ error: "No existe el usuario" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user._id, rol: user.rol }, 'SECRETO_SUPER_SEGURO');
    res.json({ token, rol: user.rol });
});

// 3. Obtener Bitácora
app.get('/api/bitacora', async (req, res) => {
    const lista = await Bitacora.find().sort({ fecha: -1 });
    res.json(lista);
});

// 4. Guardar Bitácora (Admin)
app.post('/api/bitacora', upload.single('imagen'), async (req, res) => {
    try {
        let imagenBase64 = '';
        if (req.file) {
            imagenBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const nuevaEntrada = {
            tipoPlanta: req.body.tipoPlanta,
            altura: req.body.altura,
            abono: req.body.abono,
            observaciones: req.body.observaciones,
            imagenUrl: imagenBase64
        };
        
        await Bitacora.create(nuevaEntrada);
        res.json({ mensaje: "Guardado con éxito" });
    } catch (error) {
        console.error("Error al guardar:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// ❤️ NUEVA RUTA: Incrementar "Me gusta" ❤️
app.post('/api/bitacora/:id/like', async (req, res) => {
    try {
        const post = await Bitacora.findByIdAndUpdate(
            req.params.id,
            { $inc: { likes: 1 } },
            { new: true }
        );
        res.json({ likes: post.likes });
    } catch (error) {
        res.status(500).json({ error: "Error al dar like" });
    }
});

// 5. Publicar Comentario
app.post('/api/bitacora/:id/comentarios', async (req, res) => {
    try {
        const post = await Bitacora.findById(req.params.id);
        post.comentarios.push({
            usuario: req.body.usuario,
            texto: req.body.texto
        });
        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: "Error al comentar" });
    }
});

// 6. Eliminar Comentario
app.post('/api/bitacora/:idPost/comentarios/:idComentario/borrar', async (req, res) => {
    try {
        const post = await Bitacora.findById(req.params.idPost);
        post.comentarios = post.comentarios.filter(c => c._id.toString() !== req.params.idComentario);
        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: "Error al borrar" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));