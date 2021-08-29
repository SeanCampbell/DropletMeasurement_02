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
import numpy as np
import os
import PIL
import pytesseract
import skimage.feature
import socketserver
import subprocess
import sys


from google.cloud.video.transcoder_v1beta1.services.transcoder_service import TranscoderServiceClient

logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logger = logging.getLogger()


app = flask.Flask(__name__)

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.environ.get(
    'GOOGLE_APPLICATION_CREDENTIALS',
    '/app/droplet-measurement-309203-97fd001d423f.json')

def edges_image(img, sigma=25, low_threshold=0.9, high_threshold=0.95):
    gray_img = img
    if gray_img.shape[-1] == 3:
        gray_img = gray_img[:,:,0]
    return skimage.feature.canny(
        gray_img,
        sigma=sigma,
        low_threshold=low_threshold,
        high_threshold=high_threshold,
        use_quantiles=True)


def add_padding(img, width, height):
    img_height = len(img)
    img_width = len(img[0])
    padding_height = (height - img_height) / 2
    padding_width = (width - img_width) / 2
    start_top = int(padding_height)
    end_top = int(img_height + padding_height)
    start_left = int(padding_width)
    end_left = int(img_width + padding_width)
    if len(img.shape) == 2:
        resized = np.empty([height, width])
        resized[start_top:end_top, start_left:end_left] = img
    elif len(img.shape) == 3:
        resized = np.empty([height, width, 3])
        resized[start_top:end_top, start_left:end_left, :] = img
    return resized


def remove_padding(img, width, height):
    img_height = len(img)
    img_width = len(img[0])
    padding_height = (img_height - height) / 2
    padding_width = (img_width - width) / 2
    start_top = int(padding_height)
    end_top = int(height + padding_height)
    start_left = int(padding_width)
    end_left = int(width + padding_width)
    if len(img.shape) == 2:
        resized = img[start_top:end_top, start_left:end_left]
    elif len(img.shape) == 3:
        resized = img[start_top:end_top, start_left:end_left, :]
    return resized


def draw_circles(img, cy, cx, radii, color=(0.9, 0.08, 0.08)):
    for center_y, center_x, radius in zip(cy, cx, radii):
        circy, circx = skimage.draw.circle_perimeter(center_y, center_x, radius)
        img[circy, circx] = color


def convert_to_black_and_white(img, threshold=0.5):
    f = np.vectorize(lambda v: 255 if v < threshold else 0)
    return f(img)


def find_circles(img, possible_radii=np.arange(150, 400, 10)):
    hough_res = skimage.transform.hough_circle(img, possible_radii)
    accums, cx, cy, radii = skimage.transform.hough_circle_peaks(
        hough_res, possible_radii, total_num_peaks=2, min_xdistance=10, min_ydistance=10)
    return cx, cy, radii


def find_circles_in_image(img):
    prep_fn, unprep_fn = remove_padding, add_padding
    # prep_fn, unprep_fn = add_padding, remove_padding
    # padded_height, padded_width = (2000, 1100)
    # padded_height, padded_width = (2000, 2000)
    # padded_height, padded_width = (1500, 1500)
    # padded_height, padded_width = (1000, 1000)
    padded_height, padded_width = (850, 850)
    resized = prep_fn(img, padded_width, padded_height)
    dpi = 96
    width = len(img[0]) / dpi
    height = len(img) / dpi
    # fig, ax = plt.subplots(ncols=1, nrows=1, figsize=(width, height), dpi=dpi)
    resized_edges = prep_fn(edges_image(img), padded_width, padded_height)
    cx, cy, radii = find_circles(resized_edges)
    # final_image = resized_edges
    final_image = img
    if len(final_image.shape) == 2:
      final_image = np.expand_dims(final_image, axis=-1) * np.ones([len(final_image), len(final_image[0]), 3])
    adjusted_cx = cx - (padded_width - len(img[0])) // 2
    adjusted_cy = cy - (padded_height - len(img)) // 2
    draw_circles(final_image, adjusted_cy, adjusted_cx, radii)
    # draw_all_circles(final_image)
    # processed_dir = os.path.join(os.path.dirname(img_dir), 'processed')

    # processed_dir = '/Users/Sean/Documents/Programs/Projects/videos/processed/'
    # now = datetime.datetime.now()
    # img_file = 'frame_{}.png'.format(now.strftime('%Y%m%d-%H%M%S'))
    # edges_file = 'edges_{}.png'.format(now.strftime('%Y%m%d-%H%M%S'))
    # if not os.path.exists(processed_dir):
        # os.makedirs(processed_dir)
    # ax.imshow(edges_image(img))
    # fig.savefig(os.path.join(processed_dir, edges_file), bbox_inches='tight')
    # ax.imshow(final_image)
    # fig.savefig(os.path.join(processed_dir, img_file), bbox_inches='tight')
    return adjusted_cx, adjusted_cy, radii


def find_scale_in_image(img):
    threshold = 180
    threshold = threshold if np.max(img) > 1.0 else threshold / 255
    x0, y0, x1, y1 = 0, 0, 0, 0
    found = False
    for i in range(img.shape[1]-1, int(img.shape[1]/2), -1):
      for j in range(img.shape[0]-1, int(img.shape[0]/2), -1):
        if (img[j, i] > threshold).all():
            found = True
            x0, y0 = i, j
            m = img[j, i]
            while (img[j, i] > threshold).all():
                i -= 1
            # We went one over.
            i += 1
            x1, y1 = i, j
            break
      if found:
        break
    return [x0, x1], [y0, y1]


