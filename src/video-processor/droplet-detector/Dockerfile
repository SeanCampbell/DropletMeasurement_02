# Use an official Python runtime as a parent image.
FROM python:3.7

# Set the working directory to /app
WORKDIR /app
COPY . /app

RUN apt-get update
RUN apt-get install -y ffmpeg tesseract-ocr

RUN pip3 install -r requirements.txt

# start app
CMD ["python3", "/app/main.py"]
