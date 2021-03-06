import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material';

import { ChooseFileService } from './choose-file.service';
import { DropletCanvasComponent } from './droplet-canvas.component';

interface Point {
    x: number,
    y: number,
};

interface Droplet {
    center: Point,
    edge: Point,
};

interface Measurement {
    id: string,
    timestamp: number,
    adjustedTimestamp: number,
    droplet1Radius: number,
    droplet1Volume: number,
    droplet2Radius: number,
    droplet2Volume: number,
    totalVolume: number,
    dibRadius: number,
    contactAngle: number,
    radialDistance: number,
};

const PLAY_TEXT = 'play_arrow';
const PAUSE_TEXT = 'pause';

@Component({
  selector: 'measure',
  templateUrl: './measure.component.html',
  styles: [],
})
export class MeasureComponent {
  title = 'droplet-measurement';

  private startTimeSeconds = 0;
  public units = ['um', 'mm', 'cm'];
  public measurements: Measurement[] = [];
  public fileUrl = '';

  private MEASUREMENT_HEADERS = [
      'ID', 'Time Stamp', 'Adjusted Time', 'Droplet 1 Radius',
      'Droplet 1 Volume', 'Droplet 2 Radius', 'Droplet 2 Volume',
      'Total Volume', 'DIB Radius', 'Contact Angle', 'Radial Distance'
  ];

  public displayedColumns = [
      'id', 'timestamp', 'adjustedTimestamp', 'droplet1Radius', 'droplet1Volume',
       'droplet2Radius', 'droplet2Volume', 'totalVolume', 'dibRadius', 'contactAngle',
       'radialDistance',
  ];

  @Input() public scale = {
      value: 50,
      unit: 'um',
  };
  @Input() public timeSkipSeconds = 5;
  @Input() public playPause = PLAY_TEXT;

  @ViewChild('dropletCanvas', {static: false}) public dropletCanvas: DropletCanvasComponent;
  @ViewChild('video', {static: false}) public video: ElementRef;
  @ViewChild('measurementsTable', {static: false}) public measurementsTable: MatTable<Measurement>;

  constructor(private fileService: ChooseFileService) {}

  public ngOnInit() {
      this.fileService.currentFile.subscribe(fileUrl => this.setFile(fileUrl));
  }

  public ngAfterViewInit() {
      this.dropletCanvas.setBackground(this.video.nativeElement);
      this.video.nativeElement.addEventListener('timeupdate', (function() {
          this.dropletCanvas.update();
      }).bind(this));
      this.video.nativeElement.currentTime = 0.01;
      this.video.nativeElement.crossOrigin = "Anonymous";
  }

  public setAutoFindScale(event) {
      this.dropletCanvas.setAutoFindScale(event.checked);
      this.dropletCanvas.update();
  }

  private setFile(fileUrl: string) {
      this.fileUrl = fileUrl;
  }

  public skipForward() {
      this.video.nativeElement.currentTime += this.timeSkipSeconds;
  }

  public stepForward() {
      this.video.nativeElement.currentTime += 0.01;
  }

  public skipBackward() {
      this.video.nativeElement.currentTime -= this.timeSkipSeconds;
  }

  public stepBackward() {
      this.video.nativeElement.currentTime -= 0.01;
  }
  private commit() {
      const liveTime = this.dropletCanvas.liveTime;
      if (this.measurements.length === 0) {
          this.startTimeSeconds = liveTime;
      }

      const scale = this.dropletCanvas.getScaleData();
      const scaleLength = Math.abs(scale.end.x - scale.start.x);
      const unitsPerPixel = this.scale.value / scaleLength;

      const droplets = this.dropletCanvas.getDropletData();
      const data = this.process(droplets, unitsPerPixel);

      if (data === null) {
          // TODO: Better error handling.
          console.log('Error!');
      }

      this.measurements.push({
          id: '1',
          timestamp: liveTime,
          adjustedTimestamp: liveTime - this.startTimeSeconds,
          droplet1Radius: data.droplet1Radius,
          droplet1Volume: data.droplet1Volume,
          droplet2Radius: data.droplet2Radius,
          droplet2Volume: data.droplet2Volume,
          // TODO: real numbers.
          totalVolume: data.totalVolume,
          dibRadius: data.dibRadius,
          contactAngle: data.contactAngle,
          radialDistance: data.radialDistance,
      })
      this.measurementsTable.renderRows();
  }

  private measurementToColumns(m: Measurement): (string|number)[] {
      return [
          m.id, m.timestamp, m.adjustedTimestamp,
          m.droplet1Radius, m.droplet1Volume,
          m.droplet2Radius, m.droplet2Volume,
          m.totalVolume, m.contactAngle, m.radialDistance,
      ];
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

  public commitAndNext() {
      this.commit();
      this.skipForward();
  }

  private generateCsv() {
      let csvRows = this.measurements.map(m => this.measurementToColumns(m));
      csvRows.unshift(this.MEASUREMENT_HEADERS);
      const csvContent = 'data:text/csv;charset=utf-8,'
            + csvRows.map(e => e.join(',')).join('\n');
      return csvContent;
  }

  public downloadCsv() {
      const csvContent = this.generateCsv();
      const encodedUri = encodeURI(csvContent);
      let link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', this.csvForFile(this.fileUrl));
      //document.body.appendChild(link);
      link.click();
  }

  private csvForFile(filePath): string {
      return filePath.split(/[\/\\]/).pop().split('.').shift() + '.csv';
  }

  public togglePlayPause() {
      if (this.playPause === PLAY_TEXT) {
          this.video.nativeElement.play();
          this.playPause = PAUSE_TEXT;
      } else {
          this.video.nativeElement.pause();
          this.playPause = PLAY_TEXT;
      }
  }
}
