import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, Input, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import * as Tesseract from 'tesseract.js';
import { fromEvent } from 'rxjs';
import { switchMap, takeUntil, pairwise } from 'rxjs/operators'

type Point = {'x': number, 'y': number};


export class ItemData {
    public cx: number[];
    public cy: number[];
    public radii: number[];
    public scale_x: number[];
    public scale_y: number[];
    public live_time: number;
    public file_name: string;
}


interface Droplet {
    center: Point,
    edge: Point,
};


@Component({
  selector: 'droplet-canvas',
  template: '<div><canvas #canvas></canvas></div>',
  styleUrls: ['./droplet-canvas.component.css']
})
export class DropletCanvasComponent implements AfterViewInit {

  public liveTime = 0;

  @ViewChild('canvas', {static: false}) private canvas: ElementRef;

  private ctx: CanvasRenderingContext2D;

  private activeHandle: Handle;

  private shouldAutoFindScale: boolean = false;
  private shouldAutoFindDroplets: boolean = false;
  private shouldAutoFindLiveTime: boolean = false;
  private scaleFactor: number = 2.7;
  private isReadingImage: boolean = false;
  private dropletDetectURL: string = 'http://localhost:8080';

  @Input() private imageWidth: number = 1920;
  @Input() private imageHeight: number = 1920;
  // private imageHeight: number = 1080;

  @Input() public scale = {
      value: 50,
      unit: 'um',
  };
  @Input() private isEditable: boolean = true;
  @Input() private width: number = this.imageWidth / this.scaleFactor;
  @Input() private height: number = this.imageHeight / this.scaleFactor;
  // @Input() private width: number = 1920/this.scaleFactor;
  // @Input() private height: number = 1080/this.scaleFactor;
  // @Input() private width: number = 1952/this.scaleFactor;
  // @Input() private height: number = 1952/this.scaleFactor;
  @Input() public background: HTMLImageElement;
  public handles: Array<{center: Handle, edge: Handle}>;

  constructor(private http: HttpClient) {}

  public update() {
    this.draw();
  }

  public setAutoFindScale(autoFind: boolean) {
      this.shouldAutoFindScale = autoFind;
  }

  public setAutoFindDroplets(autoFind: boolean) {
      this.shouldAutoFindDroplets = autoFind;
  }

  public setAutoFindLiveTime(autoFind: boolean) {
      this.shouldAutoFindLiveTime = autoFind;
  }

  public setIsEditable(editable: boolean) {
      this.isEditable = editable;
  }

  public setHandles(handles: Array<{center: Handle, edge: Handle}>) {
      if (handles.length != 3) {
          throw Error('Handles should have length 3.');
      }
      handles.forEach((handle, i) => {
          this.handles[i]['center'].x = this.scaleToLocal(handle['center'].x);
          this.handles[i]['center'].y = this.scaleToLocal(handle['center'].y);
          this.handles[i]['edge'].x = this.scaleToLocal(handle['edge'].x);
          this.handles[i]['edge'].y = this.scaleToLocal(handle['edge'].y);
      });
  }

  public scaledHandles(): Array<{center: Handle, edge: Handle}> {
      let handles: Array<{center: Handle, edge: Handle}> = [];
      this.handles.forEach(handle => {
          handles.push({
              center: new Handle(
                  this.scaleToGlobal(handle['center'].x), this.scaleToGlobal(handle['center'].y)),
              edge: new Handle(
                  this.scaleToGlobal(handle['edge'].x), this.scaleToGlobal(handle['edge'].y)),
          });
      });
      return handles;
  }

  public ngAfterViewInit() {
    const canvasEl: HTMLCanvasElement = this.canvas.nativeElement;
    this.ctx = canvasEl.getContext('2d');

    canvasEl.width = this.width;
    canvasEl.height = this.height;

    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = '#000';

    this.handles = [
        {center: new Handle(this.scaleToLocal(this.imageWidth - 500), this.scaleToLocal(this.imageHeight - 125)),
         edge: new Handle(this.scaleToLocal(this.imageWidth - 250), this.scaleToLocal(this.imageHeight - 125))},
        {center: new Handle(this.scaleToLocal(this.imageWidth / 2 - 500), this.scaleToLocal(this.imageHeight / 2)),
         edge: new Handle(this.scaleToLocal(this.imageWidth / 2 - 500), this.scaleToLocal(this.imageHeight / 2 - 250))},
        {center: new Handle(this.scaleToLocal(this.imageWidth / 2 + 500), this.scaleToLocal(this.imageHeight / 2)),
         edge: new Handle(this.scaleToLocal(this.imageWidth / 2 + 500), this.scaleToLocal(this.imageHeight / 2 - 250))},
    ];

    this.activeHandle = null;

    this.captureEvents(canvasEl);
    setTimeout((function() { this.update(); }).bind(this), 500);
  }

