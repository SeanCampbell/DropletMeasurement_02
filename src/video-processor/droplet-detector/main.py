import base64
import datetime
import flask
import glob
from google.cloud import storage
import http.server
import io
import json
import logging
import matplotlib.pyplot as plt
import os
import socketserver
import subprocess
import sys

import image


logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logger = logging.getLogger()


app = flask.Flask(__name__)

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.environ.get(
    'GOOGLE_APPLICATION_CREDENTIALS',
    '/app/droplet-measurement-309203-bb935e6a8a65.json')


def process_images_from_cloud_bucket(bucket_name, img_dir):
    extension = 'jpeg'
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)

    droplet_data = {
        'base_dir': img_dir,
        'data': [],
    }
    for blob in storage_client.list_blobs(bucket_name, prefix=img_dir):
        logger.info('Processing image %s', blob.name)
        if not blob.name.endswith(extension):
            continue
        img = plt.imread(io.BytesIO(blob.download_as_bytes()), format='jpeg')
        img = img.copy()
        img = img[:, :, :3]
        cx, cy, radii = image.find_circles_in_image(img);
        live_time = image.find_live_time_in_image(img)
        scale_x, scale_y = image.find_scale_in_image(img)
        data = {
            'file_name': blob.name,
            'live_time': live_time,
            'cx': cx.tolist(),
            'cy': cy.tolist(),
            'radii': radii.tolist(),
            'scale_x': scale_x,
            'scale_y': scale_y,
        }
        droplet_data['data'].append(data)
        logger.info('Measurements: %s', data)

    data_file_name = 'droplet_measurements.json'
    data_file_path = os.path.join('/tmp', data_file_name)
    with open(data_file_path, 'w') as f:
        f.write(json.dumps(droplet_data))

    logger.info('Wrote data to %s', data_file_path)
    destination_name = os.path.join(img_dir, data_file_name)
    blob = bucket.blob(destination_name)
    blob.upload_from_filename(data_file_path)
    logger.info('Uploaded data to %s', destination_name)


def process_local_images(img_dir):
    extensions = ['jpeg', 'png']

    droplet_data = {
        'base_dir': img_dir,
        'data': [],
    }
    all_images = []
    matches = [glob.glob(f'{img_dir}/*.{extension}') for extension in extensions]
    for m in matches:
        all_images.extend(m)
    for image in all_images:
        logger.info('Processing image %s', image)
        img = plt.imread(image)
        img = img.copy()
        img = img[:, :, :3]
        cx, cy, radii = image.find_circles_in_image(img);
        live_time = image.find_live_time_in_image(img)
        scale_x, scale_y = image.find_scale_in_image(img)
        data = {
            'file_name': image,
            'live_time': live_time,
            'cx': cx.tolist(),
            'cy': cy.tolist(),
            'radii': radii.tolist(),
            'scale_x': scale_x,
            'scale_y': scale_y,
        }
        droplet_data['data'].append(data)
        logger.info('Measurements: %s', data)

    data_file_name = 'droplet_measurements.json'
    data_file_path = os.path.join(img_dir, data_file_name)
    with open(data_file_path, 'w') as f:
        f.write(json.dumps(droplet_data))

    logger.info('Wrote data to %s', data_file_path)


# TODO: Maybe delete this
# def process_video(message):
#     start_time = message.get('start_time', '00:00:22')
#     interval = message.get('interval', 7)
#     video_file_path = message.get('video_file_path')
#     video_file_dir = os.path.dirname(video_file_path)
#     video_file_name = os.path.basename(video_file_path).split('.')[0]
#     destination_dir = os.path.join(video_file_dir, video_file_name)
#     if not os.path.exists(destination_dir):
#         os.makedirs(destination_dir)
#     subprocess.run(['ffmpeg', '-ss', start_time, '-i', video_file_path, '-vf', 'fps=0.1', f'{destination_dir}/frame_%03d.jpeg', '-force_key_frames', f'"expr:gte(t,n_forced*{interval/2})"'])


@app.route('/', methods=['POST'])
def handle_notification():
    required_fields = ['dir_path']

    logger.info('Handling notification...')
    message = flask.request.get_json()
    if not message:
        msg = 'no message received'
        return f'Bad Request: {msg}', 400

    if not isinstance(message, dict):
        msg = 'invalid message format'
        return f'Bad Request: {msg}', 400

    for field in required_fields:
        if not field in message:
            msg = f'missing required field `{field}`'
            return f'Bad Request: {msg}', 400

    if message.get('bucket'):
        logger.info('Processing images in bucket %s at path %s',
                    message['bucket'], message['dir_path'])
        process_images_from_cloud_bucket(message['bucket'], message['dir_path'])
    else:
        logger.info('Processing local images in bucket at path %s',
                    message['dir_path'])
        process_local_images(message['dir_path'])
    return 'Success!'


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    logger.info('Listening on port %d', port)
    app.run(debug=True, host='0.0.0.0', port=port)
