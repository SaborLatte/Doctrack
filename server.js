const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Conexión a la base de datos usando variables de entorno
const db = mysql.createConnection({
    host: process.env.DB_HOST,     // Usar la variable de entorno DB_HOST
    user: process.env.DB_USER,     // Usar la variable de entorno DB_USER
    password: process.env.DB_PASSWORD, // Usar la variable de entorno DB_PASSWORD
    database: process.env.DB_NAME,   // Usar la variable de entorno DB_NAME
    port: process.env.DB_PORT || 3306, // Asegúrate de que el puerto sea 3306 si no está definido
});

db.connect((err) => {
    if (err) {
        console.error("Error al conectar a la base de datos:", err);
    } else {
        console.log("Conexión exitosa a la base de datos.");
    }
});

// Ruta para verificar si un correo ya existe
app.post("/check-correo", (req, res) => {
    const { correo } = req.body;

    if (!correo) {
        return res.status(400).send("El correo es obligatorio.");
    }

    const query = `
        SELECT correo FROM Paciente WHERE correo = ?
        UNION
        SELECT correo FROM Doctor WHERE correo = ?
    `;
    db.query(query, [correo, correo], (err, results) => {
        if (err) {
            console.error("Error al verificar el correo:", err);
            return res.status(500).send("Error al verificar el correo.");
        }

        res.status(200).json({ exists: results.length > 0 });
    });
});

// Ruta para registrar pacientes
app.post("/register-paciente", (req, res) => {
    const { CURP, nombre, ap_paterno, ap_materno, fecha_nacimiento, telefono, correo, contrasena } = req.body;

    if (!CURP || !nombre || !ap_paterno || !ap_materno || !fecha_nacimiento || !telefono || !correo || !contrasena) {
        return res.status(400).send("Todos los campos son obligatorios.");
    }

    const hashedPassword = bcrypt.hashSync(contrasena, 10);
    const query = `
        INSERT INTO Paciente (CURP, nombre, ap_paterno, ap_materno, fecha_nacimiento, telefono, correo, contraseña) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(query, [CURP, nombre, ap_paterno, ap_materno, fecha_nacimiento, telefono, correo, hashedPassword], (err, result) => {
        if (err) {
            console.error("Error al registrar el paciente:", err);
            return res.status(500).send("Error al registrar el paciente.");
        }

        res.status(200).send("Paciente registrado con éxito.");
    });
});

// Ruta para registrar doctores
app.post("/registro-doctor", (req, res) => {
    const { nombre, ap_paterno, ap_materno, especialidad, correo, contrasena } = req.body;

    if (!nombre || !ap_paterno || !ap_materno || !especialidad || !correo || !contrasena) {
        return res.status(400).send("Todos los campos son obligatorios.");
    }

    const hashedPassword = bcrypt.hashSync(contrasena, 10); // Encripta la contraseña
    const query = `
        INSERT INTO Doctor (nombre, ap_paterno, ap_materno, especialidad, correo, contraseña) 
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.query(query, [nombre, ap_paterno, ap_materno, especialidad, correo, hashedPassword], (err, result) => {
        if (err) {
            console.error("Error al registrar el doctor:", err);
            return res.status(500).send("Error al registrar el doctor.");
        }

        res.status(200).send("Doctor registrado con éxito.");
    });
});

// Ruta para obtener todos los pacientes
app.get("/obtener-pacientes", (req, res) => {
    const query = `
        SELECT id_paciente, 
               CONCAT(nombre, ' ', ap_paterno, ' ', ap_materno) AS nombre_completo 
        FROM Paciente`;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Error al obtener los pacientes:", err);
            return res.status(500).send("Error al obtener los pacientes.");
        }

        res.status(200).json(results);
    });
});


