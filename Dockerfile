FROM node:20-slim

RUN apt-get update && apt-get install -y python3 python3-pip curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY scripts/ ./scripts/
COPY public/ ./public/

RUN npm ci

COPY . .

RUN pip3 install reportlab pillow requests pypdf --break-system-packages

RUN mkdir -p public/fonts && \
    curl -L "https://github.com/googlefonts/noto-fonts/raw/refs/heads/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf" -o public/fonts/NotoSans-Regular.ttf || true && \
    curl -L "https://github.com/googlefonts/noto-fonts/raw/refs/heads/main/hinted/ttf/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf" -o public/fonts/NotoSansSymbols2-Regular.ttf || true && \
    curl -L "https://github.com/googlefonts/noto-fonts/raw/refs/heads/main/hinted/ttf/NotoSansMath/NotoSansMath-Regular.ttf" -o public/fonts/NotoSansMath-Regular.ttf || true

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
