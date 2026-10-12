FROM node:20-slim

# WeasyPrint lays the question papers out; it renders text through Pango and
# HarfBuzz, which is what shapes Telugu conjuncts and Devanagari vowel signs.
RUN apt-get update && apt-get install -y \
      python3 python3-pip poppler-utils \
      libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libcairo2 \
      libgdk-pixbuf-2.0-0 libffi-dev shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir --break-system-packages -r requirements.txt

COPY package*.json ./
COPY scripts/ ./scripts/
COPY public/ ./public/

RUN npm ci

COPY . .

RUN test -f public/fonts/NotoSans-Regular.ttf && \
    test -f public/fonts/NotoSansTelugu-Regular.ttf && \
    test -f public/fonts/NotoSansSymbols2-Regular.ttf && \
    test -f public/fonts/NotoSansMath-Regular.ttf && \
    test -f public/fonts/PlayfairDisplay-Bold.ttf && \
    test -f public/fonts/OFL.txt && \
    test -f public/fonts/SHA256SUMS && \
    node scripts/download-fonts.js

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
