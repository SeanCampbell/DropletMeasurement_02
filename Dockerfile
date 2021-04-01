# $ docker build -t lemur08/droplet-measurement:dev .
# $ docker run -p 80:4200 lemur08/droplet-measurement:dev
# $ docker push lemur08/droplet-measurement:dev

# Use an official Python runtime as a parent image.
FROM node:12.2.0

ENV PATH /app/node_modules/.bin:$PATH

# Set the working directory to /app
WORKDIR /app
COPY package.json /app/package.json
RUN npm install
RUN npm install -g @angular/cli@7.3.0
COPY . /app

# Make port 80 available to the world outside this container.
EXPOSE 4200

# start app
CMD ng serve --host 0.0.0.0
