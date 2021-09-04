import { NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HttpClientJsonpModule } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';

import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule, Routes } from '@angular/router';


import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { ChooseFileComponent } from './choose-file.component';
import { ChooseFileService } from './choose-file.service';
import { DropletCanvasComponent } from './droplet-canvas.component';
import { DropletCanvasCarouselComponent } from './droplet-canvas-carousel.component';
import { MeasureComponent, MeasurementsTableDialog } from './measure.component';

@NgModule({
  declarations: [
    AppComponent,
    ChooseFileComponent,
    DropletCanvasComponent,
    DropletCanvasCarouselComponent,
    MeasureComponent,
    MeasurementsTableDialog,
  ],
  imports: [
    AppRoutingModule,
    BrowserAnimationsModule,
    BrowserModule,
    FlexLayoutModule,
    FormsModule,
    HttpClientModule,
    HttpClientJsonpModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatListModule,
    MatTableModule,
    ReactiveFormsModule,
    RouterModule,
  ],
  providers: [
    ChooseFileService,
  ],
  bootstrap: [AppComponent],
  entryComponents: [
    MeasurementsTableDialog,
  ],
})
export class AppModule { }
