FROM node:22-alpine

LABEL org.opencontainers.image.title="amdy-cli" \
      org.opencontainers.image.description="Minimal CLI for the AMDY Answering Machine Detection API" \
      org.opencontainers.image.source="https://github.com/nikvb/amdy-api-sdks"

COPY amdy-cli.js /usr/local/bin/amdy-cli
RUN chmod +x /usr/local/bin/amdy-cli && ln -s /usr/local/bin/amdy-cli /usr/local/bin/amdy-cli.js

ENTRYPOINT ["amdy-cli"]
