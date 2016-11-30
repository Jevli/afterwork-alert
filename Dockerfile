FROM node:alphine
RUN groupadd -r node && useradd -r -g node node
CMD ["npm","run", "prod"]