  public getDropletData() {
      function handleToCoords(handle) {
          return {
              'center': {
                  'x': handle['center'].x,
                  'y': handle['center'].y,
              },
              'edge': {
                  'x': handle['edge'].x,
                  'y': handle['edge'].y,
              },
          };
      }

      return [
          handleToCoords(this.handles[1]),
          handleToCoords(this.handles[2]),
      ];
  }

  public getScaleData() {
      return {
          'start': {
              'x': this.handles[0]['center'].x,
              'y': this.handles[0]['center'].y,
          },
          'end': {
              'x': this.handles[0]['edge'].x,
              'y': this.handles[0]['edge'].y,
          },
      };
  }

  public getImage() {
      return;
  }

  public setScaleFactor(scaleFactor: number) {
      this.scaleFactor = scaleFactor;
      this.update();
  }

  private scaleToLocal(value: number): number {
      // const scaleFactor = this.imageWidth / this.width;
      return value / this.scaleFactor;
  }

  private scaleToGlobal(value: number): number {
      // const scaleFactor = this.imageWidth / this.width;
      return value * this.scaleFactor;
  }

  private captureEvents(canvasEl: HTMLCanvasElement) {
    // this will capture all mousedown events from the canvas element
    if (!this.isEditable) {
        return;
    }
    fromEvent(canvasEl, 'mousedown')
      .pipe(
        switchMap((e: MouseEvent) => {
            const rect = canvasEl.getBoundingClientRect();
            this.activeHandle = this.getHandleAtPos(
                e.clientX - rect.left, e.clientY - rect.top);

          // after a mouse down, we'll record all mouse moves
          return fromEvent(canvasEl, 'mousemove')
            .pipe(
              // we'll stop (and unsubscribe) once the user releases the mouse
              // this will trigger a 'mouseup' event
              takeUntil(fromEvent(canvasEl, 'mouseup')),
              // we'll also stop (and unsubscribe) once the mouse leaves the canvas (mouseleave event)
              takeUntil(fromEvent(canvasEl, 'mouseleave')),
              // pairwise lets us get the previous value to draw a line from
              // the previous point to the current point
              pairwise()
            )
        })
      )
      .subscribe((res: [MouseEvent, MouseEvent]) => {
          if (this.activeHandle) {
              const rect = canvasEl.getBoundingClientRect();
              this.activeHandle.x = res[1].clientX - rect.left;
              this.activeHandle.y = res[1].clientY - rect.top;
              this.draw();
          }
      });
  }

  private draw() {
      this.drawBackground();

      this.ctx.save();
      this.ctx.strokeStyle = "rgba(0, 255, 255, 1.0)";
      this.ctx.lineWidth = 1;
      this.drawLine(this.handles[0]['center'], this.handles[0]['edge']);
      this.drawCircle(
          this.handles[1]['center'], this.handles[1]['edge']);
      this.drawCircle(
          this.handles[2]['center'], this.handles[2]['edge']);
      this.ctx.restore();
      if (this.isEditable) {
          this.drawHandles();
      }
  }

  private drawLine(startPos: { x: number, y: number }, endPos: { x: number, y: number }) {
      if (!this.ctx) { return; }

      this.ctx.beginPath();
      this.ctx.moveTo(startPos.x, startPos.y);
      this.ctx.lineTo(endPos.x, endPos.y);
      this.ctx.stroke();
  }

  private drawCircle(centerPos: Point, currentPos: Point) {
    if (!this.ctx) { return; }

    let radius = Math.sqrt(
        (currentPos.y - centerPos.y)**2 + (currentPos.x - centerPos.x)**2);

    this.ctx.beginPath();
    this.ctx.arc(centerPos.x, centerPos.y, radius, 0, Math.PI * 2, false);
    this.ctx.closePath();
    this.ctx.stroke();
  }

  private drawHandles() {
      this.ctx.save();
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      this.ctx.strokeStyle = "black";
      this.ctx.lineWidth = 1;
      this.handles[0]['center'].render(this.ctx);
      this.handles[0]['edge'].render(this.ctx);
      this.handles[1]['center'].render(this.ctx);
      this.handles[1]['edge'].render(this.ctx);
      this.handles[2]['center'].render(this.ctx);
      this.handles[2]['edge'].render(this.ctx);
      this.ctx.restore();
  }

