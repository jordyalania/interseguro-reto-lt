FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31-alpine
# Aplica los parches de seguridad publicados después de esta imagen base.
USER root
RUN apk upgrade --no-cache
USER 101
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
