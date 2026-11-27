# Match the OS and OCR package versions from successful validation run #27.
FROM node:22-bookworm-slim AS node
FROM ubuntu:26.04
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates python3 libstdc++6 \
    tesseract-ocr=5.5.0-1build1 \
    libtesseract5=5.5.0-1build1 \
    tesseract-ocr-eng=1:4.1.0-2build1 \
    tesseract-ocr-kor=1:4.1.0-2build1 \
    tesseract-ocr-osd=1:4.1.0-2build1 \
    python3-pil=12.1.1-2ubuntu1.6 \
    && rm -rf /var/lib/apt/lists/*
RUN node --version && tesseract --version && tesseract --list-langs \
    && /usr/bin/python3 -c 'import PIL; print(PIL.__version__)'
WORKDIR /workspace
