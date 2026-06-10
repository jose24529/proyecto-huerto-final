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

// --- 📸 CONFIGURACIÓN DE MULTER OPTIMIZADA PARA TODO TIPO DE ARCHIVOS ---
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 20 * 1024 * 1024 // Soporta hasta 20 Megabytes para fotos pesadas de celulares
    },
    fileFilter: (req, file, cb) => {
        // Permisivo con formatos multimedia clasificados como imágenes (png, heic, webp, jpg)
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(null, true); 
        }
    }
});

const JWT_SECRET = 'SECRETO_SUPER_SEGURO';

// --- CONEXIÓN MONGODB ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Base de datos lista y conectada'))
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
    dueno: String, 
    altura: Number, 
    abono: String, 
    observaciones: String, 
    imagenUrl: String, 
    fecha: { type: Date, default: Date.now },
    likes: { type: Number, default: 0 }, 
    comentarios: [{
        usuario: String,
        texto: String,
        fecha: { type: Date, default: Date.now }
    }]
}));

// --- 🛠️ MIDDLEWARE DE VALIDACIÓN CORREGIDO (Permite borrar con cuenta simulada y real) ---
function verificarAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Acceso denegado. No hay token." });

    // 🌟 ARREGLO CLAVE: Si estás usando el acceso rápido de pruebas del huertito, te deja pasar a Borrar/Editar directo
    if (token === 'TOKEN_DEMO_HUERTITO') {
        req.usuario = { rol: 'admin', id: 'mock_admin_id' };
        return next();
    }

    // Validación convencional estricta para cuentas reales creadas en MongoDB
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token inválido o expirado." });
        if (decoded.rol !== 'admin') return res.status(403).json({ error: "Acceso denegado. Se requiere rol de Admin." });
        
        req.usuario = decoded;
        next();
    });
}

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

    const token = jwt.sign({ id: user._id, rol: user.rol }, JWT_SECRET);
    res.json({ token, rol: user.rol });
});

// 3. Obtener Bitácora
app.get('/api/bitacora', async (req, res) => {
    try {
        const lista = await Bitacora.find().sort({ fecha: -1 });
        res.json(lista);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener registros" });
    }
});

// 4. Guardar Bitácora (PÚBLICO - Permite aportes fluidos de alumnos y colaboradores)
app.post('/api/bitacora', upload.single('imagen'), async (req, res) => {
    try {
        let imagenBase64 = '';
        if (req.file) {
            imagenBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        } else {
            imagenBase64 = "https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?q=80&w=500";
        }

        const nuevaEntrada = {
            tipoPlanta: req.body.tipoPlanta,
            dueno: req.body.dueno || "Anónimo", 
            altura: Number(req.body.altura) || 0,
            abono: req.body.abono || "Ninguno",
            observaciones: req.body.observaciones,
            imagenUrl: imagenBase64
        };
        
        await Bitacora.create(nuevaEntrada);
        res.json({ mensaje: "Guardado con éxito" });
    } catch (error) {
        console.error("Error al guardar:", error);
        res.status(500).json({ error: "Error en el servidor al intentar guardar" });
    }
});

// 5. Modificar una Publicación (Protegido por el candado corregido)
app.put('/api/bitacora/:id', verificarAdmin, async (req, res) => {
    try {
        const { tipoPlanta, dueno, altura, abono, observaciones } = req.body;
        
        const registroActualizado = await Bitacora.findByIdAndUpdate(
            req.params.id,
            { tipoPlanta, dueno, altura, abono, observaciones },
            { new: true }
        );

        if (!registroActualizado) {
            return res.status(404).json({ error: "No se encontró la publicación." });
        }

        res.json({ mensaje: "¡Publicación modificada con éxito!", registroActualizado });
    } catch (error) {
        console.error("Error al modificar publicación:", error);
        res.status(500).json({ error: "Error interno al intentar editar." });
    }
});

// 6. Eliminar entrada completa (Protegido por el candado corregido)
app.delete('/api/bitacora/:id', verificarAdmin, async (req, res) => {
    try {
        const eliminado = await Bitacora.findByIdAndDelete(req.params.id);
        if (!eliminado) return res.status(404).json({ error: "No se encontró la publicación." });
        res.json({ mensaje: "Publicación eliminada correctamente." });
    } catch (error) {
        console.error("Error al borrar publicación:", error);
        res.status(500).json({ error: "Error al borrar publicación" });
    }
});

// 7. Incrementar "Me gusta" (Público)
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

// 8. Publicar Comentario (Público)
app.post('/api/bitacora/:id/comentarios', async (req, res) => {
    try {
        const post = await Bitacora.findById(req.params.id);
        post.comentarios.push({
            usuario: req.body.usuario || "Colaborador",
            texto: req.body.texto
        });
        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: "Error al comentar" });
    }
});

// 9. Eliminar Comentario (Público/Admin)
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

// --- 🚀 INICIO ENLACE ADAPTATIVO PARA RENDER ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor corriendo globalmente en el puerto: ${PORT}`);
});