FROM node:latest
USER node
WORKDIR /home/node
RUN git clone https://github.com/Jevli/afterwork-alert.git && cd afterwork-alert && npm install
WORKDIR /home/node/afterwork-alert
# Alla kopioidaan config json, mutta se ei ole varmaan validi vaihtoehto oikeasti
COPY ./config.json ./
CMD npm run prod
