# Control Tower IA — Guía de Instalación y Configuración

Automatización logística internacional para Boart Longyear Argentina.

---

## Opción A — Instalador (recomendada para PCs de trabajo)

### Requisitos
- Windows 10/11 64-bit
- Microsoft Outlook instalado y configurado (app de escritorio)
- Conexión a internet solo para la instalación inicial

### Instalación

1. Descargá el instalador: `Control Tower IA Setup 1.0.0.exe`
2. Doble click → Next → Elegí carpeta de instalación → Install
3. Al terminar se crea acceso directo en el escritorio

> **Nota:** Windows Defender puede mostrar una advertencia la primera vez. Hacé click en "Más información" → "Ejecutar de todas formas". Es normal para apps no firmadas digitalmente.

---

## Opción B — Desde el código fuente (para desarrolladores)

### Requisitos previos

| Software | Versión | Descarga |
|----------|---------|----------|
| Git | Cualquiera | [git-scm.com/download/win](https://git-scm.com/download/win) |
| Python | 3.11 o superior | [python.org/downloads](https://python.org/downloads) ✅ Tildar "Add to PATH" |
| Node.js | 18 LTS o superior | [nodejs.org](https://nodejs.org) |
| Microsoft Outlook | App de escritorio | Ya instalado en PCs corporativas |

### Instalación paso a paso

Abrí **CMD** o **PowerShell** y ejecutá:

```bash
# 1. Clonar el repositorio
git clone https://github.com/GonzaloSevilla22/control-tower-ia.git

# 2. Entrar a la carpeta
cd control-tower-ia

# 3. Instalar todo (Python + Node + dependencias)
setup.bat
```

### Uso diario

```bash
# Cada vez que quieras usar la app:
start_dev.bat
```

---

## Configuración de Outlook

### Paso 1 — Verificar que Outlook esté abierto

Control Tower IA se conecta a **Outlook desktop** (la app, no la web).  
Antes de sincronizar, asegurate de que Outlook esté abierto y tu cuenta corporativa esté activa.

```
✅ Outlook abierto y cuenta configurada
✅ VPN conectada (si trabajás remoto)
```

### Paso 2 — Primera sincronización

1. Abrí Control Tower IA
2. En el **Dashboard** vas a ver el indicador "Outlook" en el sidebar izquierdo
3. Hacé click en **"Sincronizar Outlook"** (botón azul arriba a la derecha)
4. La app va a leer los últimos **30 días** de correos automáticamente

> La primera sincronización puede tardar 1-2 minutos dependiendo de cuántos correos tenés.

### Paso 3 — Qué correos detecta la app

La app filtra automáticamente correos que contengan estas palabras clave:

| Referencia | Ejemplos en el correo |
|-----------|----------------------|
| Service Order | `SO-123456`, `Service Order 123456`, `S.O. 123456` |
| Bill of Lading | `BL MAEU1234567`, `B/L HLCUBUE2412345` |
| Airway Bill | `AWB 083-12345678`, `Airway Bill 083-12345678` |
| Delivery Number | `DN 4500012345`, `Delivery Number 4500012345` |
| OP Interno | `OP-9876`, `Orden de Pedido 9876` |

**Palabras clave que activan el filtro:**
`shipment`, `embarque`, `aduana`, `customs`, `ETD`, `ETA`, `pickup`,
`freight`, `flete`, `warehouse`, `booking`, `forwarder`, etc.

---

## Carpeta de documentos

Los adjuntos de cada operación se descargan automáticamente en:

```
C:\Users\TuUsuario\AppData\Roaming\ControlTowerIA\docs_storage\
└── SO-123456\
    ├── invoice_SO123456.pdf
    ├── packing_list.xlsx
    ├── BL_MAEU1234567.pdf
    └── AWB_083-12345678.pdf
```

Para abrir la carpeta de una operación: en el detalle de la operación → pestaña **Documentos** → click en cualquier archivo.

---

## Configuración de la VPN corporativa

Si trabajás con VPN, seguí este orden de arranque:

```
1. Conectar VPN  →  2. Abrir Outlook  →  3. Abrir Control Tower IA
```

> Si Outlook no tiene correos nuevos luego de conectar la VPN, cerrá y volvé a abrir Outlook antes de sincronizar.

---

## IA offline (Ollama) — Etapa 5

La app funciona sin IA en Etapa 1. Para activar el Copiloto IA cuando esté disponible:

### Instalar Ollama

1. Descargá desde [ollama.com/download/windows](https://ollama.com/download/windows)
2. Instalá con las opciones por defecto
3. Abrí CMD y ejecutá:

```bash
ollama pull mistral
```

> El modelo Mistral pesa ~4.1 GB. Solo se descarga una vez y funciona completamente offline.

4. Verificar que funciona:
```bash
ollama run mistral "Hola, funcionás offline?"
```

---

## Troubleshooting

### "Outlook OFFLINE" en el sidebar

- Verificar que Outlook (app desktop) esté abierto
- Si usás VPN: conectar VPN → abrir Outlook → reiniciar Control Tower IA

### "Backend OFFLINE" en el sidebar

- Si usás el instalador: reiniciar la app
- Si usás código fuente: verificar que `start_dev.bat` esté corriendo y la ventana del backend no esté cerrada

### La sincronización no encuentra correos

- Verificar en Outlook que tenés correos con referencias logísticas (SO, BL, AWB, etc.)
- Asegurate de que Outlook esté mostrando la bandeja de entrada con correos recientes
- Si los correos están en una subcarpeta, por ahora la app busca en Bandeja de entrada y Elementos enviados

### Error "Access is denied" al descargar adjuntos

- Ejecutar la app **sin** modo administrador (click derecho → NO "Ejecutar como administrador")
- Verificar permisos de escritura en `C:\Users\TuUsuario\AppData\Roaming\`

---

## Estructura de datos

| Carpeta | Contenido |
|---------|-----------|
| `AppData\Roaming\ControlTowerIA\data\` | Base de datos SQLite (`control_tower.db`) |
| `AppData\Roaming\ControlTowerIA\docs_storage\` | Documentos organizados por SO |

> Para hacer backup: copiar toda la carpeta `ControlTowerIA` de AppData.

---

## Actualizar la app

Cuando haya nuevas versiones disponibles, la app mostrará una notificación automática.  
También podés actualizar manualmente descargando el nuevo instalador y ejecutándolo sobre la versión anterior (mantiene todos los datos).

---

## Soporte

Repositorio: [github.com/GonzaloSevilla22/control-tower-ia](https://github.com/GonzaloSevilla22/control-tower-ia)  
Versión actual: **1.0.0** — Etapa 1
