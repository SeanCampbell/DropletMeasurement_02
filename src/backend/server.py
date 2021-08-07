import datetime
import http.server
import json
import matplotlib.pyplot as plt
import numpy as np
import os
import PIL
import skimage.feature
import socketserver
import urllib


PORT = 8080

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
    fig, ax = plt.subplots(ncols=1, nrows=1, figsize=(width, height), dpi=dpi)
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
    processed_dir = '/Users/Sean/Documents/Programs/Projects/videos/processed/'
    now = datetime.datetime.now()
    img_file = 'frame_{}.png'.format(now.strftime('%Y%m%d-%H%M%S'))
    edges_file = 'edges_{}.png'.format(now.strftime('%Y%m%d-%H%M%S'))
    if not os.path.exists(processed_dir):
        os.makedirs(processed_dir)
    ax.imshow(edges_image(img))
    fig.savefig(os.path.join(processed_dir, edges_file), bbox_inches='tight')
    ax.imshow(final_image)
    fig.savefig(os.path.join(processed_dir, img_file), bbox_inches='tight')
    return adjusted_cx, adjusted_cy, radii


class HTTPHandler(http.server.BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        # query = urllib.parse.urlparse(self.path).query
        # print(query)
        # query_components = dict(qc.split('=') for qc in query.split('&'))
        content_length = int(self.headers['Content-Length']) # <--- Gets the size of data
        post_data = json.loads(self.rfile.read(content_length).decode('utf-8'))
        img = plt.imread(post_data['imageData'])
        img = img[:, :, :3]
        cx, cy, radii = find_circles_in_image(img);
        # cx = [300, 500]
        # cy = [400, 400]
        # radii = [100, 200]
        out = json.dumps({
            'cx': cx.tolist(),
            'cy': cy.tolist(),
            'radii': radii.tolist(),
        })

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(bytes(out, 'UTF-8'))


def main():
    with socketserver.TCPServer(('', PORT), HTTPHandler) as httpd:
        print('Serving at port', PORT)
        httpd.serve_forever()


if __name__ == '__main__':
    main()
