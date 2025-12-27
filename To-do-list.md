# Ultra Bingo - Lista de Tareas de Desarrollo

## 1. Modos de Juego (Game Modes)

### 1.1 Backend - Modelo y Lógica
- [ ] Agregar campo `gameMode` al modelo Game con opciones:
  - `fullCard` - Cartón completo (75 números)
  - `letterB` - Formar la letra B
  - `letterI` - Formar la letra I
  - `letterN` - Formar la letra N
  - `letterG` - Formar la letra G
  - `letterO` - Formar la letra O
  - `letterL` - Formar la letra L
  - `letterT` - Formar la letra T
  - `letterU` - Formar la letra U
  - `letterX` - Formar la letra X (diagonal cruzada)
  - `corners` - 4 esquinas
  - `horizontalLine` - Línea horizontal (cualquiera de las 5)
  - `verticalLine` - Línea vertical (cualquiera de las 5)
  - `diagonal` - Diagonal (cualquiera de las 2)
  - `blackout` - Cartón completo (igual que fullCard)

- [ ] Crear función `getPatternPositions(gameMode)` que retorne las posiciones requeridas para cada modo
- [ ] Modificar función `checkWinner()` para validar según el modo de juego activo
- [ ] Agregar endpoint para cambiar modo de juego (solo cuando status = 'waiting' o 'ended')
- [ ] Emitir evento socket cuando cambie el modo de juego

### 1.2 Frontend - UI Selector de Modo
- [ ] Crear componente `GameModeSelector` con pestañas retráctiles
- [ ] Mostrar visualmente el patrón de cada modo (mini-cartón con casillas resaltadas)
- [ ] Deshabilitar selector durante partida activa (status = 'playing' o 'paused')
- [ ] Mostrar modo actual en la sección de Bingo Live
- [ ] Actualizar tracking de cartones según el modo seleccionado

### 1.3 Frontend - Tracking de Cartones por Modo
- [ ] Modificar lógica de marcado de números para resaltar solo posiciones relevantes al modo
- [ ] Mostrar progreso del patrón (ej: "3/5 posiciones completadas para la U")
- [ ] Animación cuando se completa el patrón

---

## 2. Estado Activo/Inactivo de Cartones

### 2.1 Backend
- [ ] El modelo Card ya tiene `status`: 'available', 'reserved', 'purchased'
- [ ] Para filtrar cartones "activos" en juego, usar: `status: 'purchased'`
- [ ] Agregar campo `gameId` a los cartones comprados para asociarlos a un juego específico
- [ ] Crear endpoint para obtener solo cartones activos (purchased) de un juego

### 2.2 Lógica de Asociación
- [ ] Cuando un usuario compra cartones, si hay un juego en 'waiting', asociar al gameId
- [ ] Si el juego está en 'playing', rechazar la compra (ver sección 3)

---

## 3. Bloqueo de Compra Durante Juego Activo

### 3.1 Backend - Validación
- [ ] Modificar ruta `POST /api/cards/purchase`:
  - Verificar estado del juego actual
  - Si `status === 'playing'` o `status === 'paused'`, rechazar compra con error 403
  - Mensaje: "No se pueden comprar cartones mientras hay un juego en progreso"

### 3.2 Frontend - UI
- [ ] Deshabilitar botón de compra cuando juego está activo
- [ ] Mostrar mensaje informativo: "Compra de cartones bloqueada - Juego en progreso"
- [ ] Escuchar eventos socket 'game-started' y 'game-ended' para actualizar estado

### 3.3 Socket Events
- [ ] Emitir evento `purchase-blocked` cuando se inicia juego
- [ ] Emitir evento `purchase-enabled` cuando termina juego

---

## 4. Panel Admin - Búsqueda y Visualización de Cartones

### 4.1 Backend - Endpoints Admin
- [ ] `GET /api/admin/cards/search?cardId=xxx` - Buscar cartón por ID
- [ ] `GET /api/admin/cards/active` - Listar todos los cartones activos (purchased)
- [ ] `GET /api/admin/cards/:cardId/details` - Detalles completos de un cartón
  - Incluir: números, owner, wallet, estado de marcado vs números cantados