  private drawBackground() {
      if (!this.ctx) { return; }

      this.ctx.clearRect(0, 0, this.width, this.height);
      if (this.background && this.background.complete) {
          this.ctx.drawImage(this.background, 0, 0, this.width, this.height);

          if (this.shouldAutoFindScale) {
              this.autoFindScale();
          }
          if (this.shouldAutoFindDroplets) {
              this.autoFindDroplets();
          }
          if (this.shouldAutoFindLiveTime) {
              this.readImage();
          }
      }
  }

  private getHandleAtPos(x: number, y: number) {
      const handles = [
          this.handles[0]['center'],
          this.handles[0]['edge'],
          this.handles[1]['center'],
          this.handles[1]['edge'],
          this.handles[2]['center'],
          this.handles[2]['edge'],
      ];
      for (var i = 0; i < handles.length; i++) {
          if (handles[i].contains(x, y)) {
              return handles[i];
          }
      }
      return null;
  }

  private nextFrame() {

  }

  public measurements() {
      const liveTime = this.liveTime;
      // if (this.measurements.length === 0) {
      //     this.startTimeSeconds = liveTime;
      // }

      const scale = this.getScaleData();
      const scaleLength = Math.abs(scale.end.x - scale.start.x);
      const unitsPerPixel = this.scale.value / scaleLength;

      const droplets = this.getDropletData();
      const data = this.process(droplets, unitsPerPixel);

      if (data === null) {
          // TODO: Better error handling.
          console.log('Error!');
      }

      return {
          id: '1',
          timestamp: liveTime,
          // TODO: Fix to include context.
          // adjustedTimestamp: liveTime - this.startTimeSeconds,
          adjustedTimestamp: liveTime,
          droplet1Radius: data.droplet1Radius,
          droplet1Volume: data.droplet1Volume,
          droplet2Radius: data.droplet2Radius,
          droplet2Volume: data.droplet2Volume,
          totalVolume: data.totalVolume,
          dibRadius: data.dibRadius,
          contactAngle: data.contactAngle,
          radialDistance: data.radialDistance,
      }
  }

  private dropletRadius(droplet: Droplet) {
      return Math.sqrt(
          (droplet.center.y - droplet.edge.y)**2
          + (droplet.center.x - droplet.edge.x)**2);
  }

  private volumeFromRadius(radius: number): number {
      return 4/3 * Math.PI * radius**3;
  }

  private dropletCenterDistance(droplet1, droplet2) {
      return {
          x: droplet1.center.x - droplet2.center.x,
          y: droplet1.center.y - droplet2.center.y,
      }
  }

