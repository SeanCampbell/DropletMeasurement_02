import { Component, Input, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import * as Tesseract from 'tesseract.js';
import { fromEvent } from 'rxjs';
import { switchMap, takeUntil, pairwise } from 'rxjs/operators'

type Point = {'x': number, 'y': number};

@Component({
  selector: 'droplet-canvas',
  template: '<canvas #canvas></canvas>',
  styles: ['canvas { border: 1px solid #000; }']
})
export class DropletCanvasComponent implements AfterViewInit {

  public liveTime = 0;

  @ViewChild('canvas', {static: false}) private canvas: ElementRef;

  @Input() private width = 1920/2;
  @Input() private height = 1080/2;
  @Input() private background: HTMLVideoElement;

  private ctx: CanvasRenderingContext2D;

  private handles: Array<{center: Handle, edge: Handle}>;
  private activeHandle: Handle;

  private shouldAutoFindScale: boolean;
  private isReadingImage = false;;

  public setBackground(background: HTMLVideoElement) {
    this.background = background;
  }

  public update() {
    this.draw();
  }

  public setAutoFindScale(autoFind: boolean) {
      this.shouldAutoFindScale = autoFind;
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
        {center: new Handle(this.width - 200, this.height - 50),
         edge: new Handle(this.width - 100, this.height - 50)},
        {center: new Handle(this.width / 2 - 200, this.height / 2),
         edge: new Handle(this.width / 2 - 200, this.height / 2 - 100)},
        {center: new Handle(this.width / 2 + 200, this.height / 2),
         edge: new Handle(this.width / 2 + 200, this.height / 2 - 100)},
    ];

    this.activeHandle = null;

    this.captureEvents(canvasEl);
    this.update();
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

  private readImage() {
    const liveTimeRegexp = /.*Live Time: ([\d\.]+)/;

    if (!this.isReadingImage) {
        const self = this;
        this.isReadingImage = true;
        Tesseract.recognize(
            this.canvas.nativeElement, 'eng',
            {
                logger: m => console.log(m),
                //rectangle: { left: 0, top:400, width: 200, height: 200 },
            }
        ).then((r) => {
            const liveTimeMatches = liveTimeRegexp.exec(r.data.text);
            console.log('liveTimeMatches', liveTimeMatches);
            if (liveTimeMatches && liveTimeMatches.length > 1) {
                console.log(liveTimeMatches[1]);
                this.liveTime = parseFloat(liveTimeMatches[1]);
            }
            self.isReadingImage = false;
        });
    }
  }

  private autoFindScale() {
      // Manipulating video image reference:
      // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Manipulating_video_using_canvas
      const searchAreaSize = 300;
      const threshold = 50;
      const frame = this.ctx.getImageData(
          this.width - searchAreaSize, this.height - searchAreaSize,
          searchAreaSize, searchAreaSize);
      const frameSize = frame.data.length / 4;
      for (let i = frameSize; i > 0; i--) {
          let r = frame.data[i * 4 + 0];
          let g = frame.data[i * 4 + 1];
          let b = frame.data[i * 4 + 2];
          if (r < threshold && g < threshold && b < threshold) {
              const xOffset = this.width - searchAreaSize;
              const yOffset = this.height - searchAreaSize;
              this.handles[0]['edge'].x = xOffset + (i % searchAreaSize);
              this.handles[0]['edge'].y = yOffset + (i / searchAreaSize);

              while (r < threshold && g < threshold && b < threshold) {
                  i--;
                  r = frame.data[i * 4 + 0];
                  g = frame.data[i * 4 + 1];
                  b = frame.data[i * 4 + 2];
              }
              // We went one over.
              i++;

              this.handles[0]['center'].x = xOffset + (i % searchAreaSize);
              this.handles[0]['center'].y = yOffset + (i / searchAreaSize);
              break;
          }
      }
  }

  private captureEvents(canvasEl: HTMLCanvasElement) {
    // this will capture all mousedown events from the canvas element
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
      this.drawHandles();
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
      if (this.background) {
          this.ctx.drawImage(this.background, 0, 0, this.width, this.height);

          if (this.shouldAutoFindScale) {
              this.autoFindScale();
          }
          this.readImage();
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
}

class Handle {
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