### 4.2 Frontend - UI Admin
- [ ] Crear sección "Buscar Cartón" en panel admin
- [ ] Input para buscar por ID de cartón
- [ ] Mostrar cartón encontrado con:
  - Visualización del cartón (5x5)
  - Números marcados vs números cantados
  - Información del dueño (username, wallet)
  - Progreso hacia el patrón actual
  - Botón "Verificar Ganador" si el patrón está completo

### 4.3 Verificación de Ganador
- [ ] Ya existe endpoint `POST /api/admin/game/verify`
- [ ] Crear UI para:
  - Mostrar cartón del posible ganador
  - Comparar visualmente con números cantados
  - Botón de confirmación/rechazo
  - Al confirmar, emitir evento 'winner-announced'

---

## 5. Flujo Completo del Juego

### Estados del Juego:
1. `waiting` - Esperando inicio, compra habilitada, modo seleccionable
2. `playing` - En juego, compra bloqueada, modo fijo
3. `paused` - Pausado, compra bloqueada, modo fijo
4. `ended` - Terminado, compra habilitada, modo seleccionable

### Transiciones:
- `waiting` -> `playing`: Admin inicia juego, bloquea compras
- `playing` -> `paused`: Admin pausa
- `paused` -> `playing`: Admin reanuda
- `playing/paused` -> `ended`: Admin termina o se verifica ganador
- `ended` -> `waiting`: Admin inicia nuevo juego

---

## 6. Orden de Implementación Sugerido

### Fase 1 - Bloqueo de Compras (Crítico)
1. [ ] Backend: Validación en ruta de compra
2. [ ] Frontend: Deshabilitar compra durante juego
3. [ ] Testing: Verificar que no se puede comprar durante juego

### Fase 2 - Panel Admin Búsqueda
1. [ ] Backend: Endpoints de búsqueda
2. [ ] Frontend: UI de búsqueda de cartones
3. [ ] Frontend: Visualización de cartón con estado

### Fase 3 - Modos de Juego
1. [ ] Backend: Modelo y lógica de patrones
2. [ ] Backend: Modificar checkWinner
3. [ ] Frontend: Selector de modo
4. [ ] Frontend: Tracking por modo
5. [ ] Testing: Verificar cada patrón

### Fase 4 - Verificación de Ganador UI
1. [ ] Frontend: Panel de verificación visual
2. [ ] Frontend: Comparación cartón vs números cantados
3. [ ] Testing: Flujo completo de verificación

---

## Notas Técnicas

### Patrones de Letras (posiciones en cartón 5x5):
```
Cartón Bingo (columnas B-I-N-G-O, filas 0-4):

B  I  N  G  O
0  1  2  3  4   <- fila 0
5  6  7  8  9   <- fila 1
10 11 FREE 13 14 <- fila 2 (centro es FREE)
15 16 17 18 19  <- fila 3
20 21 22 23 24  <- fila 4

Letra U: columnas B y O completas + fila 4
Posiciones: [0,5,10,15,20, 4,9,14,19,24, 21,22,23]

Letra L: columna B completa + fila 4
Posiciones: [0,5,10,15,20, 21,22,23,24]

Letra T: fila 0 + columna N completa
Posiciones: [0,1,2,3,4, 7,12,17,22]

Letra X: ambas diagonales
Posiciones: [0,6,12,18,24, 4,8,12,16,20]
```

### Archivos a Modificar:
- Backend:
  - `src/models/Game.js` - Agregar gameMode
  - `src/services/bingoCard.js` - checkWinner con patrones
  - `src/services/gameState.js` - Funciones de modo
  - `src/routes/cards.js` - Bloqueo de compra
  - `src/routes/admin.js` - Endpoints de búsqueda
  - `src/services/socket.js` - Eventos de modo

- Frontend:
  - `src/pages/BingoLive.jsx` - Selector de modo, tracking
  - `src/pages/Admin.jsx` - Búsqueda de cartones
  - `src/pages/Home.jsx` - Bloqueo de compra
  - `src/components/bingo/GameModeSelector.jsx` - Nuevo componente
  - `src/components/bingo/CardSearch.jsx` - Nuevo componente admin
