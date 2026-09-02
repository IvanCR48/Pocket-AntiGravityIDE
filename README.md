<div align="center">

  <img src="assets/banner.png" alt="Pocket Antigravity Demo" width="100%" style="border-radius: 8px;" />

  <br/><br/>

  <img src="assets/logo.png" alt="Pocket Antigravity Logo" width="100" height="100" style="border-radius: 50%;" />

  # Pocket Antigravity IDE

  **Controlás tu Antigravity IDE desde el celular sin instalar plugins ni configurar extensiones.**

  <p align="center">
    <a href="#cómo-correrlo"><img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=flat-square&logo=windows" alt="Windows"></a>
    <a href="#cómo-correrlo"><img src="https://img.shields.io/badge/Interface-Mobile%20Web-007acc?style=flat-square&logo=visualstudiocode" alt="VS Code UI"></a>
    <a href="#cómo-correrlo"><img src="https://img.shields.io/badge/Access-HTTPS%20Tunnel-F38020?style=flat-square&logo=cloudflare" alt="Cloudflare"></a>
    <a href="#licencia"><img src="https://img.shields.io/badge/License-MIT-purple?style=flat-square" alt="License"></a>
  </p>

</div>

---

## Por qué existe esto

Me pasaba todo el tiempo: le pedís al agente de Antigravity una refactorización grande o implementar un módulo completo, y el modelo se queda 2 o 3 minutos pensando, editando archivos y ejecutando comandos.

En ese rato te levantás a buscar un café o vas al living, pero para ver si terminó, responderle una duda o aceptar los cambios que propone, tenés que volver a sentarte frente a la PC.

Armé **Pocket Antigravity** para resolver exactamente eso:
* Poder revisar desde el celular los archivos que el agente modificó línea por línea con diffs en verde y rojo.
* Tocar **Accept All** (`Alt + Enter`) o **Reject** directamente en la pantalla de tu teléfono.
* Mandarle el siguiente prompt de voz, una foto de un error en pantalla o adjuntar un archivo del proyecto sin estar clavado al escritorio.

Todo esto **sin instalar extensiones propietarias**: corre sobre Windows de forma nativa interactuando directamente con el sistema operativo.

---

## Lo que podés hacer (Features clave)

* **Control remoto total**: Enviás prompts de texto, capturas de cámara o referencias a archivos de tu proyecto con un toque (`@ruta/archivo`).
* **Revisión y aprobación de Diffs**: Si el agente toca código, aparece un banner en tu teléfono con las estadísticas (`+14 / -3`). Abrís el visor con sintaxis a color y aceptás o descartás los cambios con 1 toque.
* **Streaming en tiempo real**: Ves exactamente lo que el agente va pensando y respondiendo en vivo mediante WebSockets directos.
* **Explorador de tu proyecto**: Navegás el árbol de archivos de tu repositorio y ves el código fuente con syntax highlighting desde el teléfono.
* **Acceso global con PIN**: Genera un túnel HTTPS seguro (Cloudflare / Localtunnel) protegido por un PIN de 4 dígitos para que solo vos puedas entrar desde 4G, 5G o Wi-Fi.

---

## Cómo correrlo (En 3 pasos)

### 1. Clonar e instalar
```bash
git clone https://github.com/IvanCR48/Pocket-AntiGravityIDE.git
cd Pocket-AntiGravityIDE
npm install
```

### 2. Iniciar (1 Click)
Hacé doble click en **`start.bat`** (o ejecutá `npm run app`).

Esto abre el servidor local y levanta el túnel HTTPS. En la consola vas a ver la URL pública y un código QR para escanear con la cámara de tu celular.

### 3. Conectar y desbloquear
1. Abrí el enlace en Safari o Chrome en tu celular.
2. Ingresá el PIN de seguridad (por defecto viene configurado en `1234` en `pocket.config.json`).
3. ¡Listo! Ya estás conectado en vivo a tu Antigravity IDE.

> Para detener todo cuando termines, hacé doble click en **`stop.bat`**.

---

## Decisiones técnicas y limitaciones honestas

* **¿Por qué Win32 P/Invoke en vez de un plugin de VS Code?**
  Antigravity IDE no expone una API pública para inyectar texto en su ventana de chat. En vez de depender de parches que se rompan cada vez que el IDE se actualiza, usamos llamadas del sistema operativo (`AttachThreadInput`, `SetForegroundWindow` y `keybd_event`). El sistema localiza la ventana de Chromium/Electron y le pasa el foco de forma transparente.

* **Lectura directa de transcripciones (`.jsonl`)**:
  El servidor no hace scraping de pantalla. Lee incrementalmente los logs de razonamiento que el motor de Antigravity guarda en disco (`.gemini/antigravity-ide/brain/...`). Esto hace que el streaming al celular consuma prácticamente 0% de CPU.

* **Limitaciones actuales**:
  * Solo funciona en **Windows** (debido al inyector Win32).
  * La ventana de Antigravity IDE debe estar abierta en la PC anfitriona.

---

## Arquitectura Hexagonal (Ports & Adapters)

El núcleo del sistema está desacoplado del sistema operativo y los frameworks:

```mermaid
flowchart TD
    subgraph DrivingAdapters ["Adaptadores Primarios (Entrada)"]
        Phone[📱 Web App Móvil] -->|HTTP REST| Express[Express Controllers /api/*]
        Phone -->|WebSockets| WS[WebSocket Stream Handler /ws]
    end

    subgraph CoreDomain ["Núcleo Hexagonal (Casos de Uso & Dominio)"]
        Express --> UseCases[Casos de Uso: SendPrompt / ReviewChanges / ManageSessions]
        WS --> UseCases
        UseCases --> Ports["Puertos (Interfaces): IdeAutomationPort / VcsPort / TranscriptPort"]
    end

    subgraph DrivenAdapters ["Adaptadores Secundarios (Salida / Infraestructura)"]
        Ports -->|IdeAutomationPort| Win32Adapter[Win32 Automation Adapter / P-Invoke]
        Ports -->|VcsPort| GitAdapter[Git CLI Adapter / Status, Diff, Restore]
        Ports -->|TranscriptPort| JsonlAdapter[JSONL Transcript Adapter / Disk Tail Watcher]
    end
```

---

## Atajos útiles

Si querés conocer todos los atajos internos del IDE, creamos una guía completa en [ANTIGRAVITY_SHORTCUTS.md](ANTIGRAVITY_SHORTCUTS.md).

---

## Roadmap

- [x] Control remoto de prompts (texto y fotos).
- [x] Streaming de chat en vivo con WebSockets.
- [x] Explorador de archivos del proyecto con visor de código.
- [x] Protección por PIN de seguridad de 4 dígitos.
- [x] Visor de diffs móvil con acciones remotas (Accept All / Reject All).
- [ ] Selector de asistentes y personas (Code Reviewer, Arquitecto, Debugger).
- [ ] Atajo de dictado por voz directo al prompt.

---

## Licencia

MIT License — Creado por [IvanCR48](https://github.com/IvanCR48). Podés usarlo, modificarlo y compartirlo libremente.
