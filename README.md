# Nodo Validador de Blockchain - TripCode

## 🚀 Introducción
El Nodo Validador es un componente crítico dentro de la red blockchain descentralizada de TripCode , diseñado para garantizar la validación eficiente y segura de transacciones, la generación de bloques y el mantenimiento del consenso en la red. Este nodo utiliza una combinación de Delegated Proof of Stake (DPoS) y Practical Byzantine Fault Tolerance (PBFT) para asegurar que las operaciones sean rápidas, confiables y resistentes a ataques.

## 📚 Índice
1. [Descripción General](#descripcion-general)
2. [Componentes Clave](#-componentes-clave)
3. [Requisitos del Sistema](#-requisitos-del-sistema)
4. [Instalación y Configuración](#️-instalación-y-configuración)
5. [Estructura del Proyecto](#-estructura-del-proyecto)
6. [Flujo de Operación](#️-flujo-de-operación)
<!-- 7. [Contribuciones](#descripcion-general)
8. [Licencia](#descripcion-general) -->


## 🌟 Descripción General
El nodo validador es responsable de:

 - **Validar Transacciones:** Asegura que todas las transacciones sean correctas antes de ser agregadas a la blockchain.

 - **Generar Bloques:** Participa activamente en la creación de nuevos bloques mediante el algoritmo de consenso DPoS + PBFT.

 - **Mantener Consenso:** Garantiza que todos los nodos en la red lleguen a un acuerdo sobre el estado actual de la blockchain.

 - **Registrar Procesos Críticos:** Almacena eventos importantes como compras, pagos con tarjeta y otros registros clave de negocios.

Estos nodos son seleccionados mediante un sistema de delegación y deben cumplir con requisitos de alta disponibilidad y poder de cómputo.

## 🔧 Componentes Clave

### 1. Red P2P
Los nodos se conectan entre sí sin depender de un servidor central.
Descubrimiento automático de pares mediante nodos semilla.
Distribución de bloques y validación de transacciones en tiempo real.

### 2. Almacenamiento de Blockchain
 - Cada nodo almacena una copia completa de la blockchain.
 - Los bloques contienen:
   - Transacciones de smart contracts.
   - Creación y transferencia de criptomonedas.
   Registros críticos de negocios (creación de cuentas, emisión de facturas, pagos, etc.).

### 3. Gestión de Cuentas y Smart Contracts
 - **Cuentas de Negocios:** Crean smart contracts para emitir criptomonedas y registrar transacciones.

 - **Smart Contracts de Criptomonedas:** Emiten tokens con precios dinámicos basados en oferta y demanda.

 - **Smart Contracts de Registro de Procesos Críticos:** Almacenan eventos inmutables como creación de cuentas y pagos.

### 4. Validación de Bloques y Transacciones
 - Verificación de transacciones antes de ser agregadas a la blockchain.
 - Confirmación de pagos y registro de procesos críticos.

### 5. Algoritmo de Consenso
 - DPoS: Mejora la eficiencia al limitar el número de nodos validadores.
 - PBFT: Garantiza que todos los nodos acuerden un estado único de la blockchain.

## 💻 Requisitos del Sistema
Para ejecutar un nodo validador, se requiere:

 - **Sistema Operativo:** Linux/MacOS/Windows (preferiblemente Linux para producción).
 - **Node.js:** Versión 20.x o superior.
 - **Redis:** Para almacenamiento temporal de datos.
 - **Alta Disponibilidad:** El nodo debe estar siempre en línea para participar en el consenso.
 - **Poder de Cómputo:** Procesador moderno y suficiente memoria RAM para manejar transacciones en tiempo real.

## 🛠️ Instalación y Configuración

### 1. Clonar el Repositorio
```bash
git clone https://github.com/tripcode-blockchain/validator-node.git
cd validator-node
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Cree un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
PORT=3000
REDIS_URL=redis://localhost:6379
SEED_NODES=node1.tripcode.com,node2.tripcode.com
```

### 4. Generar Claves Criptográficas
Asegúrese de tener OpenSSL instalado y genere las claves públicas y privadas:

```bash
mkdir certs
openssl genpkey -algorithm RSA -out certs/private-key.pem
openssl rsa -pubout -in certs/private-key.pem -out certs/public-key.pem
```

### 5. Iniciar el Nodo
```bash
npm run start:dev
```
El nodo validador estará disponible en http://localhost:3000.

## 📂 Estructura del Proyecto
```plaintext
src/
├── app/                # Controladores y servicios principales
├── consensus/          # Lógica de consenso PBFT
├── redis/              # Integración con Redis
├── signature/          # Servicios de firma digital
├── validator/          # Lógica específica del nodo validador
test/                   # Pruebas unitarias y de integración
```

## ⚙️ Flujo de Operación

### 1. Conexión a la Red P2P:
 - El nodo se conecta a otros nodos mediante el descubrimiento automático.
 - Sincroniza la lista de validadores desde nodos semilla.

### 2. Participación en el Consenso:
 - Si el nodo es seleccionado como líder, propone un nuevo bloque.
 - Si no, valida el bloque propuesto por el líder.

### Registro de Transacciones:
 - Las transacciones son verificadas y agregadas a la blockchain.
 - Los smart contracts registran eventos críticos como pagos y creación de cuentas.