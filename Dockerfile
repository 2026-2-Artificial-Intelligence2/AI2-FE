# 배포용 화면 이미지: 빌드한 화면 파일을 Caddy에 담는다. Caddy 설정(Caddyfile)은 서버의 배포 폴더(AI2-BE/deploy)에서 붙인다.
# GitHub Actions가 main에 올라올 때마다 빌드해 ghcr.io에 올린다(.github/workflows/image.yml).
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /src/dist /srv
