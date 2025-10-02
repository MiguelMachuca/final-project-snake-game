# Vuelve a usar la imagen agente SSH de Jenkins con Alpine y JDK 21 como base
FROM jenkins/ssh-agent:alpine-jdk21

# Cambiar al usuario root para instalar paquetes
USER root

# Instalar Docker CLI, Node.js, npm, Python3, make, g++ y dependencias
RUN apk update && \
    apk add --no-cache \
        docker \
        docker-cli \
        nodejs \
        npm \
        curl \
        sqlite \
        python3 \
        make \
        g++

# Instalar Docker Compose
RUN curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && \
    chmod +x /usr/local/bin/docker-compose

# AGREGAR ESTO: Crear grupo docker con GID específico y agregar usuario jenkins
# Primero eliminar el grupo docker existente si tiene GID incorrecto
RUN if getent group docker > /dev/null; then delgroup docker; fi && \
    addgroup -g 961 docker && \
    adduser jenkins docker

# Verificar las instalaciones
RUN docker --version && \
    node --version && \
    npm --version && \
    python3 --version && \
    make --version && \
    g++ --version && \
    docker-compose --version

# Verificar que jenkins está en el grupo docker
RUN id jenkins

RUN chown jenkins:jenkins /etc/environment || true
# Volver al usuario 'jenkins' por seguridad
USER jenkins
