# Use an official Python runtime as a parent image.
# docker run -it -v ${PWD}:/app -v /app/node_modules -p 4201:4200 --rm example:dev
# docker build -t example:dev .
# docker run -it -v ${PWD}:/app -v /app/node_modules -p 80 --rm example:dev
FROM node:12.2.0

ENV PATH /app/node_modules/.bin:$PATH

# Set the working directory to /app
WORKDIR /app
COPY package.json /app/package.json
RUN npm install
RUN npm install -g @angular/cli@7.3.0
COPY . /app

# Make port 80 available to the world outside this container.
EXPOSE 80

# Run main.py when the container launches.
CMD ng serve --host 0.0.0.0

# install and cache app dependencies
COPY package.json /app/package.json
RUN npm install
RUN npm install -g @angular/cli@7.3.9

# add app
COPY . /app

# start app
CMD ng serve --host 127.0.0.1 --port 80