// Ruta para inicio de sesión
app.post("/login", (req, res) => {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        return res.status(400).send("Por favor, proporciona correo y contraseña.");
    }

    const pacienteQuery = "SELECT * FROM Paciente WHERE correo = ?";
    db.query(pacienteQuery, [correo], (err, pacienteResults) => {
        if (err) {
            console.error("Error al buscar en Paciente:", err);
            return res.status(500).send("Error del servidor.");
        }

        if (pacienteResults.length > 0) {
            const validPassword = bcrypt.compareSync(contrasena, pacienteResults[0].contraseña);
            if (validPassword) {
                return res.status(200).json({ type: "paciente" });
            } else {
                return res.status(401).send("Credenciales incorrectas.");
            }
        }

        const doctorQuery = "SELECT * FROM Doctor WHERE correo = ?";
        db.query(doctorQuery, [correo], (err, doctorResults) => {
            if (err) {
                console.error("Error al buscar en Doctor:", err);
                return res.status(500).send("Error del servidor.");
            }

            if (doctorResults.length > 0) {
                const validPassword = bcrypt.compareSync(contrasena, doctorResults[0].contraseña);
                if (validPassword) {
                    return res.status(200).json({ type: "doctor", id_doctor: doctorResults[0].id_doctor });
                } else {
                    return res.status(401).send("Credenciales incorrectas.");
                }
            }

            return res.status(401).send("Credenciales incorrectas.");
        });
    });
});
app.get("/get-notas/:id_paciente", (req, res) => {
    const { id_paciente } = req.params;

    const query = `
        SELECT Nota 
        FROM Nota 
        WHERE id_paciente = ?`;

    db.query(query, [id_paciente], (err, results) => {
        if (err) {
            console.error("Error al obtener notas:", err);
            res.status(500).send("Error al obtener notas.");
        } else {
            res.status(200).json(results);
        }
    });
});
app.get("/get-citas-paciente/:id_paciente", (req, res) => {
    const { id_paciente } = req.params;

    const query = `
        SELECT 
            c.fecha, 
            c.hora, 
            c.motivo 
        FROM 
            Cita c
        INNER JOIN 
            Paciente_cita pc ON c.id_cita = pc.id_cita
        WHERE 
            pc.id_paciente = ?`;

    db.query(query, [id_paciente], (err, results) => {
        if (err) {
            console.error("Error al obtener citas:", err);
            res.status(500).send("Error al obtener citas.");
        } else {
            res.status(200).json(results);
        }
    });
});



// Ruta para guardar una nota
app.post("/guardar-nota", (req, res) => {
    const { id_paciente, id_doctor, nota } = req.body;

    if (!id_paciente || !id_doctor || !nota) {
        return res.status(400).send("Todos los campos son obligatorios.");
    }

    const query = `
        INSERT INTO Nota (id_paciente, id_doctor, Nota) 
        VALUES (?, ?, ?)    
        ON DUPLICATE KEY UPDATE Nota = VALUES(Nota)
    `;

    db.query(query, [id_paciente, id_doctor, nota], (err, result) => {
        if (err) {
            console.error("Error al guardar la nota:", err);
            return res.status(500).send("Error al guardar la nota.");
        }

        res.status(200).send("Nota guardada con éxito.");
    });
});
app.get("/get-medicos", (req, res) => {
    const query = "SELECT id_doctor, nombre, ap_paterno, ap_materno FROM Doctor";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error al obtener los médicos:", err);
            res.status(500).send("Error al obtener los médicos.");
        } else {
            res.status(200).json(results);
        }
    });
});

app.get("/get-notas/:id_doctor", (req, res) => {
    const { id_doctor } = req.params;

    const query = `
        SELECT Nota 
        FROM Nota 
        WHERE id_doctor = ?`;

    db.query(query, [id_doctor], (err, results) => {
        if (err) {
            console.error("Error al obtener las notas:", err);
            res.status(500).send("Error al obtener las notas.");
        } else {
            res.status(200).json(results);
        }
    });
});


