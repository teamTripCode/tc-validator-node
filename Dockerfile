# ====== Etapa 1: Construcción ======
FROM node:20-alpine AS builder

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos necesarios para instalar dependencias
COPY package*.json ./
COPY tsconfig*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Compilar el backend (NestJS)
RUN npm run build

# ====== Etapa 2: Producción ======
FROM node:20-alpine AS production

# Instalar netcat
RUN apk add --no-cache netcat-openbsd

# Crear directorio de trabajo
WORKDIR /app

# Copiar los archivos necesarios del builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Exponer el puerto de la aplicación
EXPOSE 8080 8081

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=8080

# Comando de inicio flexible para producción o desarrollo
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = 'production' ]; then node dist/main.js; else npm run start:dev; fi"]