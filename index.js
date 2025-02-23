const { create, Client } = require('@open-wa/wa-automate');
const fs = require('fs');
const notesFile = 'notes.json';

let notes = {};

// Cargar notas desde el archivo JSON si existe
if (fs.existsSync(notesFile)) {
    notes = JSON.parse(fs.readFileSync(notesFile, 'utf-8'));
}

create({
    useChrome: true,
    headless: true, // Mantenerlo en segundo plano
    qrTimeout: 0, // No expira el QR
    authTimeout: 0, // Evita problemas de timeout
    cacheEnabled: false, // Evita errores de caché
}).then(client => start(client));

function start(client) {
    client.onMessage(async message => {
        const chatId = message.from;
        const userId = message.sender.id;
        const userName = message.sender.pushname || userId;
        
        if (!notes[chatId]) notes[chatId] = {};
        if (!notes[chatId][userId]) notes[chatId][userId] = [];

        if (message.body.startsWith('-addnote')) {
            const parts = message.body.split(' ');
            if (parts.length < 4) {
                await client.reply(chatId, 'Formato incorrecto. Usa: -addnote fecha <tema> <texto>', message.id);
                return;
            }
            
            const fecha = parts[1];
            const tema = parts[2];
            const texto = parts.slice(3).join(' ');
            
            const newNote = {
                id: notes[chatId][userId].length + 1,
                fecha: fecha.trim(),
                tema: tema.trim(),
                texto: texto.trim()
            };
            
            notes[chatId][userId].push(newNote);
            saveNotes();
            await client.reply(chatId, `Nota añadida con ID ${newNote.id}`, message.id);
        }

        if (message.body.startsWith('-modifinote')) {
            const match = message.body.match(/id=(\d+)/);
            if (!match) {
                await client.reply(chatId, 'Formato incorrecto. Usa: -modifinote id=X nuevo texto', message.id);
                return;
            }
            
            const id = parseInt(match[1]);
            const newText = message.body.replace(/-modifinote id=\d+/, '').trim();
            const noteIndex = notes[chatId][userId].findIndex(n => n.id === id);
            
            if (noteIndex !== -1) {
                notes[chatId][userId][noteIndex].texto = newText;
                saveNotes();
                await client.reply(chatId, `Nota con ID ${id} modificada.`, message.id);
            } else {
                await client.reply(chatId, 'Nota no encontrada.', message.id);
            }
        }

        if (message.body.startsWith('-view')) {
            const match = message.body.match(/id=(\d+)/);
            if (!match) {
                await client.reply(chatId, 'Formato incorrecto. Usa: -view id=X', message.id);
                return;
            }
            
            const id = parseInt(match[1]);
            const note = notes[chatId][userId].find(n => n.id === id);
            
            if (note) {
                await client.reply(chatId, `📝 Nota ID ${id}:
Fecha: ${note.fecha}
Tema: ${note.tema}
Texto: ${note.texto}`, message.id);
            } else {
                await client.reply(chatId, 'Nota no encontrada.', message.id);
            }
        }

        if (message.body === '-note') {
            if (notes[chatId][userId].length === 0) {
                await client.reply(chatId, 'No tienes notas guardadas.', message.id);
                return;
            }
            
            let response = `Buenas *${userName}*, tus notas son:\n`;
            notes[chatId][userId].forEach(n => {
                response += `\n${n.id}) ${n.fecha}\n${n.tema}\n${n.texto}\n---`;
            });
            
            await client.reply(chatId, response, message.id);
        }

        if (message.body.startsWith('-deletenote')) {
            const match = message.body.match(/(\d+)/);
            if (!match) {
                await client.reply(chatId, 'Formato incorrecto. Usa: -deletenote <id>', message.id);
                return;
            }
            
            const id = parseInt(match[1]);
            const index = notes[chatId][userId].findIndex(n => n.id === id);
            
            if (index !== -1) {
                notes[chatId][userId].splice(index, 1);
                saveNotes();
                await client.reply(chatId, `Nota con ID ${id} eliminada.`, message.id);
            } else {
                await client.reply(chatId, 'Nota no encontrada.', message.id);
            }
        }

        if (message.body === '-ping') {
            const startTime = Date.now();
            await client.sendText(chatId, 'Pong!', message.id);
            const endTime = Date.now();
            const ping = endTime - startTime;
            await client.reply(chatId, `Tiempo de respuesta: ${ping}ms`, message.id);
        }

        if (message.body === '-menu') {
            const menu = `📜 *Menú de Comandos* 📜\n
` +
                `-addnote fecha <tema> <texto> → Añade una nueva nota.\n` +
                `-modifinote id=<id> <nuevo texto> → Modifica una nota existente.\n` +
                `-view id=<id> → Muestra una nota específica.\n` +
                `-note → Lista todas tus notas.\n` +
                `-deletenote <id> → Elimina una nota.\n` +
                `-ping → Muestra el tiempo de respuesta.\n`;
            await client.reply(chatId, menu, message.id);
        }
    });
}

function saveNotes() {
    fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2));
}