// Ruta para obtener tratamientos en progreso
app.get('/tratamientos', (req, res) => {
    const query = `
        SELECT 
            p.nombre AS paciente, 
            t.medicamento AS tratamiento, 
            t.cantidad_hora AS duracion, 
            t.id_tratamiento AS id
        FROM 
            Paciente p
        JOIN 
            Paciente_tratamiento pt ON p.id_paciente = pt.id_paciente
        JOIN 
            Tratamiento t ON pt.id_tratamiento = t.id_tratamiento;
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener tratamientos:', err);
            res.status(500).send('Error al obtener tratamientos.');
        } else {
            res.status(200).json(results);
        }
    });
});

// Ruta para marcar un tratamiento como completado y moverlo a la tabla completados
app.post('/marcar-tratamiento-completado', (req, res) => {
    const { id_tratamiento } = req.body;

    if (!id_tratamiento) {
        return res.status(400).send('ID de tratamiento es obligatorio.');
    }

    // Mover tratamiento a tabla de completados
    const queryMoverCompletados = `
        INSERT INTO TratamientosCompletados (id_tratamiento, id_paciente, id_doctor, medicamento, cantidad_hora)
        SELECT pt.id_tratamiento, pt.id_paciente, dt.id_doctor, t.medicamento, t.cantidad_hora
        FROM Paciente_tratamiento pt
        JOIN Tratamiento t ON pt.id_tratamiento = t.id_tratamiento
        JOIN Doctor_tratamiento dt ON t.id_tratamiento = dt.id_tratamiento
        WHERE pt.id_tratamiento = ?;
    `;

    db.query(queryMoverCompletados, [id_tratamiento], (err) => {
        if (err) {
            console.error('Error al mover tratamiento a completados:', err);
            return res.status(500).send('Error al completar tratamiento.');
        }

        // Eliminar tratamiento de la tabla en progreso
        const queryEliminarProgreso = `DELETE FROM Paciente_tratamiento WHERE id_tratamiento = ?`;
        db.query(queryEliminarProgreso, [id_tratamiento], (err) => {
            if (err) {
                console.error('Error al eliminar tratamiento en progreso:', err);
                return res.status(500).send('Error al completar tratamiento.');
            }

            res.status(200).send('Tratamiento completado con éxito.');
        });
    });
});
// Ruta para eliminar una cita
app.post("/eliminar-cita", (req, res) => {
    const { id_doctor, nombre_paciente, fecha_cita, hora_cita } = req.body;

    if (!id_doctor || !nombre_paciente || !fecha_cita || !hora_cita) {
        return res.status(400).send("Todos los campos son obligatorios.");
    }

    // Dividir el nombre completo del paciente
    const [nombre, ap_paterno, ap_materno] = nombre_paciente.split(" ");

    const findPacienteQuery = `
        SELECT id_paciente FROM Paciente 
        WHERE nombre = ? AND ap_paterno = ? AND ap_materno = ?
    `;

    db.query(findPacienteQuery, [nombre, ap_paterno, ap_materno], (err, pacienteResults) => {
        if (err || pacienteResults.length === 0) {
            console.error("Error al buscar el paciente:", err || "Paciente no encontrado.");
            return res.status(404).send("Paciente no encontrado.");
        }

        const idPaciente = pacienteResults[0].id_paciente;

        const findCitaQuery = `
            SELECT id_cita FROM Cita 
            WHERE fecha = ? AND hora = ?
            AND id_cita IN (
                SELECT id_cita FROM Paciente_cita WHERE id_paciente = ?
            )
            AND id_cita IN (
                SELECT id_cita FROM Doctor_cita WHERE id_doctor = ?
            )
        `;

        db.query(findCitaQuery, [fecha_cita, hora_cita, idPaciente, id_doctor], (err, citaResults) => {
            if (err || citaResults.length === 0) {
                console.error("Error al buscar la cita:", err || "Cita no encontrada.");
                return res.status(404).send("Cita no encontrada.");
            }

            const idCita = citaResults[0].id_cita;

            // Eliminar las relaciones de la cita en dos consultas separadas
            const deletePacienteCitaQuery = `DELETE FROM Paciente_cita WHERE id_cita = ?`;
            db.query(deletePacienteCitaQuery, [idCita], (err) => {
                if (err) {
                    console.error("Error al eliminar relación Paciente_cita:", err);
                    return res.status(500).send("Error al eliminar relaciones de la cita.");
                }

                const deleteDoctorCitaQuery = `DELETE FROM Doctor_cita WHERE id_cita = ?`;
                db.query(deleteDoctorCitaQuery, [idCita], (err) => {
                    if (err) {   
                        console.error("Error al eliminar relación Doctor_cita:", err);
                        return res.status(500).send("Error al eliminar relaciones de la cita.");
                    }

                    // Finalmente, eliminar la cita
                    const deleteCitaQuery = "DELETE FROM Cita WHERE id_cita = ?";
                    db.query(deleteCitaQuery, [idCita], (err) => {
                        if (err) {
                            console.error("Error al eliminar la cita:", err);
                            return res.status(500).send("Error al eliminar la cita.");
                        }

                        res.status(200).send("Cita eliminada con éxito.");
                    });
                });
            });
        });
    });
});

// Ruta para modificar una cita
app.post("/modificar-cita", (req, res) => {
    const {
        id_doctor,
        id_paciente,
        fecha_actual,
        hora_actual,
        nueva_fecha,
        nueva_hora,
        nuevo_motivo,
    } = req.body;

    if (!id_doctor || !id_paciente || !fecha_actual || !hora_actual) {
        return res.status(400).send("ID del doctor, ID del paciente, fecha actual y hora actual son obligatorios.");
    }

    // Buscar la cita correspondiente
    const findCitaQuery = `
        SELECT id_cita FROM Cita 
        WHERE fecha = ? AND hora = ?
        AND id_cita IN (
            SELECT id_cita FROM Paciente_cita WHERE id_paciente = ?
        )
        AND id_cita IN (
            SELECT id_cita FROM Doctor_cita WHERE id_doctor = ?
        )
    `;

    db.query(findCitaQuery, [fecha_actual, hora_actual, id_paciente, id_doctor], (err, results) => {
        if (err || results.length === 0) {
            console.error("Error al buscar la cita:", err || "Cita no encontrada.");
            return res.status(404).send("Cita no encontrada.");
        }

        const idCita = results[0].id_cita;

        // Construir la consulta de actualización
        let updateQuery = "UPDATE Cita SET ";
        const queryParams = [];

        if (nueva_fecha) {
            updateQuery += "fecha = ?, ";
            queryParams.push(nueva_fecha);
        }

        if (nueva_hora) {
            updateQuery += "hora = ?, ";
            queryParams.push(nueva_hora);
        }

        if (nuevo_motivo) {
            updateQuery += "motivo = ?, ";
            queryParams.push(nuevo_motivo);
        }

        // Remover la última coma y espacio
        updateQuery = updateQuery.slice(0, -2);

        // Añadir condición para el ID de la cita
        updateQuery += " WHERE id_cita = ?";
        queryParams.push(idCita);

        db.query(updateQuery, queryParams, (err, result) => {
            if (err) {
                console.error("Error al modificar la cita:", err);
                return res.status(500).send("Error al modificar la cita.");
            }

            res.status(200).send("Cita modificada con éxito.");
        });
    });
});
// Ruta para crear una nueva cita y asociarla a un paciente
app.post("/create-cita", (req, res) => {
    const { fecha, hora, motivo, id_paciente } = req.body;

    if (!fecha || !hora || !motivo || !id_paciente) {
        return res.status(400).send("Todos los campos son obligatorios.");
    }

    // Insertar la cita
    const citaQuery = `INSERT INTO Cita (fecha, hora, motivo) VALUES (?, ?, ?)`;
    db.query(citaQuery, [fecha, hora, motivo], (err, result) => {
        if (err) {
            console.error("Error al guardar la cita:", err);
            return res.status(500).send("Error al guardar la cita.");
        }

        const id_cita = result.insertId;

        // Asociar la cita al paciente en la tabla Paciente_cita
        const pacienteCitaQuery = `INSERT INTO Paciente_cita (id_paciente, id_cita) VALUES (?, ?)`;
        db.query(pacienteCitaQuery, [id_paciente, id_cita], (err) => {
            if (err) {
                console.error("Error al asociar la cita con el paciente:", err);
                return res.status(500).send("Error al asociar la cita con el paciente.");
            }
            res.status(200).send("Cita guardada con éxito.");
        });
    });
});

app.get("/get-pacientes", (req, res) => {
    const query = "SELECT id_paciente, nombre, ap_paterno, ap_materno FROM Paciente";

    db.query(query, (err, results) => {
        if (err) {
            console.error("Error al obtener pacientes:", err);
            res.status(500).send("Error al obtener pacientes.");
        } else {
            res.status(200).json(results);
        }
    });
});
// Ruta para obtener las citas de un paciente seleccionado
app.get("/get-citas/:id_paciente", (req, res) => {
    const { id_paciente } = req.params;

    const query = `
        SELECT 
            CONCAT(p.nombre, ' ', p.ap_paterno, ' ', p.ap_materno) AS paciente,
            c.fecha,
            c.hora,
            c.motivo
        FROM 
            Paciente_cita pc
        JOIN 
            Cita c ON pc.id_cita = c.id_cita
        JOIN 
            Paciente p ON pc.id_paciente = p.id_paciente
        WHERE 
            pc.id_paciente = ?
    `;

    db.query(query, [id_paciente], (err, results) => {
        if (err) {
            console.error("Error al obtener citas:", err);
            return res.status(500).send("Error al obtener citas.");
        }
        res.status(200).json(results);
    });
});



// Ruta para obtener citas
app.get("/get-citas", (req, res) => {
    const query = `
        SELECT 
            p.nombre AS paciente, 
            c.fecha, 
            c.hora, 
            c.motivo 
        FROM Cita c
        JOIN Paciente_cita pc ON c.id_cita = pc.id_cita
        JOIN Paciente p ON pc.id_paciente = p.id_paciente;
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Error al obtener las citas:", err);
            res.status(500).send("Error al obtener las citas.");
        } else {
            res.status(200).json(results);
        }
    });
});