  private process(droplets, unitsPerPixel) {
      const data = {
          droplet1Radius: 0,
          droplet2Radius: 0,
          droplet1Volume: 0,
          droplet2Volume: 0,
          totalVolume: 0,
          dibRadius: null,
          contactAngle: null,
          radialDistance: null,
      };

      let twoDroplets = true;
      let rDistance = Math.sqrt(
          ((droplets[1].center.x - droplets[0].center.x) * unitsPerPixel)**2
          + ((droplets[1].center.y - droplets[0].center.y) * unitsPerPixel)**2);

      data.droplet1Radius = this.dropletRadius(droplets[0]) * unitsPerPixel;
      data.droplet1Volume = this.volumeFromRadius(data.droplet1Radius);
      data.droplet2Radius = this.dropletRadius(droplets[1]) * unitsPerPixel;
      data.droplet2Volume = this.volumeFromRadius(data.droplet2Radius);

      // Droplets not connected.
      if (rDistance**2 >= (data.droplet1Radius + data.droplet2Radius)**2) {
          data.totalVolume = data.droplet1Volume + data.droplet2Volume;
          return data;
      }

      // TODO: What happens if one droplet's center is within the other droplet?
      if (rDistance**2 <= (data.droplet1Radius - data.droplet2Radius)**2) {
          twoDroplets = false;
      }

      let small = data.droplet1Radius;
      let big = data.droplet2Radius;
      if (small > big) {
          small = data.droplet2Radius;
          big = data.droplet1Radius;
      }

      // Circle-circle intersection.
      if (twoDroplets) {
          // lf is apparent distance, lr is distance after compensation for 3D.
          const lf = rDistance;
          const lr = Math.sqrt((big - small)**2 + rDistance**2)
          data.radialDistance = lr;

          // The following is from that droplet shape paper.
          const thetaB = Math.acos((lr**2 - (small**2 + big**2)) / (2 * small * big));
          data.dibRadius = (small * big * Math.sin(thetaB)) / lr;
          const thetaDegrees = (180 * thetaB / Math.PI) / 2;
          data.contactAngle = thetaDegrees;
          // Dr. Lee wants half of the contact angle.
          //System.out.println("New Method: " + dibRadius + ", " + Float.toString(180.0f * thetab / (float) Math.PI));

          // This is circle-circle intersection viewing from above.
          // This will cause the line denoting the circle-circle intersection to appear wrong.
          const a = (data.droplet1Radius**2 - data.droplet2Radius**2 + lr**2) / (2.0 * lr);
          const hi = Math.sqrt(data.droplet1Radius**2 - a**2);
          const b = lr - a;
          const c1h = data.droplet1Radius - a;
          const c2h = data.droplet2Radius - b;

          const dropletDistance = this.dropletCenterDistance(droplets[1], droplets[0]);

          const hx = dropletDistance.x * (a / lr) + droplets[0].center.x;
          const hy = dropletDistance.y * (a / lr) + droplets[0].center.y;

          const i1x = hx + (hi * dropletDistance.y / lr);
          const i1y = hy - (hi * dropletDistance.x / lr);
          const i2x = hx - (hi * dropletDistance.y / lr);
          const i2y = hy + (hi * dropletDistance.x / lr);
          const iDistance = Math.sqrt((i2y - i1y)**2 + (i2x - i1x)**2);
          const ia1 = Math.abs(Math.acos(a / data.droplet1Radius));
          const ia2 = Math.abs(Math.acos(b / data.droplet2Radius));
          // Source: http://stackoverflow.com/questions/3349125/circle-circle-intersection-points

          let growingVolume = this.volumeFromRadius(data.droplet1Radius);
          growingVolume -= (Math.PI * c1h * (3 * data.dibRadius**2 + c1h**2)) / 6;
          data.droplet1Volume = growingVolume;

          let shrinkingVolume = this.volumeFromRadius(data.droplet2Radius);
          shrinkingVolume -= (Math.PI * c2h * (3 * data.dibRadius**2 * c2h**2)) / 6;
          data.droplet2Volume = shrinkingVolume;

          // pi * h * (3 * dibR^2 + h^2) / 6
          let v = this.volumeFromRadius(big) + this.volumeFromRadius(small);
          // Subtract DIB overlap.
          v -= (Math.PI * c1h * (3 * data.dibRadius**2 + c1h**2)) / 6;
          v -= (Math.PI * c2h * (3 * data.dibRadius**2 + c2h**2)) / 6;
          data.totalVolume = v;
      } else {
          // Circle-surface intersection.
          if (data.droplet1Radius == data.droplet2Radius) {
              return null;
          }

          // Average center, contact angle requires concentric circles.
          const cX = (droplets[0].center.x + droplets[1].center.x) / 2;
          const cY = (droplets[0].center.y + droplets[1].center.y) / 2;
          const y = Math.sqrt(big**2 - small**2);
          const yp = -1 * (small / y);
          const theta = Math.abs(Math.atan(yp));
          data.contactAngle = 180 * theta / Math.PI

          // Dome and volume calculations.
          const hDome = big - y;
          const vDome = (Math.PI * hDome * (3 * small**2 + hDome**2)) / 6;
          data.totalVolume = this.volumeFromRadius(big) - vDome;
      }
      return data;
  }
}

export class Handle {
    Shape = {
        Square: 0,
        Circle: 1,
        Plus: 2,
    };

    size = 15;
    x = 0;
    y = 0;
    shape = this.Shape.Square;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    public contains(x, y) {
        const radius = this.size / 2;
        if (x < this.x - radius || x > this.x + radius) {
            return false;
        }
		if (y < this.y - radius || y > this.y + radius) {
            return false;
        }
		return true;
    }

    public render(ctx) {
        var radius = this.size / 2;

        switch (this.shape) {
            case this.Shape.Square:
            this.drawRect(
                ctx, this.x - radius, this.y - radius, this.size, this.size);
                break;
            case this.Shape.Circle:
                this.drawCircle(ctx, this.x, this.y, radius);
                break;
            case this.Shape.Plus:
                this.drawPlus(ctx, this.x, this.y, radius);
                break;
        }
    }

    private drawRect(ctx, x, y, width, height) {
        ctx.strokeRect(x, y, width, height);
        ctx.fillRect(x, y, width, height);
    }

    private drawCircle(ctx, x, y, radius) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2, false);
        ctx.closePath();
		ctx.fill();
    }

    private drawPlus(ctx, x, y, radius) {
        ctx.beginPath();
        ctx.moveTo(x, y - radius);
        ctx.lineTo(x, y + radius);
        ctx.moveTo(x - radius, y);
        ctx.lineTo(x + radius, y);
        ctx.stroke();
    }
}
