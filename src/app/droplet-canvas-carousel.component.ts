import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnChanges, Input, ViewChild, ViewChildren } from '@angular/core';
import { readGcsUrlPrefix } from './choose-file.component';
import { DropletCanvasComponent, Handle, ItemData } from './droplet-canvas.component';


class ItemDataContainer {
    public data: ItemData[];
}


@Component({
  selector: 'droplet-canvas-carousel',
  templateUrl: './droplet-canvas-carousel.html',
  styleUrls: ['./droplet-canvas-carousel.component.css']
})
export class DropletCanvasCarouselComponent implements OnChanges {

    public images: Array<HTMLImageElement> = [];
    private data: Array<ItemData> = [];
    public selectedIndex: number = 0;
    private handles: Array<{center: Handle, edge: Handle}>;

    @Input() private imageWidth: number = 1920;
    @Input() private imageHeight: number = 1920;

    // @ViewChild('canvasContainer', {static: false}) private canvasContainer: ElementRef;
    @ViewChildren(DropletCanvasComponent) private thumbnailCanvases; //: QueryList<DropletCanvasComponent>;

    constructor(private http: HttpClient) {
        // let base_dir = 'assets/WP 1POPC to 2ASP pH3 19mOsm vs NaCl 208 mOsm in SQE/';
        // let file_path = base_dir + 'droplet_measurements.json';
        // this.setDataFile(file_path);
    }

    public ngOnChanges() {
        // this.thumbnailCanvases.toArray().forEach(canvas => {
        //     canvas.update();
        // });
    }

    public measurements() {
        let m = [];
        this.thumbnailCanvases.forEach(canvas => {
            m.push(canvas.measurements());
        });
        return m;
    }

    public setSelectedIndex(index: number) {
        this.selectedIndex = index;
        this.handles = this.thumbnailCanvases.toArray()[index].scaledHandles();
    }

    public selectedImage(): HTMLImageElement {
        return this.images[this.selectedIndex];
    }

    public selectedHandles(): Array<{center: Handle, edge: Handle}> {
        return this.handles;
    }

    public selectedLiveTime(): number {
        console.log('selectedLiveTime');
        if (this.thumbnailCanvases) {
            console.log('liveTime', this.thumbnailCanvases.toArray()[this.selectedIndex].liveTime);
            return this.thumbnailCanvases.toArray()[this.selectedIndex].liveTime;
        }
    }

    public updateSelectedCanvasHandles(handles: Array<{center: Handle, edge: Handle}>) {
        let selectedCanvas = this.thumbnailCanvases.toArray()[this.selectedIndex];
        selectedCanvas.setHandles(handles);
        selectedCanvas.update();
    }

    public updateSelectedCanvasLiveTime(liveTime: number) {
        let selectedCanvas = this.thumbnailCanvases.toArray()[this.selectedIndex];
        selectedCanvas.liveTime = liveTime;
    }

    public setDataFile(file_path: string) {
        // console.log('#### file_path', file_path);
        // console.log('#### gcs bucket', readGcsUrlPrefix);
        if (file_path.startsWith(readGcsUrlPrefix)) {

        }

        let base_dir = this.dirname(file_path);
        this.http.get(file_path).subscribe((data: ItemDataContainer) => {
            this.images = [];
            this.data = data.data;
            console.log('data', data.data);
            data.data.forEach(v => {
                console.log('v', v);
                let image = document.createElement('img')
                // image.src = base_dir + v['file_name'];
                console.log('image src', readGcsUrlPrefix + v['file_name']);
                image.src = readGcsUrlPrefix + v['file_name'];
                this.images.push(image);
                // console.log('images', this.images);
            });
            setTimeout((function() {
                this.data.forEach((d, thumbnailIndex) => {
                    let handles = []
                    handles.push({
                        center: new Handle(d.scale_x[0], d.scale_y[0]),
                        edge: new Handle(d.scale_x[1], d.scale_y[1]),
                    });
                    d.radii.forEach((r, dropletIndex) => {
                        handles.push({
                            center: new Handle(d.cx[dropletIndex], d.cy[dropletIndex]),
                            edge: new Handle(d.cx[dropletIndex], d.cy[dropletIndex] - d.radii[dropletIndex]),
                        });
                    });
                    let canvas = this.thumbnailCanvases.toArray()[thumbnailIndex];
                    if (canvas) {
                        canvas.setHandles(handles);
                        canvas.liveTime = d['live_time'];
                        canvas.update();
                    }
                });
            }).bind(this), 300);
        });
    }

    private dirname(filePath): string {
        return filePath.substring(0, filePath.lastIndexOf('/'));
    }
}