// Ruta para crear una nueva cita
app.post("/create-cita", (req, res) => {
    const { fecha, hora, motivo } = req.body;

    if (!fecha || !hora || !motivo) {
        return res.status(400).send("Todos los campos son obligatorios.");
    }

    const query = `INSERT INTO Cita (fecha, hora, motivo) VALUES (?, ?, ?)`;

    db.query(query, [fecha, hora, motivo], (err, result) => {
        if (err) {
            console.error("Error al guardar la cita:", err);
            return res.status(500).send("Error al guardar la cita.");
        }

        res.status(200).send("Cita guardada con éxito.");
    });
});

// Ruta para eliminar una cita
app.post("/eliminar-cita", (req, res) => {
    const { id_doctor, nombre_paciente, fecha_cita } = req.body;

    if (!id_doctor || !nombre_paciente || !fecha_cita) {
        return res.status(400).send("Todos los campos son obligatorios.");
    }

    // Dividir el nombre completo del paciente para buscar su ID
    const [nombre, ap_paterno, ap_materno] = nombre_paciente.split(" ");

    if (!nombre || !ap_paterno || !ap_materno) {
        return res.status(400).send("El formato del nombre del paciente es incorrecto.");
    }

    // Buscar el ID del paciente
    const buscarPacienteQuery = `
        SELECT id_paciente 
        FROM Paciente 
        WHERE nombre = ? AND ap_paterno = ? AND ap_materno = ?`;

    db.query(buscarPacienteQuery, [nombre, ap_paterno, ap_materno], (err, pacienteResults) => {
        if (err) {
            console.error("Error al buscar el paciente:", err);
            return res.status(500).send("Error al buscar el paciente.");
        }

        if (pacienteResults.length === 0) {
            return res.status(404).send("Paciente no encontrado.");
        }
         
        const id_paciente = pacienteResults[0].id_paciente;

        // Eliminar la cita de la tabla `Cita` o de cualquier tabla relacionada
        const eliminarCitaQuery = `
            DELETE FROM Nota 
            WHERE id_doctor = ? AND id_paciente = ?`;

        db.query(eliminarCitaQuery, [id_doctor, id_paciente], (err, result) => {
            if (err) {
                console.error("Error al eliminar la cita:", err);
                return res.status(500).send("Error al eliminar la cita.");
            }

            if (result.affectedRows === 0) {
                return res.status(404).send("No se encontró una cita para eliminar.");
            }

            res.status(200).send("Cita eliminada con éxito.");
        });
    });
});


