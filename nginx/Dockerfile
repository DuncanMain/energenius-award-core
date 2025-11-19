FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create directories for certbot
RUN mkdir -p /var/www/certbot && \
    mkdir -p /etc/letsencrypt

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]

