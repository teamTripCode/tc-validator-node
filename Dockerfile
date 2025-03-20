# ====== Etapa 1: Construcción ======
FROM node:20-alpine AS builder

# Crear directorio de trabajo
WORKDIR /app

# Mejoramos la configuración de npm para problemas de red
RUN npm config set registry https://registry.npmjs.org/ \
    && npm config set fetch-timeout 600000 \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-maxtimeout 120000

# Instalar dependencias globales necesarias
RUN npm install -g rimraf

# Copiar archivos necesarios para instalar dependencias
COPY package*.json ./
COPY tsconfig*.json ./

# Instalar dependencias con ci para mejor reproducibilidad y tolerancia a fallos
RUN npm ci --no-fund --network-timeout=600000 --prefer-offline

# Copiar el resto del código
COPY . .

# Compilar el backend (NestJS)
RUN npm run build && \
    find dist -name "main.js" && \
    ls -la dist/ && \
    echo "Verificando archivo principal..." && \
    if [ -f "./dist/src/main.js" ]; then echo "Archivo principal existe"; else echo "Archivo principal NO encontrado" && exit 1; fi

# ====== Etapa 2: Producción ======
FROM node:20-alpine AS production

# Instalar dependencias del sistema
RUN apk add --no-cache netcat-openbsd openssl

# Crear directorio de trabajo
WORKDIR /app

# Copiar los archivos necesarios del builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Generamos certificados TLS
RUN mkdir -p certs/tls && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout certs/tls/private-key.pem \
    -out certs/tls/public-key.pem \
    -subj "/CN=localhost/O=TripCode/C=US" && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout certs/tls/ca-key.pem \
    -out certs/tls/ca-cert.pem \
    -subj "/CN=TripCode-CA/O=TripCode/C=US"

# Variables de entorno
ENV NODE_ENV=production \
    PORT=8080 \
    HTTP_PORT=8080 \
    WS_PORT=8081 \
    REDIS_URL=redis://localhost:6379


# Exponer los puertos de la aplicación
EXPOSE 8080 8081

# Comando para iniciar la aplicación
CMD ["npm", "run", "start:prod"]