app.post("/agregar-cita", (req, res) => {
    const { id_doctor, id_paciente, fecha, hora, motivo } = req.body;

    if (!id_doctor || !id_paciente || !fecha || !hora || !motivo) {
        return res.status(400).send("Todos los campos son obligatorios.");
    }

    const query = `
        INSERT INTO Cita (fecha, hora, motivo) 
        VALUES (?, ?, ?)
    `;

    db.query(query, [fecha, hora, motivo], (err, result) => {
        if (err) {
            console.error("Error al insertar la cita:", err);
            return res.status(500).send("Error al guardar la cita.");
        }

        const idCita = result.insertId;

        // Relacionar la cita con el doctor
        const doctorCitaQuery = `
            INSERT INTO Doctor_cita (id_doctor, id_cita) 
            VALUES (?, ?)
        `;
        db.query(doctorCitaQuery, [id_doctor, idCita], (err) => {
            if (err) {
                console.error("Error al relacionar la cita con el doctor:", err);
                return res.status(500).send("Error al relacionar la cita con el doctor.");
            }

            // Relacionar la cita con el paciente
            const pacienteCitaQuery = `
                INSERT INTO Paciente_cita (id_paciente, id_cita) 
                VALUES (?, ?)
            `;
            db.query(pacienteCitaQuery, [id_paciente, idCita], (err) => {
                if (err) {
                    console.error("Error al relacionar la cita con el paciente:", err);
                    return res.status(500).send("Error al relacionar la cita con el paciente.");
                }

                res.status(200).send("Cita registrada con éxito.");
            });
        });
    });
});

