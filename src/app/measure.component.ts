import { Component, ElementRef, Inject, Input, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatTable } from '@angular/material';

import { ChooseFileService } from './choose-file.service';
import { DropletCanvasComponent } from './droplet-canvas.component';
import { DropletCanvasCarouselComponent } from './droplet-canvas-carousel.component';

export interface DialogData {
    displayedColumns: string[];
    measurements: Measurement[];
}

interface Point {
    x: number,
    y: number,
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

@Component({
  selector: 'measurements-table-dialog',
  templateUrl: 'measurements-table.html',
})
export class MeasurementsTableDialog {
    constructor(public dialogRef: MatDialogRef<MeasurementsTableDialog>,
                @Inject(MAT_DIALOG_DATA) public data: DialogData) {}
}


@Component({
  selector: 'measure',
  templateUrl: './measure.component.html',
  styles: [],
})
export class MeasureComponent {
  title = 'droplet-measurement';

  private image: HTMLImageElement;

  private startTimeSeconds = 0;
  public units = ['um', 'mm', 'cm'];
  public measurements: Measurement[] = [];
  public fileUrl = '';

  @Input() imageWidth: number = 1920;
  @Input() imageHeight: number = 1920;

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

  @ViewChild('dropletCanvas', {static: false}) public dropletCanvas: DropletCanvasComponent;
  @ViewChild('canvasCarousel', {static: false}) public canvasCarousel: DropletCanvasCarouselComponent;
  // @ViewChild('measurementsTable', {static: false}) public measurementsTable: MatTable<Measurement>;
  // @ViewChild('measurementsTableDialog', {static: false}) public measurementsTable: MatDialog;

  constructor(private fileService: ChooseFileService, private dialog: MatDialog) {}

  public ngOnInit() {}

  public ngAfterViewInit() {
      this.fileService.currentFile.subscribe(fileUrl => this.setFile(fileUrl));
      this.fileService.currentFile.subscribe(fileUrl => this.canvasCarousel.setDataFile(fileUrl));

      // this.image = document.createElement('img');
      // this.image.src = 'assets/WP 1POPC to 2ASP pH3 19mOsm vs NaCl 208 mOsm in SQE/frame_001.jpeg';

      // this.dropletCanvas.setBackground(this.image.nativeElement);
      // this.dropletCanvas.setBackground(this.image);
      // this.dropletCanvas.background = this.image;  // Uncomment this
      // this.dropletCanvas.setBackground(this.video.nativeElement);
      // this.video.nativeElement.addEventListener('timeupdate', (function() {
      //     this.dropletCanvas.update();
      // }).bind(this));
      // this.video.nativeElement.currentTime = 0.01;
      // this.video.nativeElement.crossOrigin = "Anonymous";
  }

  public setAutoFindScale(event) {
      this.dropletCanvas.setAutoFindScale(event.checked);
      this.dropletCanvas.update();
  }

  public selectImage() {
      if (this.dropletCanvas) {
          this.dropletCanvas.setHandles(this.canvasCarousel.selectedHandles());
          this.dropletCanvas.liveTime = this.canvasCarousel.selectedLiveTime();
          this.dropletCanvas.update();
      }
  }

  private setFile(fileUrl: string) {
      this.fileUrl = fileUrl;
  }

  public commit() {
      this.canvasCarousel.updateSelectedCanvasHandles(this.dropletCanvas.scaledHandles());
      this.canvasCarousel.updateSelectedCanvasLiveTime(this.dropletCanvas.liveTime);
  }

  public zoom(scaleFactor: number) {
      this.dropletCanvas.setScaleFactor(scaleFactor);
  }

  private generateCsv() {
      let csvRows = this.canvasCarousel.measurements().map(m => this.measurementToColumns(m));
      csvRows.unshift(this.MEASUREMENT_HEADERS);
      const csvContent = 'data:text/csv;charset=utf-8,'
            + csvRows.map(e => e.join(',')).join('\n');
      return csvContent;
  }

  public viewResults() {
      const dialogRef = this.dialog.open(MeasurementsTableDialog, {
          data: {
              displayedColumns: this.displayedColumns,
              measurements: this.canvasCarousel.measurements(),
          },
      });
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

  private measurementToColumns(m: Measurement): (string|number)[] {
      return [
          m.id, m.timestamp, m.adjustedTimestamp,
          m.droplet1Radius, m.droplet1Volume,
          m.droplet2Radius, m.droplet2Volume,
          m.totalVolume, m.contactAngle, m.radialDistance,
      ];
  }

  private csvForFile(filePath): string {
      return filePath.split(/[\/\\]/).pop().split('.').shift() + '.csv';
  }
}
