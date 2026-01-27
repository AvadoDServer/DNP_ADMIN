FROM --platform=linux/amd64 node:16-bookworm-slim as build-deps-adminui
RUN echo "====================Building Admin website===================="
WORKDIR /usr/src/app
COPY build/src/package.json ./
COPY build/src/yarn.lock ./
RUN yarn 
COPY build/src .
RUN rm -f /etc/apt/apt.conf.d/docker-clean && apt-get update -o Acquire::Check-Valid-Until=false -o Acquire::AllowInsecureRepositories=true && apt-get --yes install git jq --allow-unauthenticated
ADD .git .git
ADD dappnode_package.json .
RUN ./getVersionData.sh
RUN NODE_OPTIONS="--max-old-space-size=4048" yarn run build
RUN echo "====================Finished building Admin website===================="

FROM --platform=linux/amd64 nginx:1.23.1-alpine
RUN mkdir -p /usr/www/adminui 
COPY --from=build-deps-adminui /usr/src/app/build /usr/www/adminui
COPY build/nginx.conf /etc/nginx/nginx.conf

RUN apk add --no-cache nodejs-current npm docker

# Launch command
COPY build/launchcmd /launchcmd
WORKDIR /launchcmd
RUN npm i

# entrypoint
COPY build/entrypoint.sh /usr/src/app/entrypoint.sh
RUN chmod +x /usr/src/app/entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/usr/src/app/entrypoint.sh"]