app.get("/get-medicos", (req, res) => {
    const query = "SELECT id_doctor, nombre, ap_paterno, ap_materno FROM Doctor";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error al obtener los médicos:", err);
            res.status(500).send("Error al obtener los médicos.");
        } else {
            res.status(200).json(results);
        }
    });
});
app.get("/get-notas", (req, res) => {
    const query = "SELECT Nota FROM Nota";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error al obtener las notas:", err);
            res.status(500).send("Error al obtener las notas.");
        } else {
            res.status(200).json(results);
        }
    });
});
app.get("/get-notas/:id_paciente/:id_doctor", (req, res) => {
    const { id_paciente, id_doctor } = req.params;

    const query = `
        SELECT Nota 
        FROM Nota 
        WHERE id_paciente = ? AND id_doctor = ?`;

    db.query(query, [id_paciente, id_doctor], (err, results) => {
        if (err) {
            console.error("Error al obtener notas:", err);
            res.status(500).send("Error al obtener notas.");
        } else {
            res.status(200).json(results);
        }
    });
});


// Ruta para obtener todas las citas
app.get("/get-citas", (req, res) => {
    const query = `SELECT fecha, hora, motivo FROM Cita`;
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error al obtener citas:", err);
            return res.status(500).send("Error al obtener citas.");
        }
        res.status(200).json(results);
    });
});

// Cargar citas

