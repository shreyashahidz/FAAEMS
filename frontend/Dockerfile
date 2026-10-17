FROM nginx:1.27-alpine

# Static site — no build step (no Node/Vite). Files are copied by name
# rather than `COPY . .` so build-only files (Dockerfile, nginx.conf,
# .dockerignore) never end up served from the site root.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html aiml-department.html app.js api.js config.js criterion6_kb.js styles.css /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets

EXPOSE 80