def find_live_time_in_image(img):
    # img = PIL.Image.fromarray(np.uint8(img)*255)
    # image_text = pytesseract.image_to_string(img)
    # lines = [v.split(':', 1) for v in image_text.split('\n')]
    # live_time = dict([(v[0], v[1].strip()) for v in lines if len(v) == 2])['Live Time']
    # live_time_segments = live_time.split('.')[0].split(':')
    # live_time_seconds = (
    #     int(live_time_segments[0]) * 3600 +
    #     int(live_time_segments[1]) * 60 +
    #     int(live_time_segments[2]))
    # return live_time_seconds
    return 0


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
        cx, cy, radii = find_circles_in_image(img);
        live_time = find_live_time_in_image(img)
        scale_x, scale_y = find_scale_in_image(img)
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


def handle_cloud_pubsub_message(pubsub_message):
    try:
        data = {}
        if isinstance(pubsub_message, dict) and 'data' in pubsub_message:
            data = json.loads(base64.b64decode(pubsub_message['data']).decode('utf-8').strip())

        print(f'Data: {data}')
        job_state = data.get('job', {}).get('state')
        if not job_state == 'SUCCEEDED':
            logging.info(f'Job had state {job_state}. Nothing to do.')
            return f'Job had state {job_state}. Nothing to do.', 200

        logger.info('Job succeeded! Continuing...')

        client = TranscoderServiceClient()
        logger.info('Created client')
        response = client.get_job(name=data.get('job').get('name'))
        img_dir = response.config.output.uri
        logging.info(f'Processing images from {img_dir}')
        # img_dir = 'processed/WP 1POPC to 2ASP pH3 19mOsm vs NaCl 208 mOsm in SQE/'
        bucket_name = 'droplet-measurement-processed-public'
        bucket_prefix = 'gs://{}/'.format(bucket_name)
        relative_img_dir = img_dir
        if img_dir.startswith(bucket_prefix):
            relative_img_dir = img_dir[len(bucket_prefix):]
        logging.info(f'Relative image dir {relative_img_dir}')
        logger.info('Processing images...')
        process_images_from_cloud_bucket(bucket_name, relative_img_dir)
    except Exception as e:
        logger.exception(e)
    return '', 204


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
        cx, cy, radii = find_circles_in_image(img);
        live_time = find_live_time_in_image(img)
        scale_x, scale_y = find_scale_in_image(img)
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


def process_video(message):
    start_time = message.get('start_time', '00:00:22')
    interval = message.get('interval', 7)
    video_file_path = message.get('video_file_path')
    video_file_dir = os.path.dirname(video_file_path)
    video_file_name = os.path.basename(video_file_path).split('.')[0]
    destination_dir = os.path.join(video_file_dir, video_file_name)
    if not os.path.exists(destination_dir):
        os.makedirs(destination_dir)
    subprocess.run(['ffmpeg', '-ss', start_time, '-i', video_file_path, '-vf', 'fps=0.1', f'{destination_dir}/frame_%03d.jpeg', '-force_key_frames', f'"expr:gte(t,n_forced*{interval/2})"'])


'''
curl -H "Content-Type: application/json" \
     -d '{ "message": { "video_file_path": "/Users/Sean/Documents/Programs/Projects/videos/WP 1POPC to 2ASP pH3 19mOsm vs NaCl 208 mOsm in SQE.30C018.mp4" } }' \
     localhost:8080

curl -H "Content-Type: application/json" \
     -d '{ "message": { "video_file_path": "/Users/Sean/Documents/Programs/Projects/videos/wp 25c sopc 178 SQE002" } }' \
     localhost:8080

curl -H "Content-Type: application/json" \
     -d '{ "message": { "video_file_path": "/Users/Sean/Documents/Programs/Projects/videos/wp 25c sopc 178 SQE002" } }' \
     localhost:8080
'''
def handle_local_message(message):
    # process_video(message)
    video_file_path = message.get('video_file_path')
    video_file_dir = os.path.dirname(video_file_path)
    video_file_name = os.path.basename(video_file_path).split('.')[0]
    destination_dir = os.path.join(video_file_dir, video_file_name)

    if video_file_path.startswith('gs://'):
        bucket_name = ''
        img_dir = ''
        # process_images_from_cloud_bucket(bucket_name, img_dir)
    else:
        process_local_images(destination_dir)
    return '', 204


@app.route('/', methods=['POST'])
def handle_notification():
    logger.info('Handling notification...')
    envelope = flask.request.get_json()
    if not envelope:
        msg = 'no Pub/Sub message received'
        return f'Bad Request: {msg}', 400

    if not isinstance(envelope, dict) or 'message' not in envelope:
        msg = 'invalid Pub/Sub message format'
        return f'Bad Request: {msg}', 400

    pubsub_message = envelope['message']

    if pubsub_message.get('video_file_path'):
        return handle_local_message(pubsub_message)
    return handle_cloud_pubsub_message(pubsub_message)


if __name__ == '__main__':
    # bucket_name = 'droplet-measurement-processed-public'
    # img_dir = 'gs://droplet-measurement-processed-public/processed/wp 25c sopc 178 SQE002'
    # process_images_from_cloud_bucket(bucket_name, img_dir)

    port = int(os.environ.get('PORT', 8080))
    logger.info('Listening on port %d', port)
    app.run(debug=True, host='0.0.0.0', port=port)