app.get("/obtener-citas/:idDoctor", (req, res) => {
    const idDoctor = req.params.idDoctor;

    const query = `
        SELECT 
            CONCAT(p.nombre, ' ', p.ap_paterno, ' ', p.ap_materno) AS nombre_completo, 
            c.fecha, 
            c.motivo 
        FROM Cita c
        INNER JOIN Paciente_Cita pc ON c.id_cita = pc.id_cita
        INNER JOIN Paciente p ON pc.id_paciente = p.id_paciente
        INNER JOIN Doctor_Cita dc ON c.id_cita = dc.id_cita
        WHERE dc.id_doctor = ?
    `;

    db.query(query, [idDoctor], (err, results) => {
        if (err) {
            console.error("Error al obtener citas:", err);
            return res.status(500).send("Error al obtener citas.");
        }

        res.status(200).json(results);
    });
});

// Ruta para guardar una nota
app.post("/guardar-nota", (req, res) => {
    const { id_paciente, id_doctor, nota } = req.body;

    // Validar campos
    if (!id_paciente || !id_doctor || !nota) {
        return res.status(400).send("Todos los campos son obligatorios.");
    }

    // Insertar la nota en la base de datos
    const query = `
        INSERT INTO Nota (id_paciente, id_doctor, Nota) 
        VALUES (?, ?, ?)
    `;

    db.query(query, [id_paciente, id_doctor, nota], (err, result) => {
        if (err) {
            console.error("Error al guardar la nota:", err);
            return res.status(500).send("Error al guardar la nota.");
        }

        res.status(200).send("Nota registrada con éxito.");
    });
});

