# Usa Node.js (necessario per Claude Code) su Linux leggero
FROM node:20-slim

# Installa strumenti base: git, python, e dos2unix (fondamentale per chi usa Windows!)
# dos2unix serve perché i file creati su Windows spesso rompono gli script Linux
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    python3-pip \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

# Installa Claude Code (lo strumento ufficiale CLI)
RUN npm install -g @anthropic-ai/claude-code

# Imposta la cartella di lavoro predefinita
WORKDIR /workspace

# Comando di avvio: apre una shell bash
CMD ["bash"]