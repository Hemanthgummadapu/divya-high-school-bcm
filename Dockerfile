FROM node:20-slim

# Install Python and pip
RUN apt-get update && apt-get install -y python3 python3-pip curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Install Python dependencies
RUN pip3 install reportlab pillow requests --break-system-packages

# Download fonts
RUN node scripts/download-fonts.js || true
RUN curl -L "https://github.com/googlefonts/noto-fonts/raw/refs/heads/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf" -o public/fonts/NotoSans-Regular.ttf || true
RUN curl -L "https://github.com/googlefonts/noto-fonts/raw/refs/heads/main/hinted/ttf/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf" -o public/fonts/NotoSansSymbols2-Regular.ttf || true

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
