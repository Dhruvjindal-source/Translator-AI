FROM node:18-alpine

WORKDIR /app

# Copy package.json first
COPY package.json ./

# Install dependencies including dev dependencies
RUN npm install --include=dev

# Copy configuration files
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY vite.config.js ./

# Copy all application files
COPY . .

# Ensure Tailwind can process files
RUN npx tailwindcss init -p || true

EXPOSE 5173

# Run dev server with host flag for Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]