//obtener tratamientos
app.get("/obtener-tratamientos", (req, res) => {
    const query = `
        SELECT 
            CONCAT(Paciente.nombre, ' ', Paciente.ap_paterno, ' ', Paciente.ap_materno) AS nombre_completo,
            Tratamiento.medicamento,
            Tratamiento.cantidad_hora
        FROM Paciente_tratamiento
        JOIN Paciente ON Paciente_tratamiento.id_paciente = Paciente.id_paciente
        JOIN Tratamiento ON Paciente_tratamiento.id_tratamiento = Tratamiento.id_tratamiento;
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Error al obtener los tratamientos:", err);
            return res.status(500).send("Error al obtener los tratamientos.");
        }

        res.status(200).json(results);
    });
});

// Ruta para añadir un tratamiento
app.post("/anadir-tratamiento", (req, res) => {
    const { id_doctor, id_paciente, tratamiento, cantidad } = req.body;

    if (!id_doctor || !id_paciente || !tratamiento || !cantidad) {
        return res.status(400).send("Todos los campos son obligatorios.");
    }

    const insertTratamientoQuery = `
        INSERT INTO Tratamiento (medicamento, cantidad_hora)
        VALUES (?, ?)
    `;

    db.query(insertTratamientoQuery, [tratamiento, cantidad], (err, result) => {
        if (err) {
            console.error("Error al insertar tratamiento:", err);
            return res.status(500).send("Error al insertar tratamiento.");
        }

        const idTratamiento = result.insertId;

        const insertPacienteTratamientoQuery = `
            INSERT INTO Paciente_tratamiento (id_paciente, id_tratamiento)
            VALUES (?, ?)
        `;

        db.query(insertPacienteTratamientoQuery, [id_paciente, idTratamiento], (err) => {
            if (err) {
                console.error("Error al insertar relación paciente-tratamiento:", err);
                return res.status(500).send("Error al asociar tratamiento al paciente.");
            }

            const insertDoctorTratamientoQuery = `
                INSERT INTO Doctor_tratamiento (id_doctor, id_tratamiento)
                VALUES (?, ?)
            `;

            db.query(insertDoctorTratamientoQuery, [id_doctor, idTratamiento], (err) => {
                if (err) {
                    console.error("Error al insertar relación doctor-tratamiento:", err);
                    return res.status(500).send("Error al asociar tratamiento al doctor.");
                }

                res.status(200).send("Tratamiento añadido con éxito.");
            });
        });
    });
});

// Ruta para eliminar un tratamiento
app.post("/eliminar-tratamiento", (req, res) => {
    const { id_doctor, id_paciente, tratamiento } = req.body;

    if (!id_doctor || !id_paciente || !tratamiento) {
        return res.status(400).send("Todos los campos son obligatorios.");
    }

    // Consultar el tratamiento para obtener su ID
    const findTratamientoQuery = `
        SELECT id_tratamiento FROM Tratamiento
        WHERE medicamento = ? AND id_tratamiento IN (
            SELECT id_tratamiento FROM Paciente_tratamiento WHERE id_paciente = ?
        )
    `;

    db.query(findTratamientoQuery, [tratamiento, id_paciente], (err, results) => {
        if (err || results.length === 0) {
            console.error("Error al buscar el tratamiento:", err || "Tratamiento no encontrado.");
            return res.status(404).send("Tratamiento no encontrado.");
        }

        const idTratamiento = results[0].id_tratamiento;

        // Eliminar relaciones de `Paciente_tratamiento` y `Doctor_tratamiento`
        const deletePacienteTratamientoQuery = `DELETE FROM Paciente_tratamiento WHERE id_tratamiento = ?`;
        const deleteDoctorTratamientoQuery = `DELETE FROM Doctor_tratamiento WHERE id_tratamiento = ?`;

        db.query(deletePacienteTratamientoQuery, [idTratamiento], (err) => {
            if (err) {
                console.error("Error al eliminar relaciones del tratamiento (Paciente):", err);
                return res.status(500).send("Error al eliminar relaciones del tratamiento.");
            }

            db.query(deleteDoctorTratamientoQuery, [idTratamiento], (err) => {
                if (err) {
                    console.error("Error al eliminar relaciones del tratamiento (Doctor):", err);
                    return res.status(500).send("Error al eliminar relaciones del tratamiento.");
                }

                // Eliminar el tratamiento de la tabla `Tratamiento`
                const deleteTratamientoQuery = "DELETE FROM Tratamiento WHERE id_tratamiento = ?";
                db.query(deleteTratamientoQuery, [idTratamiento], (err) => {
                    if (err) {
                        console.error("Error al eliminar el tratamiento:", err);
                        return res.status(500).send("Error al eliminar el tratamiento.");
                    }

                    res.status(200).send("Tratamiento eliminado con éxito.");
                });
            });
        });
    });
});


// Ruta para modificar un tratamiento
app.post("/modificar-tratamiento", (req, res) => {
    const { id_doctor, id_paciente, tratamiento_actual, tratamiento_nuevo, cantidad_actual, cantidad_nueva } = req.body;

    if (!id_doctor || !id_paciente) {
        return res.status(400).send("Todos los campos son obligatorios.");
    }

    if (!tratamiento_actual && !tratamiento_nuevo && !cantidad_actual && !cantidad_nueva) {
        return res.status(400).send("Debe modificar al menos un campo.");
    }

    // Buscar el tratamiento actual
    const findTratamientoQuery = `
        SELECT id_tratamiento FROM Tratamiento 
        WHERE medicamento = ? AND cantidad_hora = ?
        AND id_tratamiento IN (
            SELECT id_tratamiento FROM Paciente_tratamiento WHERE id_paciente = ?
        )
    `;

    db.query(findTratamientoQuery, [tratamiento_actual, cantidad_actual, id_paciente], (err, results) => {
        if (err || results.length === 0) {
            console.error("Error al buscar el tratamiento:", err || "Tratamiento no encontrado.");
            return res.status(404).send("Tratamiento no encontrado.");
        }

        const idTratamiento = results[0].id_tratamiento;

        // Actualizar el tratamiento
        const updateQuery = `
            UPDATE Tratamiento 
            SET medicamento = COALESCE(?, medicamento), 
                cantidad_hora = COALESCE(?, cantidad_hora)
            WHERE id_tratamiento = ?
        `;

        db.query(updateQuery, [tratamiento_nuevo || null, cantidad_nueva || null, idTratamiento], (err) => {
            if (err) {
                console.error("Error al modificar el tratamiento:", err);
                return res.status(500).send("Error al modificar el tratamiento.");
            }

            res.status(200).send("Tratamiento modificado con éxito.");
        });
    });
});


// Iniciar el servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
});